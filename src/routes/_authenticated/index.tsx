import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";

import { q, computeFinance, studentAverage, fullName, type FeeStatus } from "@/lib/data";
import { money, moneyShort, num, pct, dateFr, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import {
  PageHeader,
  KpiGrid,
  Kpi,
  Meter,
  Section,
  Panel,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  FeeStatusBadge,
  Tag,
  LoadingBlock,
  BarChartStacked,
  LineChartSimple,
  Legend,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord" },
      {
        name: "description",
        content:
          "Vue d'ensemble de l'établissement : effectifs, présence, moyennes de classe et recouvrement de l'écolage.",
      },
      { property: "og:title", content: "Tableau de bord" },
      {
        property: "og:description",
        content: "Effectifs, présence, moyennes et recouvrement de l'écolage en un coup d'œil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const today = todayISO();

  const [students, classes, teachers, levels, attendance, grades, evaluations, studentFees, payments, fees] =
    useQueries({
      queries: [
        q.students(),
        q.classes(),
        { ...q.teachers(), enabled: Boolean(perms?.manageStructure || perms?.viewFamilies) },
        q.levels(),
        { ...q.attendance(), enabled: Boolean(perms?.viewAttendance) },
        { ...q.grades(), enabled: Boolean(perms?.viewAcademics) },
        { ...q.evaluations(), enabled: Boolean(perms?.viewAcademics) },
        { ...q.studentFees(), enabled: Boolean(perms?.viewFinance) },
        { ...q.payments(), enabled: Boolean(perms?.viewFinance) },
        { ...q.fees(), enabled: Boolean(perms?.viewFinance) },
      ],
    });

  const studentRows = students.data ?? [];
  const activeStudents = studentRows.filter((s) => s.status === "actif");

  const finance = useMemo(() => {
    if (!perms?.viewFinance) return null;
    const sf = studentFees.data ?? [];
    const pay = payments.data ?? [];
    const feeList = fees.data ?? [];
    const counts: Record<FeeStatus, number> = { ajour: 0, partiel: 0, retard: 0, impaye: 0 };
    let due = 0;
    let paid = 0;
    const late: { id: string; name: string; className: string; remaining: number; status: FeeStatus }[] = [];
    for (const s of activeStudents) {
      const f = computeFinance(s.id, sf, pay, feeList, today);
      counts[f.status] += 1;
      due += f.due;
      paid += f.paid;
      if (f.status === "retard") {
        late.push({
          id: s.id,
          name: fullName(s),
          className: classes.data?.find((c) => c.id === s.class_id)?.name ?? "—",
          remaining: f.remaining,
          status: f.status,
        });
      }
    }
    late.sort((a, b) => b.remaining - a.remaining);
    return { counts, due, paid, remaining: Math.max(due - paid, 0), late };
  }, [perms?.viewFinance, studentFees.data, payments.data, fees.data, activeStudents, classes.data, today]);

  const attendanceStats = useMemo(() => {
    const rows = attendance.data ?? [];
    if (rows.length === 0) return null;
    const present = rows.filter((r) => r.status === "present").length;
    const absent = rows.filter((r) => r.status === "absent").length;
    const lateCount = rows.filter((r) => r.status === "retard").length;
    const days = Array.from(new Set(rows.map((r) => r.attendance_date))).sort().slice(-6);
    const series = days.map((d) => {
      const dayRows = rows.filter((r) => r.attendance_date === d);
      const p = dayRows.filter((r) => r.status === "present").length;
      return dayRows.length ? (p / dayRows.length) * 100 : 0;
    });
    const byStudent = new Map<string, number>();
    for (const r of rows) {
      if (r.status === "absent") byStudent.set(r.student_id, (byStudent.get(r.student_id) ?? 0) + 1);
    }
    const frequent = [...byStudent.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    return {
      rate: rows.length ? (present / rows.length) * 100 : 0,
      absent,
      lateCount,
      days,
      series,
      frequent,
    };
  }, [attendance.data]);

  const classAverages = useMemo(() => {
    if (!perms?.viewAcademics) return [];
    const g = grades.data ?? [];
    const evals = evaluations.data ?? [];
    return (classes.data ?? [])
      .map((c) => {
        const ids = new Set(studentRows.filter((s) => s.class_id === c.id).map((s) => s.id));
        const values = [...ids]
          .map((id) => studentAverage(id, g, evals))
          .filter((v): v is number => v !== null);
        return {
          id: c.id,
          name: c.name,
          count: ids.size,
          average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
        };
      })
      .filter((c) => c.count > 0)
      .sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  }, [perms?.viewAcademics, grades.data, evaluations.data, classes.data, studentRows]);

  if (students.isPending) return <LoadingBlock />;

  const recovery = finance && finance.due > 0 ? (finance.paid / finance.due) * 100 : 0;

  return (
    <div className="space-y-8 rise">
      <PageHeader
        title="Tableau de bord"
        subtitle={`Situation au ${dateFr(today)} · ${activeStudents.length} élèves inscrits`}
      />

      <KpiGrid>
        <Kpi
          label="Élèves actifs"
          value={activeStudents.length}
          hint={`${activeStudents.filter((s) => s.gender === "F").length} filles · ${activeStudents.filter((s) => s.gender === "M").length} garçons`}
        />
        <Kpi
          label="Classes"
          value={(classes.data ?? []).filter((c) => !c.is_archived).length}
          hint={`${(levels.data ?? []).length} niveaux couverts`}
        />
        {perms?.manageStructure || perms?.viewFamilies ? (
          <Kpi
            label="Enseignants"
            value={(teachers.data ?? []).length}
            hint={`${(teachers.data ?? []).filter((t) => t.status === "actif").length} en activité`}
          />
        ) : null}
        {perms?.viewAttendance && attendanceStats ? (
          <Kpi
            label="Taux de présence"
            value={pct(attendanceStats.rate)}
            hint={`${attendanceStats.absent} absences · ${attendanceStats.lateCount} retards`}
          />
        ) : null}
        {perms?.viewFinance && finance ? (
          <>
            <Kpi label="Écolage encaissé" value={moneyShort(finance.paid)} hint={`sur ${money(finance.due)} attendus`}>
              <Meter
                segments={[
                  { value: finance.paid, className: "bg-ok" },
                  { value: finance.remaining, className: "bg-late/40" },
                ]}
              />
            </Kpi>
            <Kpi label="Reste à recouvrer" value={moneyShort(finance.remaining)} hint={`Recouvrement ${pct(recovery)}`} />
            <Kpi
              label="Élèves en retard"
              value={finance.counts.retard}
              hint={`${finance.counts.ajour} à jour · ${finance.counts.partiel} partiels`}
            />
          </>
        ) : null}
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        {perms?.viewAttendance && attendanceStats ? (
          <Panel>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">Présence des derniers jours</h2>
              <span className="text-[12px] text-muted-foreground">en % de présents</span>
            </div>
            <LineChartSimple
              series={[{ points: attendanceStats.series, className: "text-primary" }]}
              labels={attendanceStats.days.map((d) => dateFr(d).slice(0, 6))}
            />
            <Legend items={[{ label: "Taux de présence", className: "bg-primary", line: true }]} />
          </Panel>
        ) : null}

        {perms?.viewFinance && finance ? (
          <Panel>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">Situation de l'écolage</h2>
              <Link to="/ecolage" className="text-[12px] text-primary hover:underline">
                Voir le détail
              </Link>
            </div>
            <BarChartStacked
              bars={[
                { top: finance.counts.ajour, bottom: 0 },
                { top: finance.counts.partiel, bottom: 0 },
                { top: 0, bottom: finance.counts.retard },
                { top: 0, bottom: finance.counts.impaye },
              ]}
              labels={["À jour", "Partiels", "En retard", "Non payés"]}
            />
            <Legend
              items={[
                { label: "Réguliers", className: "bg-primary" },
                { label: "Situation à traiter", className: "bg-late" },
              ]}
            />
          </Panel>
        ) : null}
      </div>

      {perms?.viewAcademics ? (
        <Section
          title="Moyennes par classe"
          action={
            <Link to="/notes" className="text-[12px] text-primary hover:underline">
              Saisir des notes
            </Link>
          }
        >
          <TableWrap minWidth={520} footer={<span>{classAverages.length} classes évaluées</span>}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Classe</Th>
                <Th>Effectif</Th>
                <Th className="text-right">Moyenne /20</Th>
                <Th>Appréciation</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {classAverages.length === 0 ? (
                <EmptyRow colSpan={4} label="Aucune évaluation enregistrée." />
              ) : (
                classAverages.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <Td>
                      <Link to="/classes/$classId" params={{ classId: c.id }} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">{c.count}</Td>
                    <Td className="num-display text-right text-[15px]">{num(c.average)}</Td>
                    <Td>
                      {c.average === null ? (
                        <Tag>Non évaluée</Tag>
                      ) : c.average >= 12 ? (
                        <Tag tone="ok">Satisfaisant</Tag>
                      ) : c.average >= 10 ? (
                        <Tag tone="partial">Passable</Tag>
                      ) : (
                        <Tag tone="late">À renforcer</Tag>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {perms?.viewFinance && finance ? (
          <Section
            title="Alertes de paiement"
            action={
              <Link to="/alertes" className="text-[12px] text-primary hover:underline">
                Toutes les alertes
              </Link>
            }
          >
            <TableWrap minWidth={420}>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <Th>Élève</Th>
                  <Th>Classe</Th>
                  <Th className="text-right">Reste</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {finance.late.length === 0 ? (
                  <EmptyRow colSpan={4} label="Aucun retard de paiement." />
                ) : (
                  finance.late.slice(0, 6).map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <Td>
                        <Link to="/eleves/$studentId" params={{ studentId: r.id }} className="font-medium hover:underline">
                          {r.name}
                        </Link>
                      </Td>
                      <Td className="text-muted-foreground">{r.className}</Td>
                      <Td className="num-display text-right">{moneyShort(r.remaining)}</Td>
                      <Td className="text-right">
                        <FeeStatusBadge status={r.status} />
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>
          </Section>
        ) : null}

        {perms?.viewAttendance && attendanceStats ? (
          <Section
            title="Absences répétées"
            action={
              <Link to="/absences" className="text-[12px] text-primary hover:underline">
                Registre des absences
              </Link>
            }
          >
            <TableWrap minWidth={380}>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <Th>Élève</Th>
                  <Th>Classe</Th>
                  <Th className="text-right">Absences</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendanceStats.frequent.length === 0 ? (
                  <EmptyRow colSpan={3} label="Aucune absence répétée." />
                ) : (
                  attendanceStats.frequent.map(([id, count]) => {
                    const s = studentRows.find((x) => x.id === id);
                    return (
                      <tr key={id} className="hover:bg-muted/40">
                        <Td>
                          <Link to="/eleves/$studentId" params={{ studentId: id }} className="font-medium hover:underline">
                            {s ? fullName(s) : "Élève"}
                          </Link>
                        </Td>
                        <Td className="text-muted-foreground">
                          {classes.data?.find((c) => c.id === s?.class_id)?.name ?? "—"}
                        </Td>
                        <Td className="num-display text-right">{count}</Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </TableWrap>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
