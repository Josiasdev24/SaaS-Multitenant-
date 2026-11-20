import { Fragment, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { q, computeFinance, fullName, type Student } from "@/lib/data";
import { money, moneyShort, dateFr, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { academicMonths, monthLabel, monthOf } from "@/lib/months";
import {
  type TontineDeposit,
  tontineQuery,
  addTontineDeposit,
  removeTontineDeposit,
  settleTontine,
  settleTontineMonth,
} from "@/lib/ledger";
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
  Tag,
} from "@/components/kit";

/** Mise minimum conseillée par jour et par enfant. */
const MIN_DEPOSIT = 300;

type Group = {
  studentId: string;
  count: number;
  total: number;
  pending: number;
  items: TontineDeposit[];
};

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
const filterClass =
  "h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";

export function TontinePage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const queryClient = useQueryClient();
  const today = todayISO();
  const months = useMemo(() => academicMonths(today), [today]);
  const enabled = Boolean(perms?.viewFinance);

  const defaultMonth = months.some((m) => m.key === monthOf(today))
    ? monthOf(today)
    : (months[0]?.key ?? monthOf(today));
  const [month, setMonth] = useState(defaultMonth);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Student | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [students, classes, deposits, studentFees, payments, fees] = useQueries({
    queries: [
      { ...q.students(), enabled },
      { ...q.classes(), enabled },
      { ...tontineQuery, enabled },
      { ...q.studentFees(), enabled },
      { ...q.payments(), enabled },
      { ...q.fees(), enabled },
    ],
  });

  const studentById = useMemo(
    () => new Map((students.data ?? []).map((s) => [s.id, s])),
    [students.data],
  );

  const groups = useMemo(() => {
    const nameOf = (id: string) => {
      const s = studentById.get(id);
      return s ? fullName(s) : "";
    };
    const inMonth = (deposits.data ?? []).filter((d) => monthOf(d.deposit_date) === month);
    const map = new Map<string, Group>();
    for (const d of inMonth) {
      const g = map.get(d.student_id) ?? {
        studentId: d.student_id,
        count: 0,
        total: 0,
        pending: 0,
        items: [],
      };
      g.count += 1;
      g.total += d.amount;
      if (!d.settled_at) g.pending += d.amount;
      g.items.push(d);
      map.set(d.student_id, g);
    }
    return [...map.values()].sort((a, b) => nameOf(a.studentId).localeCompare(nameOf(b.studentId)));
  }, [deposits.data, month, studentById]);

  const totals = useMemo(
    () => ({
      students: groups.length,
      total: groups.reduce((s, g) => s + g.total, 0),
      pending: groups.reduce((s, g) => s + g.pending, 0),
    }),
    [groups],
  );

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["tontine"] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
  }

  const addDeposit = useMutation({
    mutationFn: async (form: FormData) => {
      if (!picked) throw new Error("Choisissez d'abord un élève.");
      const amount = Number(
        String(form.get("amount") ?? "")
          .replace(/\s/g, "")
          .replace(",", "."),
      );
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Le montant doit être supérieur à 0.");
      }
      if (
        amount < MIN_DEPOSIT &&
        !window.confirm(
          `La mise minimum est de ${money(MIN_DEPOSIT)} par jour. Enregistrer ${money(amount)} quand même ?`,
        )
      ) {
        throw new Error("Versement annulé.");
      }
      const note = String(form.get("note") ?? "").trim();
      await addTontineDeposit({
        studentId: picked.id,
        amount,
        date: String(form.get("date") || todayISO()),
        note: note === "" ? null : note,
      });
    },
    onSuccess: () => {
      toast.success("Versement enregistré");
      setPicked(null);
      setSearch("");
      formRef.current?.reset();
      refresh();
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  const removeDeposit = useMutation({
    mutationFn: async (id: string) => removeTontineDeposit(id),
    onSuccess: () => {
      toast.success("Versement supprimé");
      refresh();
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  const settleOne = useMutation({
    mutationFn: async (studentId: string) => settleTontine(studentId, `${month}-01`),
    onSuccess: () => {
      toast.success("Versements appliqués à l'écolage");
      refresh();
    },
    onError: (e: Error) => toast.error("Application impossible", { description: e.message }),
  });

  const settleAll = useMutation({
    mutationFn: async () => settleTontineMonth(`${month}-01`),
    onSuccess: (n) => {
      toast.success(`${n} élève(s) traité(s)`, {
        description: "Les versements du mois ont été déduits de l'écolage.",
      });
      refresh();
    },
    onError: (e: Error) => toast.error("Application impossible", { description: e.message }),
  });

  if (!perms) return <LoadingBlock />;
  if (!perms.viewFinance) return <NoAccess />;
  if (students.isPending || deposits.isPending) return <LoadingBlock />;

  function remainingOf(studentId: string): number {
    return computeFinance(studentId, studentFees.data ?? [], payments.data ?? [], fees.data ?? [])
      .remaining;
  }

  function confirmSettle(studentId: string, pending: number) {
    const s = studentById.get(studentId);
    const remaining = remainingOf(studentId);
    let message = `Appliquer ${money(pending)} à l'écolage de ${s ? fullName(s) : "cet élève"} pour ${monthLabel(month)} ?`;
    if (pending > remaining) {
      message += `\n\nAttention : ce montant dépasse son reste à payer (${money(remaining)}).`;
    }
    if (month >= monthOf(today)) {
      message += "\n\nLe mois n'est pas terminé : d'autres versements peuvent encore arriver.";
    }
    if (window.confirm(message)) settleOne.mutate(studentId);
  }

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Tontine scolaire"
        subtitle="Les parents versent ce qu'ils peuvent chaque jour (300 F minimum). En fin de mois, le total est déduit de l'écolage de l'enfant."
        right={
          perms.editFinance && totals.pending > 0 ? (
            <button
              type="button"
              disabled={settleAll.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Appliquer à l'écolage tous les versements non appliqués de ${monthLabel(month)} (${money(totals.pending)}) ?`,
                  )
                ) {
                  settleAll.mutate();
                }
              }}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {settleAll.isPending ? "Application…" : "Tout appliquer pour le mois"}
            </button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mois" className={filterClass}>
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <KpiGrid>
        <Kpi label="Élèves dans la tontine" value={String(totals.students)} hint={monthLabel(month)} />
        <Kpi label="Total versé" value={money(totals.total)} hint="sur le mois" />
        <Kpi label="Reste à appliquer" value={money(totals.pending)} hint="pas encore déduit de l'écolage" />
      </KpiGrid>

      {perms.editFinance ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">Enregistrer un versement</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Le premier versement d'un élève l'ajoute à la tontine.
          </p>
          <div className="mt-4">
            <StudentPicker
              students={students.data ?? []}
              classes={classes.data ?? []}
              search={search}
              onSearchChange={setSearch}
              picked={picked}
              onPick={setPicked}
            />
          </div>
          <form
            ref={formRef}
            className="mt-4 grid gap-4 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              addDeposit.mutate(new FormData(e.currentTarget));
            }}
          >
            <div>
              <label htmlFor="amount" className="label-caps">
                Montant (FCFA)
              </label>
              <input id="amount" name="amount" inputMode="numeric" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="date" className="label-caps">
                Date
              </label>
              <input id="date" name="date" type="date" defaultValue={today} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="note" className="label-caps">
                Note
              </label>
              <input id="note" name="note" className={inputClass} />
            </div>
            <div className="md:col-span-4">
              <button
                type="submit"
                disabled={addDeposit.isPending || !picked}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {addDeposit.isPending ? "Enregistrement…" : "Enregistrer le versement"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <TableWrap minWidth={720}>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <Th>Élève</Th>
            <Th className="text-right">Versements</Th>
            <Th className="text-right">Total du mois</Th>
            <Th className="text-right">Reste à appliquer</Th>
            <Th>État</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {groups.length === 0 ? (
            <EmptyRow colSpan={6} label="Aucun versement pour ce mois." />
          ) : (
            groups.map((g) => {
              const s = studentById.get(g.studentId);
              const open = expanded === g.studentId;
              return (
                <Fragment key={g.studentId}>
                  <tr className="hover:bg-muted/40">
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
                        "Élève supprimé"
                      )}
                    </Td>
                    <Td className="num-display text-right">{g.count}</Td>
                    <Td className="num-display text-right">{moneyShort(g.total)}</Td>
                    <Td className="num-display text-right">{moneyShort(g.pending)}</Td>
                    <Td>
                      {g.pending > 0 ? <Tag tone="partial">À appliquer</Tag> : <Tag tone="ok">Appliqué</Tag>}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : g.studentId)}
                          className="text-[12px] font-medium text-primary hover:underline"
                        >
                          {open ? "Masquer" : "Détail"}
                        </button>
                        {perms.editFinance && g.pending > 0 ? (
                          <button
                            type="button"
                            disabled={settleOne.isPending}
                            onClick={() => confirmSettle(g.studentId, g.pending)}
                            className="text-[12px] font-medium text-primary hover:underline disabled:opacity-60"
                          >
                            Appliquer
                          </button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                  {open ? (
                    <tr>
                      <td colSpan={6} className="bg-muted/30 px-4 py-3">
                        <ul className="divide-y divide-border text-[13px]">
                          {g.items.map((d) => (
                            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                              <span>
                                {dateFr(d.deposit_date)}
                                {d.note ? <span className="ml-2 text-muted-foreground">· {d.note}</span> : null}
                              </span>
                              <span className="flex items-center gap-4">
                                <span className="num-display">{money(d.amount)}</span>
                                {d.settled_at ? (
                                  <Tag tone="ok">Appliqué</Tag>
                                ) : perms.editFinance ? (
                                  <button
                                    type="button"
                                    disabled={removeDeposit.isPending}
                                    onClick={() => {
                                      if (window.confirm("Supprimer ce versement ?")) {
                                        removeDeposit.mutate(d.id);
                                      }
                                    }}
                                    className="text-[12px] font-medium text-destructive hover:underline disabled:opacity-60"
                                  >
                                    Supprimer
                                  </button>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
