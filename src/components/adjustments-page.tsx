import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { q, fullName, type Student } from "@/lib/data";
import { money, moneyShort, dateFr } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import {
  adjustmentsQuery,
  addAdjustment,
  arrearSettlements,
  removeAdjustment,
  type AdjustmentKind,
} from "@/lib/adjustments";
import { StudentPicker } from "@/components/student-picker";
import {
  PageHeader,
  Panel,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  NoAccess,
  KpiGrid,
  Kpi,
} from "@/components/kit";

type KindConfig = {
  title: string;
  subtitle: string;
  help: string;
  addTitle: string;
  labelField: string;
  labelPlaceholder: string;
  defaultAmount: string;
  oneAdjustmentPerStudent: boolean;
  empty: string;
  removeConfirm: string;
};

const KIND_CONFIG: Record<AdjustmentKind, KindConfig> = {
  reduction_familiale: {
    title: "Réductions familiales",
    subtitle: "Élèves qui bénéficient de la réduction familiale.",
    help: "Le montant est déduit automatiquement de l'écolage de l'élève (sur ses dernières tranches). Seuls les élèves ajoutés ici bénéficient de la réduction.",
    addTitle: "Ajouter un élève bénéficiaire",
    labelField: "Famille ou précision",
    labelPlaceholder: "Ex. famille AKAKPO",
    defaultAmount: "2000",
    oneAdjustmentPerStudent: true,
    empty: "Aucun élève ne bénéficie de la réduction familiale pour le moment.",
    removeConfirm: "Retirer cette réduction ? L'écolage de l'élève sera rétabli.",
  },
  bourse: {
    title: "Bourses",
    subtitle: "Élèves qui reçoivent une bourse.",
    help: "Le montant de la bourse est déduit automatiquement de l'écolage de l'élève (sur ses dernières tranches).",
    addTitle: "Attribuer une bourse",
    labelField: "Motif de la bourse",
    labelPlaceholder: "Ex. excellents résultats",
    defaultAmount: "",
    oneAdjustmentPerStudent: true,
    empty: "Aucune bourse attribuée pour le moment.",
    removeConfirm: "Retirer cette bourse ? L'écolage de l'élève sera rétabli.",
  },
  arriere: {
    title: "Arriérés",
    subtitle: "Sommes restant dues par les élèves au titre des années précédentes.",
    help: "Le montant est ajouté à ce que l'élève doit, sur une ligne « Arriérés » exigible immédiatement. Un paiement enregistré réduit ensuite le reste à payer comme d'habitude.",
    addTitle: "Enregistrer un arriéré",
    labelField: "Précision",
    labelPlaceholder: "Ex. écolage 2025-2026",
    defaultAmount: "",
    oneAdjustmentPerStudent: false,
    empty: "Aucun arriéré enregistré pour le moment.",
    removeConfirm: "Retirer cet arriéré ? Le montant sera enlevé de ce que doit l'élève.",
  },
};

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";

