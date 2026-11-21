import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  q,
  computeFinance,
  fullName,
  compareNames,
  hasRegime,
  isExempt,
  FEE_REGIME_SHORT,
  FEE_STATUS_LABELS,
  FEE_REGIME_LABELS,
  type FeeStatus,
  type FeeRegime,
  type Student,
  type Payment,
} from "@/lib/data";
import { money, dateFr, todayISO, pct } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { PAYMENT_METHODS, methodLabel } from "@/lib/payment-methods";
import { paymentSchema, parseOrThrow, optionalString, generateReceiptNumber } from "@/lib/validation";
import { formatReceipt, latestReceiptNumber } from "@/lib/receipts";
import { usePagination } from "@/lib/pagination";
import { StudentPicker } from "@/components/student-picker";
import {
  PageHeader,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  Panel,
  Section,
  NoAccess,
  Kpi,
  KpiGrid,
  FeeStatusBadge,
  Meter,
  Tag,
  Pagination,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/ecolage/")({
  head: () => ({
    meta: [
      { title: "Écolage & paiements" },
      {
        name: "description",
        content:
          "Suivi des frais scolaires, encaissements, restes à payer et taux de recouvrement.",
      },
      { property: "og:title", content: "Écolage & paiements" },
      {
        property: "og:description",
        content: "Enregistrez les paiements et suivez le recouvrement par élève.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeesPage,
});

function FeesPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | FeeStatus>("");
  const [regimeFilter, setRegimeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [students, classes, fees, studentFees, payments] = useQueries({
    queries: [q.students(), q.classes(), q.fees(), q.studentFees(), q.payments()],
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (students.data ?? [])
      .filter((s) => s.status === "actif")
      .map((s) => ({
        ...s,
        // Bourse, enfant ou proche du personnel : la réduction est déjà déduite par computeFinance.
        exempt: hasRegime(s),
        className: classes.data?.find((c) => c.id === s.class_id)?.name ?? "—",
        finance: computeFinance(s.id, studentFees.data ?? [], payments.data ?? [], fees.data ?? []),
      }))
      .filter((r) => (classFilter ? r.class_id === classFilter : true))
      .filter((r) => (statusFilter ? r.finance.status === statusFilter : true))
      .filter((r) => (regimeFilter ? (r.fee_status ?? "normal") === regimeFilter : true))
      .filter((r) =>
        term
          ? fullName(r).toLowerCase().includes(term) || r.matricule.toLowerCase().includes(term)
          : true,
      )
      .sort(compareNames);
  }, [
    students.data,
    classes.data,
    fees.data,
    studentFees.data,
    payments.data,
    classFilter,
    statusFilter,
    regimeFilter,
    search,
  ]);

  const totals = useMemo(() => {
    const due = rows.reduce((s, r) => s + r.finance.due, 0);
    const paid = rows.reduce((s, r) => s + r.finance.paid, 0);
    return {
      due,
      paid,
      remaining: Math.max(due - paid, 0),
      rate: due > 0 ? (paid / due) * 100 : 0,
      late: rows.filter((r) => r.finance.status === "retard" || r.finance.status === "impaye")
        .length,
    };
  }, [rows]);

  const { pageItems, page, setPage, totalPages } = usePagination(rows, 20);

  const recordPayment = useMutation({
    mutationFn: async (form: FormData) => {
      if (!String(form.get("student_id") ?? "")) throw new Error("Choisissez d'abord un élève.");
      const paidAt = String(form.get("paid_at") || todayISO());
      const values = parseOrThrow(paymentSchema, {
        student_id: String(form.get("student_id") ?? ""),
        student_fee_id: optionalString(form.get("student_fee_id")),
        amount: Number(form.get("amount")),
        paid_at: paidAt,
        method: String(form.get("method") || "espèces"),
        note: optionalString(form.get("note")),
      });

      // Le numéro de reçu est attribué automatiquement, à partir du dernier numéro lu dans la base.
      // Si deux personnes encaissent au même moment, on réessaie avec le numéro suivant.
      let next = (await latestReceiptNumber()) + 1;
      for (let attempt = 0; attempt < 5; attempt += 1, next += 1) {
        const receiptNumber = formatReceipt(next);
        const { data, error } = await supabase
          .from("fee_payments")
          .insert({
            student_id: values.student_id,
            student_fee_id: values.student_fee_id ?? null,
            amount: values.amount,
            paid_at: values.paid_at,
            method: values.method,
            receipt_number: receiptNumber,
            note: values.note ?? null,
            recorded_by: user?.userId ?? null,
          } as never)
          .select("id")
          .single();
        if (!error) return { id: String((data as { id: string }).id), receiptNumber };
        if (!error.message.includes("fee_payments_receipt_number_unique")) {
          throw new Error(error.message);
        }
      }
      throw new Error("Impossible d'attribuer un numéro de reçu. Réessayez dans un instant.");
    },
    onSuccess: ({ id, receiptNumber }) => {
      toast.success("Paiement enregistré", {
        description: `Reçu n° ${receiptNumber}`,
        action: {
          label: "Imprimer le reçu",
          onClick: () => void navigate({ to: "/ecolage/recu/$paymentId", params: { paymentId: id } }),
        },
      });
      setShowForm(false);
      setFormPicked(null);
      setFormSearch("");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  /** Suppression d'un paiement (fondateur uniquement). */
  const deletePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.from("fee_payments").delete().eq("id", paymentId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Paiement supprimé", {
        description: "L'écolage de l'élève a été recalculé.",
      });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  const [formSearch, setFormSearch] = useState("");
  const [formPicked, setFormPicked] = useState<Student | null>(null);
  const formStudent = formPicked?.id ?? "";
  const nextReceipt = useMemo(
    () => generateReceiptNumber((payments.data ?? []).map((p) => p.receipt_number).filter((r): r is string => Boolean(r))),
    [payments.data],
  );
  const formFinance = useMemo(
    () =>
      formPicked
        ? computeFinance(formPicked.id, studentFees.data ?? [], payments.data ?? [], fees.data ?? [])
        : null,
    [formPicked, studentFees.data, payments.data, fees.data],
  );
  const formStudentFees = useMemo(() => {
    return (studentFees.data ?? [])
      .filter((f) => f.student_id === formStudent)
      .map((f) => ({
        ...f,
        name: fees.data?.find((x) => x.id === f.school_fee_id)?.name ?? "Frais",
        order: fees.data?.find((x) => x.id === f.school_fee_id)?.order_index ?? 99,
      }))
      .sort((a, b) => a.order - b.order);
  }, [studentFees.data, fees.data, formStudent]);

  /* ---- Liste complète des paiements : consulter, modifier, supprimer ---- */
  const [payTerm, setPayTerm] = useState("");
  const [payFrom, setPayFrom] = useState("");
  const [payTo, setPayTo] = useState("");
  const [editing, setEditing] = useState<Payment | null>(null);
  const editRef = useRef<HTMLDivElement>(null);

  const studentById = useMemo(
    () => new Map((students.data ?? []).map((s) => [s.id, s])),
    [students.data],
  );
  const feeNameByStudentFee = useMemo(() => {
    const names = new Map((fees.data ?? []).map((f) => [f.id, f.name]));
    return new Map((studentFees.data ?? []).map((sf) => [sf.id, names.get(sf.school_fee_id) ?? "Frais"]));
  }, [fees.data, studentFees.data]);

  const paymentRows = useMemo(() => {
    const t = payTerm.trim().toLowerCase();
    return (payments.data ?? []).filter((p) => {
      const day = String(p.paid_at).slice(0, 10);
      if (payFrom && day < payFrom) return false;
      if (payTo && day > payTo) return false;
      if (!t) return true;
      const s = studentById.get(p.student_id);
      return (
        (s ? fullName(s).toLowerCase().includes(t) || s.matricule.toLowerCase().includes(t) : false) ||
        (p.receipt_number ?? "").toLowerCase().includes(t)
      );
    });
  }, [payments.data, payTerm, payFrom, payTo, studentById]);
  const paymentsTotal = useMemo(
    () => paymentRows.reduce((sum, p) => sum + Number(p.amount), 0),
    [paymentRows],
  );
  const payPager = usePagination(paymentRows, 15);

  /** Modification d'un paiement existant (reçu et élève inchangés). */
  const updatePayment = useMutation({
    mutationFn: async ({ id, studentId, form }: { id: string; studentId: string; form: FormData }) => {
      const values = parseOrThrow(paymentSchema, {
        student_id: studentId,
        student_fee_id: optionalString(form.get("student_fee_id")),
        amount: Number(form.get("amount")),
        paid_at: String(form.get("paid_at") || todayISO()),
        method: String(form.get("method") || "espèces"),
        note: optionalString(form.get("note")),
      });
      const { data, error } = await supabase
        .from("fee_payments")
        .update({
          student_fee_id: values.student_fee_id ?? null,
          amount: values.amount,
          paid_at: values.paid_at,
          method: values.method,
          note: values.note ?? null,
        } as never)
        .eq("id", id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || (data as unknown[]).length === 0) {
        throw new Error("Modification refusée : vous n'avez pas le droit de modifier ce paiement.");
      }
    },
    onSuccess: () => {
      toast.success("Paiement modifié", { description: "L'écolage de l'élève a été recalculé." });
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error("Modification impossible", { description: e.message }),
  });

  function openEdit(p: Payment) {
    setEditing(p);
    window.setTimeout(() => editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  if (!perms) return <LoadingBlock />;
  if (!perms.viewFinance) return <NoAccess />;
  if (students.isPending || payments.isPending) return <LoadingBlock />;

  // Seul le fondateur peut supprimer un paiement.
  const canDelete = perms.editFinance && user?.role === "admin";

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Écolage & paiements"
        subtitle="Frais attendus, encaissements et restes à recouvrer."
        right={
          perms.editFinance ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              {showForm ? "Annuler" : "Enregistrer un paiement"}
            </button>
          ) : null
        }
      />

      <KpiGrid>
        <Kpi label="Attendu" value={money(totals.due)} />
        <Kpi
          label="Encaissé"
          value={money(totals.paid)}
          hint={`Taux de recouvrement ${pct(totals.rate)}`}
        >
          <Meter
            segments={[
              { value: totals.paid, className: "bg-ok" },
              { value: totals.remaining, className: "bg-late/40" },
            ]}
          />
        </Kpi>
        <Kpi label="Reste à payer" value={money(totals.remaining)} />
        <Kpi label="Dossiers en retard" value={totals.late} hint={`${rows.length} élèves suivis`} />
      </KpiGrid>

      {showForm && perms.editFinance ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">Nouveau paiement</h2>
          <form
            className="mt-4 grid gap-4 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              recordPayment.mutate(new FormData(e.currentTarget));
            }}
          >
            <div className="md:col-span-2">
              <StudentPicker
                students={students.data ?? []}
                classes={classes.data ?? []}
                search={formSearch}
                onSearchChange={setFormSearch}
                picked={formPicked}
                onPick={setFormPicked}
                autoFocus
              />
              <input type="hidden" name="student_id" value={formStudent} />
              {formFinance ? (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Déjà payé {money(formFinance.paid)} sur {money(formFinance.due)} · reste{" "}
                  <span className="font-medium text-foreground">{money(formFinance.remaining)}</span>
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="student_fee_id" className="label-caps">
                Échéance
              </label>
              <select
                key={formStudent}
                id="student_fee_id"
                name="student_fee_id"
                className={inputClass}
              >
                <option value="">Non affecté</option>
                {formStudentFees.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {money(f.amount_due)}
                  </option>
                ))}
              </select>
              {formPicked && formStudentFees.length === 0 ? (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Aucun frais n'est encore attribué à cet élève.
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="amount" className="label-caps">
                Montant
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="1"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="paid_at" className="label-caps">
                Date
              </label>
              <input
                id="paid_at"
                name="paid_at"
                type="date"
                defaultValue={todayISO()}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="method" className="label-caps">
                Mode
              </label>
              <select id="method" name="method" className={inputClass}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="label-caps">N° reçu</span>
              <div className="mt-1.5 flex h-9 items-center rounded-md border border-border bg-muted/50 px-3 text-[13px] text-muted-foreground">
                <span className="num-display mr-2 text-foreground">{nextReceipt}</span> attribué automatiquement
              </div>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="note" className="label-caps">
                Note
              </label>
              <input id="note" name="note" className={inputClass} />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={recordPayment.isPending}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {recordPayment.isPending ? "Enregistrement…" : "Valider le paiement"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Section title="Grille tarifaire">
        <TableWrap minWidth={560}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Frais</Th>
              <Th>Type</Th>
              <Th>Échéance</Th>
              <Th className="text-right">Montant</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(fees.data ?? []).length === 0 ? (
              <EmptyRow colSpan={4} label="Aucun frais paramétré." />
            ) : (
              (fees.data ?? []).map((f) => (
                <tr key={f.id} className="hover:bg-muted/40">
                  <Td className="font-medium">{f.name}</Td>
                  <Td>
                    <Tag>{f.kind}</Tag>
                  </Td>
                  <Td className="text-muted-foreground">{dateFr(f.due_date)}</Td>
                  <Td className="num-display text-right">{money(f.amount)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </Section>

      <Section title="Situation par élève">
        <div className="mb-3 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou matricule…"
            className="h-9 w-full max-w-xs rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50"
          />
          <select
            aria-label="Filtrer par classe"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50"
          >
            <option value="">Toutes les classes</option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | FeeStatus)}
            className="h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50"
          >
            <option value="">Tous les statuts</option>
            {(Object.keys(FEE_STATUS_LABELS) as FeeStatus[]).map((s) => (
              <option key={s} value={s}>
                {FEE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrer par régime"
            value={regimeFilter}
            onChange={(e) => setRegimeFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50"
          >
            <option value="">Tous les régimes</option>
            {(Object.keys(FEE_REGIME_LABELS) as FeeRegime[]).map((r) => (
              <option key={r} value={r}>
                {FEE_REGIME_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <TableWrap
          minWidth={860}
          footer={
            <>
              <span>{rows.length} élèves affichés</span>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          }
        >
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Élève</Th>
              <Th>Classe</Th>
              <Th>Statut</Th>
              <Th className="text-right">Attendu</Th>
              <Th className="text-right">Payé</Th>
              <Th className="text-right">Reste</Th>
              <Th>Prochaine échéance</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <EmptyRow colSpan={7} label="Aucun élève ne correspond aux filtres." />
            ) : (
              pageItems.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <Td>
                    <Link
                      to="/eleves/$studentId"
                      params={{ studentId: r.id }}
                      className="font-medium hover:underline"
                    >
                      {fullName(r)}
                    </Link>
                    {r.exempt ? (
                      <span className="ml-2 align-middle">
                        <Tag tone="partial">
                          {FEE_REGIME_SHORT[r.fee_status as FeeRegime]}
                          {r.finance.discount > 0 && !isExempt(r) ? ` · −${money(r.finance.discount)}` : ""}
                        </Tag>
                      </span>
                    ) : null}
                    <div className="num-display text-[11px] text-faint">{r.matricule}</div>
                  </Td>
                  <Td className="text-muted-foreground">{r.className}</Td>
                  <Td>
                    {isExempt(r) ? <Tag tone="partial">Exonéré</Tag> : <FeeStatusBadge status={r.finance.status} />}
                  </Td>
                  <Td className="num-display text-right">{money(r.finance.due)}</Td>
                  <Td className="num-display text-right text-ok">{money(r.finance.paid)}</Td>
                  <Td className="num-display text-right font-medium">
                    {money(r.finance.remaining)}
                  </Td>
                  <Td className="text-muted-foreground">
                    {r.finance.nextDue
                      ? `${r.finance.nextDue.name} · ${dateFr(r.finance.nextDue.date)}`
                      : "—"}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </Section>

      <Section title="Tous les paiements">
        {editing && perms.editFinance ? (
          <div ref={editRef} className="mb-4">
            <Panel>
              <h3 className="text-[14px] font-semibold">
                Modifier le paiement
                {editing.receipt_number ? ` — reçu n° ${editing.receipt_number}` : ""}
              </h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Élève :{" "}
                <span className="font-medium text-foreground">
                  {studentById.get(editing.student_id) ? fullName(studentById.get(editing.student_id)!) : "—"}
                </span>
              </p>
              <form
                key={editing.id}
                className="mt-4 grid gap-4 md:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  updatePayment.mutate({
                    id: editing.id,
                    studentId: editing.student_id,
                    form: new FormData(e.currentTarget),
                  });
                }}
              >
                <div>
                  <label htmlFor="e_amount" className="label-caps">
                    Montant
                  </label>
                  <input
                    id="e_amount"
                    name="amount"
                    type="number"
                    min="1"
                    required
                    defaultValue={Number(editing.amount)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="e_paid_at" className="label-caps">
                    Date
                  </label>
                  <input
                    id="e_paid_at"
                    name="paid_at"
                    type="date"
                    required
                    defaultValue={String(editing.paid_at).slice(0, 10)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="e_method" className="label-caps">
                    Mode
                  </label>
                  <select id="e_method" name="method" defaultValue={editing.method} className={inputClass}>
                    {PAYMENT_METHODS.some((m) => m.value === editing.method) ? null : (
                      <option value={editing.method}>{methodLabel(editing.method)}</option>
                    )}
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="e_fee" className="label-caps">
                    Échéance
                  </label>
                  <select
                    id="e_fee"
                    name="student_fee_id"
                    defaultValue={editing.student_fee_id ?? ""}
                    className={inputClass}
                  >
                    <option value="">Non affecté</option>
                    {(studentFees.data ?? [])
                      .filter((f) => f.student_id === editing.student_id)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {feeNameByStudentFee.get(f.id) ?? "Frais"} — {money(f.amount_due)}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="e_note" className="label-caps">
                    Note
                  </label>
                  <input id="e_note" name="note" defaultValue={editing.note ?? ""} className={inputClass} />
                </div>
                <div className="flex gap-3 md:col-span-3">
                  <button
                    type="submit"
                    disabled={updatePayment.isPending}
                    className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {updatePayment.isPending ? "Enregistrement…" : "Enregistrer la modification"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="h-9 rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </Panel>
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap items-end gap-3">
          <input
            value={payTerm}
            onChange={(e) => setPayTerm(e.target.value)}
            placeholder="Nom, matricule ou n° de reçu…"
            aria-label="Rechercher un paiement"
            className="h-9 w-full max-w-xs rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50"
          />
          <label className="text-[12px] text-muted-foreground">
            Du
            <input
              type="date"
              value={payFrom}
              onChange={(e) => setPayFrom(e.target.value)}
              className="ml-2 h-9 rounded-md border border-border bg-card px-2 text-[13px] outline-none focus:border-primary/50"
            />
          </label>
          <label className="text-[12px] text-muted-foreground">
            au
            <input
              type="date"
              value={payTo}
              onChange={(e) => setPayTo(e.target.value)}
              className="ml-2 h-9 rounded-md border border-border bg-card px-2 text-[13px] outline-none focus:border-primary/50"
            />
          </label>
        </div>

        <TableWrap
          minWidth={820}
          footer={
            <>
              <span>
                {paymentRows.length} paiement(s) · total {money(paymentsTotal)}
              </span>
              <Pagination page={payPager.page} totalPages={payPager.totalPages} onPageChange={payPager.setPage} />
            </>
          }
        >
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Date</Th>
              <Th>Élève</Th>
              <Th>Échéance</Th>
              <Th>Mode</Th>
              <Th>Reçu</Th>
              <Th className="text-right">Montant</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paymentRows.length === 0 ? (
              <EmptyRow colSpan={7} label="Aucun paiement ne correspond à cette recherche." />
            ) : (
              payPager.pageItems.map((p) => {
                const s = studentById.get(p.student_id);
                const isTontine = p.method.toLowerCase() === "tontine";
                return (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <Td className="text-muted-foreground">{dateFr(p.paid_at)}</Td>
                    <Td>
                      {s ? (
                        <Link
                          to="/eleves/$studentId"
                          params={{ studentId: s.id }}
                          className="font-medium hover:underline"
                        >
                          {fullName(s)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-muted-foreground">
                      {p.student_fee_id ? (feeNameByStudentFee.get(p.student_fee_id) ?? "—") : "Non affecté"}
                    </Td>
                    <Td className="text-muted-foreground">{methodLabel(p.method)}</Td>
                    <Td className="num-display text-muted-foreground">{p.receipt_number ?? "—"}</Td>
                    <Td className="num-display text-right">{money(p.amount)}</Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          to="/ecolage/recu/$paymentId"
                          params={{ paymentId: p.id }}
                          className="text-[12px] font-medium text-primary hover:underline"
                        >
                          Consulter
                        </Link>
                        {perms.editFinance ? (
                          isTontine ? (
                            <span className="text-[12px] text-faint" title="Un paiement de tontine se modifie dans la tontine.">
                              —
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="text-[12px] font-medium text-primary hover:underline"
                            >
                              Modifier
                            </button>
                          )
                        ) : null}
                        {canDelete && !isTontine ? (
                          <button
                            type="button"
                            disabled={deletePayment.isPending}
                            onClick={() => {
                              const name = s ? fullName(s) : "cet élève";
                              if (
                                window.confirm(
                                  `Supprimer le paiement de ${money(p.amount)} de ${name}` +
                                    `${p.receipt_number ? ` (reçu n° ${p.receipt_number})` : ""} ?\n\n` +
                                    "L'écolage de l'élève sera recalculé. Cette action est définitive.",
                                )
                              ) {
                                deletePayment.mutate(p.id);
                              }
                            }}
                            className="text-[12px] font-medium text-destructive hover:underline disabled:opacity-60"
                          >
                            Supprimer
                          </button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrap>
      </Section>
    </div>
  );
}

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
