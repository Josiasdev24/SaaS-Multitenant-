import { useLayoutEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";

import { q, computeFinance, fullName } from "@/lib/data";
import { useCurrentUser } from "@/lib/session";
import { amountInWords } from "@/lib/words";
import { LoadingBlock, NoAccess, PageHeader } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/ecolage/recu/$paymentId")({
  head: () => ({
    meta: [{ title: "Reçu de paiement — Complexe Scolaire Omarus Adodo" }],
  }),
  component: ReceiptPage,
});

// Largeur de conception du reçu (rectangle fixe). À l'écran, il est réduit
// proportionnellement pour tenir sur téléphone ; à l'impression, il remplit la page.
const DESIGN_WIDTH = 640;

const printCss = `
#receipt-print { display: none; }
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body * { visibility: hidden !important; }
  #receipt-wrap { display: none !important; }
  #receipt-print { display: block !important; position: absolute; left: 0; top: 0; width: 210mm; }
  #receipt-print, #receipt-print * { visibility: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #receipt-print .copy {
    box-sizing: border-box; width: 210mm; height: 147mm; padding: 8mm 12mm;
    overflow: hidden; break-inside: avoid; page-break-inside: avoid; background: #fff;
  }
  #receipt-print .copy + .copy { border-top: 1px dashed #888; }
  #receipt-print .receipt-card { width: 100%; padding: 0; background: #fff; border: none; box-shadow: none; }
}
`;

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(n)
    .replace(/\u202f/g, " ");
}

function dateParts(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { dayMonth: "", yy: "" };
  return {
    dayMonth: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    yy: String(d.getFullYear()).slice(2),
  };
}

function Line({
  label,
  children,
  extra = false,
}: {
  label: string;
  children?: React.ReactNode;
  extra?: boolean;
}) {
  return (
    <div className="py-1">
      <div className="flex items-end gap-2">
        <span className="shrink-0 whitespace-nowrap text-[14px] font-bold">{label}</span>
        <span className="min-h-[24px] flex-1 border-b-2 border-dotted border-print-ink px-1 text-[14px]">
          {children}
        </span>
      </div>
      {extra ? <div className="mt-2 h-[22px] border-b-2 border-dotted border-print-ink" /> : null}
    </div>
  );
}

type SheetProps = {
  amount: number;
  student: string;
  words: string;
  motif: string;
  remaining: number;
  paidAt: string;
  receiptNumber: string | null;
};

function ReceiptContent({
  amount,
  student,
  words,
  motif,
  remaining,
  paidAt,
  receiptNumber,
}: SheetProps) {
  const date = dateParts(paidAt);

  return (
    <>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div className="leading-tight">
            <div className="whitespace-nowrap text-[17px] font-semibold tracking-tight">
              Complexe Scolaire
            </div>
            <div className="whitespace-nowrap text-[24px] font-extrabold leading-none">
              “Omarus ADODO”
            </div>
            <div className="mt-1 whitespace-nowrap text-[13px] font-semibold">
              Crèche, Maternelle, Primaire, Collège
            </div>
            <div className="whitespace-nowrap text-[12px] font-bold">Bè-Kpota 06 BP 61986</div>
            <div className="whitespace-nowrap text-[11px] font-semibold">
              Tél. : (+228) 93 96 13 21 / 98 40 10 27
            </div>
            <div className="whitespace-nowrap text-[12px] font-bold">Lomé - TOGO</div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[18px] font-extrabold">B.P.F.</span>
            <span className="min-w-[130px] whitespace-nowrap border-2 border-print-ink px-2 py-1 text-right text-[18px] font-bold">
              {formatNumber(amount)}
            </span>
          </div>
        </div>

        {/* Numéro du reçu : attribué automatiquement par le système */}
        <div className="mt-2 flex items-baseline justify-end gap-3">
          <span className="font-serif text-[34px] font-extrabold leading-none tracking-tight">
            REÇU
          </span>
          <span className="text-[13px] font-bold">N°</span>
          <span className="inline-block min-h-[22px] min-w-[130px] border-b-2 border-dotted border-print-ink px-1 text-center text-[17px] font-bold tracking-wider">
            {receiptNumber ?? ""}
          </span>
        </div>

        <div className="mt-3">
          <Line label="de M.">{student}</Line>
          <Line label="la somme de" extra>
            {words}
          </Line>
          <Line label="Pour" extra>
            {motif}
          </Line>
          <Line label="Reste à payer">{formatNumber(remaining)} F CFA</Line>
        </div>

        {/* Signature à gauche, date à droite, toujours sur UNE ligne */}
        <div className="mt-5 flex items-end justify-between whitespace-nowrap text-[14px] font-bold">
          <span className="pl-16">Signature</span>
          <span className="flex items-end gap-1">
            Lomé, le
            <span className="inline-block min-w-[90px] border-b-2 border-dotted border-print-ink text-center font-normal">
              {date.dayMonth}
            </span>
            /20
            <span className="inline-block min-w-[36px] border-b-2 border-dotted border-print-ink text-center font-normal">
              {date.yy}
            </span>
          </span>
        </div>
        <div className="h-10" />
    </>
  );
}