export function AdjustmentsPage({ kind }: { kind: AdjustmentKind }) {
  const cfg = KIND_CONFIG[kind];
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const queryClient = useQueryClient();
  const enabled = Boolean(perms?.viewFinance);

  const [students, classes, adjustments, payments] = useQueries({
    queries: [
      { ...q.students(), enabled },
      { ...q.classes(), enabled },
      { ...adjustmentsQuery, enabled },
      { ...q.payments(), enabled: enabled && kind === "arriere" },
    ],
  });

  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Student | null>(null);

  const studentById = useMemo(
    () => new Map((students.data ?? []).map((s) => [s.id, s])),
    [students.data],
  );
  const className = (classId: string | null) =>
    (classes.data ?? []).find((c) => c.id === classId)?.name ?? "—";

  const rows = useMemo(
    () => (adjustments.data ?? []).filter((a) => a.kind === kind),
    [adjustments.data, kind],
  );
  const totalAmount = rows.reduce((sum, a) => sum + a.amount, 0);
  const distinctStudents = new Set(rows.map((a) => a.student_id)).size;
  const alreadyIn = useMemo(() => new Set(rows.map((a) => a.student_id)), [rows]);

  const settlements = useMemo(
    () => (kind === "arriere" ? arrearSettlements(adjustments.data ?? [], payments.data ?? []) : new Map()),
    [kind, adjustments.data, payments.data],
  );
  const settledCount = rows.filter((a) => settlements.get(a.id)?.paidOn).length;
  const remainingTotal = rows.reduce(
    (sum, a) => sum + Math.max(a.amount - (settlements.get(a.id)?.paid ?? 0), 0),
    0,
  );

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["fee-adjustments"] });
    queryClient.invalidateQueries({ queryKey: ["student-fees"] });
    queryClient.invalidateQueries({ queryKey: ["school-fees"] });
  }

  const add = useMutation({
    mutationFn: async (form: FormData) => {
      if (!picked) throw new Error("Choisissez d'abord un élève.");
      if (cfg.oneAdjustmentPerStudent && alreadyIn.has(picked.id)) {
        throw new Error("Cet élève figure déjà dans la liste.");
      }
      const amount = Number(
        String(form.get("amount") ?? "")
          .replace(/\s/g, "")
          .replace(",", "."),
      );
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Le montant doit être supérieur à 0.");
      }
      const label = String(form.get("label") ?? "").trim();
      await addAdjustment({
        studentId: picked.id,
        kind,
        amount,
        label: label === "" ? null : label,
      });
    },
    onSuccess: () => {
      toast.success("Enregistré", { description: "L'écolage de l'élève a été mis à jour." });
      setPicked(null);
      setSearch("");
      refresh();
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => removeAdjustment(id),
    onSuccess: () => {
      toast.success("Retiré", { description: "L'écolage de l'élève a été rétabli." });
      refresh();
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  if (!perms) return <LoadingBlock />;
  if (!perms.viewFinance) return <NoAccess />;
  if (students.isPending || adjustments.isPending) return <LoadingBlock />;

  return (
    <div className="space-y-6 rise">
      <PageHeader title={cfg.title} subtitle={cfg.subtitle} />

      <KpiGrid>
        <Kpi label="Élèves concernés" value={String(distinctStudents)} hint={cfg.title.toLowerCase()} />
        <Kpi
          label="Montant total"
          value={moneyShort(totalAmount)}
          hint={kind === "arriere" ? "ajouté à l'écolage dû" : "déduit de l'écolage"}
        />
        {kind === "arriere" ? (
          <>
            <Kpi label="Arriérés soldés" value={String(settledCount)} hint={`sur ${rows.length}`} />
            <Kpi label="Reste à recouvrer" value={moneyShort(remainingTotal)} hint="arriérés non payés" />
          </>
        ) : null}
      </KpiGrid>

      {perms.editFinance ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">{cfg.addTitle}</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">{cfg.help}</p>

          <div className="mt-4">
            <StudentPicker
              students={students.data ?? []}
              classes={classes.data ?? []}
              search={search}
              onSearchChange={setSearch}
              picked={picked}
              onPick={setPicked}
              disabledIds={cfg.oneAdjustmentPerStudent ? alreadyIn : undefined}
              autoFocus
            />
          </div>

          <form
            key={kind}
            className="mt-4 grid gap-4 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate(new FormData(e.currentTarget));
            }}
          >
            <div>
              <label htmlFor="amount" className="label-caps">
                Montant (FCFA)
              </label>
              <input
                id="amount"
                name="amount"
                inputMode="numeric"
                required
                defaultValue={cfg.defaultAmount}
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="label" className="label-caps">
                {cfg.labelField}
              </label>
              <input
                id="label"
                name="label"
                placeholder={cfg.labelPlaceholder}
                className={inputClass}
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={add.isPending || !picked}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {add.isPending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <TableWrap minWidth={640}>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <Th>Élève</Th>
            <Th>Classe</Th>
            <Th>{cfg.labelField}</Th>
            <Th className="text-right">Montant</Th>
            <Th>{kind === "arriere" ? "Enregistré le" : "Date"}</Th>
            {kind === "arriere" ? <Th>Réglé le</Th> : null}
            {perms.editFinance ? <Th className="text-right">Action</Th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <EmptyRow colSpan={(perms.editFinance ? 6 : 5) + (kind === "arriere" ? 1 : 0)} label={cfg.empty} />
          ) : (
            rows.map((a) => {
              const s = studentById.get(a.student_id);
              return (
                <tr key={a.id} className="hover:bg-muted/40">
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
                      <span className="text-muted-foreground">Élève supprimé</span>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">{className(s?.class_id ?? null)}</Td>
                  <Td className="text-muted-foreground">{a.label ?? "—"}</Td>
                  <Td className="num-display text-right">
                    <span title={money(a.amount)}>{moneyShort(a.amount)}</span>
                  </Td>
                  <Td className="text-muted-foreground">{dateFr(a.created_at.slice(0, 10))}</Td>
                  {kind === "arriere" ? <SettledCell adjustmentAmount={a.amount} s={settlements.get(a.id)} /> : null}
                  {perms.editFinance ? (
                    <Td className="text-right">
                      <button
                        type="button"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(cfg.removeConfirm)) remove.mutate(a.id);
                        }}
                        className="text-[12px] font-medium text-destructive hover:underline disabled:opacity-60"
                      >
                        Retirer
                      </button>
                    </Td>
                  ) : null}
                </tr>
              );
            })
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}

/** Colonne « Réglé le » : la date où l'élève a fini de payer son arriéré. */
function SettledCell({
  adjustmentAmount,
  s,
}: {
  adjustmentAmount: number;
  s: { paid: number; paidOn: string | null } | undefined;
}) {
  if (s?.paidOn) {
    return (
      <Td>
        <span className="font-medium text-ok">{dateFr(s.paidOn)}</span>
      </Td>
    );
  }
  if (s && s.paid > 0) {
    return (
      <Td className="text-partial">
        Partiel : {money(s.paid)} sur {money(adjustmentAmount)}
      </Td>
    );
  }
  return <Td className="text-muted-foreground">Non payé</Td>;
}
