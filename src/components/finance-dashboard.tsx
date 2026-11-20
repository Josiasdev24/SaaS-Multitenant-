import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { q, computeFinance } from "@/lib/data";
import { money, moneyShort, pct, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { academicMonths, monthOf } from "@/lib/months";
import { methodLabel } from "@/lib/payment-methods";
import { ledgerQuery, tontineQuery } from "@/lib/ledger";
import { adjustmentsQuery } from "@/lib/adjustments";
import {
  PageHeader,
  Section,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  NoAccess,
  KpiGrid,
  Kpi,
  Meter,
} from "@/components/kit";

const filterClass =
  "h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((s, i) => s + pick(i), 0);
}

function groupTotals<T>(items: T[], key: (item: T) => string, amount: (item: T) => number) {
  const map = new Map<string, { total: number; count: number }>();
  for (const i of items) {
    const k = key(i);
    const cur = map.get(k) ?? { total: 0, count: 0 };
    cur.total += amount(i);
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
}

export function FinanceDashboard() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const enabled = Boolean(perms?.viewFinance);
  const today = todayISO();
  const months = useMemo(() => academicMonths(today), [today]);
  const [period, setPeriod] = useState("all");

  const [students, classes, fees, studentFees, payments, incomes, expenses, deposits, adjustments] =
    useQueries({
      queries: [
        { ...q.students(), enabled },
        { ...q.classes(), enabled },
        { ...q.fees(), enabled },
        { ...q.studentFees(), enabled },
        { ...q.payments(), enabled },
        { ...ledgerQuery("incomes"), enabled },
        { ...ledgerQuery("expenses"), enabled },
        { ...tontineQuery, enabled },
        { ...adjustmentsQuery, enabled },
      ],
    });

  const inPeriod = (date: string) => period === "all" || monthOf(date) === period;

  const data = useMemo(() => {
    const pay = (payments.data ?? []).filter((p) => inPeriod(p.paid_at));
    const inc = (incomes.data ?? []).filter((i) => inPeriod(i.date));
    const exp = (expenses.data ?? []).filter((e) => inPeriod(e.date));

    const tuition = sumBy(pay, (p) => Number(p.amount));
    const otherIncome = sumBy(inc, (i) => i.amount);
    const spent = sumBy(exp, (e) => e.amount);

    // Situation de l'écolage (indépendante de la période) : élèves actifs.
    const active = (students.data ?? []).filter((s) => s.status === "actif");
    const perStudent = active.map((s) => ({
      student: s,
      f: computeFinance(s.id, studentFees.data ?? [], payments.data ?? [], fees.data ?? []),
    }));
    const due = sumBy(perStudent, (r) => r.f.due);
    const paid = sumBy(perStudent, (r) => r.f.paid);
    const remaining = sumBy(perStudent, (r) => r.f.remaining);

    const byClass = (classes.data ?? [])
      .map((c) => {
        const rows = perStudent.filter((r) => r.student.class_id === c.id);
        return {
          id: c.id,
          name: c.name,
          students: rows.length,
          due: sumBy(rows, (r) => r.f.due),
          paid: sumBy(rows, (r) => r.f.paid),
          remaining: sumBy(rows, (r) => r.f.remaining),
        };
      })
      .filter((c) => c.students > 0);

    const monthly = months.map((m) => {
      const t = sumBy(
        (payments.data ?? []).filter((p) => monthOf(p.paid_at) === m.key),
        (p) => Number(p.amount),
      );
      const o = sumBy(
        (incomes.data ?? []).filter((i) => monthOf(i.date) === m.key),
        (i) => i.amount,
      );
      const s = sumBy(
        (expenses.data ?? []).filter((e) => monthOf(e.date) === m.key),
        (e) => e.amount,
      );
      return { ...m, tuition: t, other: o, spent: s, balance: t + o - s };
    });

    const adj = adjustments.data ?? [];
    return {
      tuition,
      otherIncome,
      spent,
      entries: tuition + otherIncome,
      balance: tuition + otherIncome - spent,
      due,
      paid,
      remaining,
      rate: due > 0 ? (paid / due) * 100 : 0,
      byMethod: groupTotals(pay, (p) => methodLabel(p.method), (p) => Number(p.amount)),
      incomeByCategory: groupTotals(inc, (i) => i.category, (i) => i.amount),
      expenseByCategory: groupTotals(exp, (e) => e.category, (e) => e.amount),
      byClass,
      monthly,
      tontinePending: sumBy(
        (deposits.data ?? []).filter((d) => !d.settled_at),
        (d) => d.amount,
      ),
      reductions: sumBy(adj.filter((a) => a.kind === "reduction_familiale"), (a) => a.amount),
      scholarships: sumBy(adj.filter((a) => a.kind === "bourse"), (a) => a.amount),
      arrears: sumBy(adj.filter((a) => a.kind === "arriere"), (a) => a.amount),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    payments.data,
    incomes.data,
    expenses.data,
    students.data,
    studentFees.data,
    fees.data,
    classes.data,
    deposits.data,
    adjustments.data,
    months,
    period,
  ]);

  if (!perms) return <LoadingBlock />;
  if (!perms.viewFinance) return <NoAccess />;
  if (students.isPending || payments.isPending) return <LoadingBlock />;

  const periodLabel =
    period === "all" ? "toute l'année" : (months.find((m) => m.key === period)?.label ?? "");
  const maxMonthly = Math.max(1, ...data.monthly.map((m) => m.tuition + m.other));

  return (
    <div className="space-y-8 rise">
      <PageHeader
        title="Tableau financier"
        subtitle="Entrées, dépenses et solde de l'établissement."
        right={
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Période"
            className={filterClass}
          >
            <option value="all">Toute l'année</option>
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        }
      />

      <KpiGrid>
        <Kpi label="Écolage encaissé" value={money(data.tuition)} hint={periodLabel} />
        <Kpi label="Autres recettes" value={money(data.otherIncome)} hint={periodLabel} />
        <Kpi label="Dépenses" value={money(data.spent)} hint={periodLabel} />
        <Kpi
          label="Solde"
          value={money(data.balance)}
          hint={`entrées ${money(data.entries)} − dépenses`}
        />
      </KpiGrid>

      <Section title="Situation de l'écolage (élèves actifs)">
        <KpiGrid>
          <Kpi label="Attendu" value={money(data.due)} />
          <Kpi label="Encaissé" value={money(data.paid)} hint={`Recouvrement ${pct(data.rate)}`}>
            <Meter
              segments={[
                { value: data.paid, className: "bg-ok" },
                { value: Math.max(data.due - data.paid, 0), className: "bg-late/40" },
              ]}
            />
          </Kpi>
          <Kpi label="Reste à payer" value={money(data.remaining)} />
          <Kpi
            label="Tontine à appliquer"
            value={money(data.tontinePending)}
            hint="versements pas encore déduits"
          />
        </KpiGrid>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Ajustements accordés : réductions familiales {money(data.reductions)} · bourses{" "}
          {money(data.scholarships)} · arriérés ajoutés {money(data.arrears)}.
        </p>
      </Section>

      <Section title="Mois par mois">
        <TableWrap minWidth={720}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Mois</Th>
              <Th className="text-right">Écolage</Th>
              <Th className="text-right">Autres recettes</Th>
              <Th className="text-right">Dépenses</Th>
              <Th className="text-right">Solde</Th>
              <Th>Entrées</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.monthly.map((m) => (
              <tr key={m.key} className="hover:bg-muted/40">
                <Td className="font-medium">{m.label}</Td>
                <Td className="num-display text-right">{moneyShort(m.tuition)}</Td>
                <Td className="num-display text-right">{moneyShort(m.other)}</Td>
                <Td className="num-display text-right">{moneyShort(m.spent)}</Td>
                <Td
                  className={`num-display text-right font-medium ${m.balance < 0 ? "text-late" : ""}`}
                >
                  {moneyShort(m.balance)}
                </Td>
                <Td>
                  <div className="h-2 w-full min-w-[80px] rounded bg-muted">
                    <div
                      className="h-2 rounded bg-primary"
                      style={{ width: `${((m.tuition + m.other) / maxMonthly) * 100}%` }}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Écolage par mode de paiement">
          <TableWrap minWidth={260}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Mode</Th>
                <Th className="text-right">Paiements</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.byMethod.length === 0 ? (
                <EmptyRow colSpan={3} label="Aucun paiement." />
              ) : (
                data.byMethod.map(([name, v]) => (
                  <tr key={name} className="hover:bg-muted/40">
                    <Td className="font-medium">{name}</Td>
                    <Td className="num-display text-right">{v.count}</Td>
                    <Td className="num-display text-right">{moneyShort(v.total)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Section>

        <Section title="Recettes par catégorie">
          <TableWrap minWidth={260}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Catégorie</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.incomeByCategory.length === 0 ? (
                <EmptyRow colSpan={2} label="Aucune recette." />
              ) : (
                data.incomeByCategory.map(([name, v]) => (
                  <tr key={name} className="hover:bg-muted/40">
                    <Td className="font-medium">{name}</Td>
                    <Td className="num-display text-right">{moneyShort(v.total)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Section>

        <Section title="Dépenses par catégorie">
          <TableWrap minWidth={260}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Catégorie</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.expenseByCategory.length === 0 ? (
                <EmptyRow colSpan={2} label="Aucune dépense." />
              ) : (
                data.expenseByCategory.map(([name, v]) => (
                  <tr key={name} className="hover:bg-muted/40">
                    <Td className="font-medium">{name}</Td>
                    <Td className="num-display text-right">{moneyShort(v.total)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Section>
      </div>

      <Section title="Écolage par classe">
        <TableWrap minWidth={640}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Classe</Th>
              <Th className="text-right">Élèves</Th>
              <Th className="text-right">Attendu</Th>
              <Th className="text-right">Encaissé</Th>
              <Th className="text-right">Reste</Th>
              <Th className="text-right">Recouvrement</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.byClass.length === 0 ? (
              <EmptyRow colSpan={6} label="Aucune classe." />
            ) : (
              data.byClass.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <Td className="font-medium">{c.name}</Td>
                  <Td className="num-display text-right">{c.students}</Td>
                  <Td className="num-display text-right">{moneyShort(c.due)}</Td>
                  <Td className="num-display text-right">{moneyShort(c.paid)}</Td>
                  <Td className="num-display text-right">{moneyShort(c.remaining)}</Td>
                  <Td className="num-display text-right">
                    {c.due > 0 ? pct((c.paid / c.due) * 100) : "—"}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </Section>
    </div>
  );
}