/** Reçu affiché à l'écran (réduit proportionnellement pour tenir sur téléphone). */
function ReceiptSheet(props: SheetProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    function update() {
      const w = wrapRef.current?.clientWidth ?? DESIGN_WIDTH;
      const s = Math.min(1, w / DESIGN_WIDTH);
      setScale(s);
      if (sheetRef.current) setHeight(sheetRef.current.offsetHeight * s);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div ref={wrapRef} id="receipt-wrap" className="mx-auto w-full max-w-[640px]" style={{ height }}>
      <div
        ref={sheetRef}
        id="receipt-sheet"
        className="rounded-md border border-border bg-print-paper p-5 text-print-ink shadow-sm"
        style={{
          width: DESIGN_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <ReceiptContent {...props} />
      </div>
    </div>
  );
}

/**
 * Impression : une feuille A4 en hauteur avec DEUX exemplaires identiques (haut et bas),
 * séparés par un trait de coupe. On coupe la feuille en deux : une moitié reste à l'école,
 * l'autre est remise aux parents.
 */
function PrintCopies(props: SheetProps) {
  return (
    <div id="receipt-print" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="copy">
          <div className="receipt-card text-print-ink">
            <ReceiptContent {...props} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReceiptPage() {
  const { paymentId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const enabled = Boolean(perms?.viewFinance);

  const [payments, students, classes, studentFees, fees] = useQueries({
    queries: [
      { ...q.payments(), enabled },
      { ...q.students(), enabled },
      { ...q.classes(), enabled },
      { ...q.studentFees(), enabled },
      { ...q.fees(), enabled },
    ],
  });

  if (perms && !perms.viewFinance) return <NoAccess />;
  if (!perms || [payments, students, classes, studentFees, fees].some((x) => x.isPending)) {
    return <LoadingBlock />;
  }

  const payment = (payments.data ?? []).find((p) => p.id === paymentId);
  const student = payment ? (students.data ?? []).find((s) => s.id === payment.student_id) : null;

  if (!payment || !student) {
    return (
      <div className="space-y-6 rise">
        <PageHeader
          title="Reçu introuvable"
          subtitle="Ce paiement n'existe pas ou a été supprimé."
        />
        <Link to="/ecolage" className="text-[13px] font-medium text-primary hover:underline">
          Retour à l'écolage
        </Link>
      </div>
    );
  }

  const className = (classes.data ?? []).find((c) => c.id === student.class_id)?.name ?? "";
  const studentFee = (studentFees.data ?? []).find((f) => f.id === payment.student_fee_id);
  const feeName = studentFee
    ? ((fees.data ?? []).find((f) => f.id === studentFee.school_fee_id)?.name ?? "Écolage")
    : "Écolage";

  // Reste à payer APRÈS ce paiement (on ignore les paiements postérieurs).
  const upTo = (payments.data ?? []).filter((p) => {
    if (p.student_id !== student.id) return false;
    if (p.created_at && payment.created_at) return p.created_at <= payment.created_at;
    return p.paid_at <= payment.paid_at;
  });
  const remaining = computeFinance(
    student.id,
    studentFees.data ?? [],
    upTo,
    fees.data ?? [],
  ).remaining;

  const amount = Number(payment.amount);
  const motif =
    [feeName, className && `— ${className}`, payment.method && `(${payment.method})`]
      .filter(Boolean)
      .join(" ") + (payment.note ? ` — ${payment.note}` : "");

  const sheetProps: SheetProps = {
    amount,
    student: fullName(student),
    words: amountInWords(amount),
    motif,
    remaining,
    paidAt: payment.paid_at,
    receiptNumber: payment.receipt_number,
  };

  return (
    <div className="space-y-6 rise">
      <style>{printCss}</style>

      <PageHeader
        title="Reçu de paiement"
        subtitle={fullName(student)}
        right={
          <div className="flex gap-2">
            <Link
              to="/ecolage"
              className="flex h-9 items-center rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted"
            >
              Retour
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              Imprimer le reçu
            </button>
          </div>
        }
      />

      <ReceiptSheet {...sheetProps} />
      <PrintCopies {...sheetProps} />
    </div>
  );
}
