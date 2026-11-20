import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";

import { q, fullName, computeFinance, studentAverage } from "@/lib/data";
import { money, num } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import {
  PageHeader,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  Section,
  NoAccess,
  Kpi,
  KpiGrid,
  FeeStatusBadge,
  Tag,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/alertes/")({
  head: () => ({
    meta: [
      { title: "Alertes — Complexe Scolaire Omarus Adodo" },
      { name: "description", content: "Alertes automatiques : impayés, absentéisme et difficultés scolaires." },
      { property: "og:title", content: "Alertes — Complexe Scolaire Omarus Adodo" },
      { property: "og:description", content: "Impayés, absentéisme et élèves en difficulté à suivre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;

  const [students, classes, classSubjects, studentFees, payments, fees, attendance, grades, evaluations, settings] =
    useQueries({
      queries: [
        q.students(),
        q.classes(),
        q.classSubjects(),
        { ...q.studentFees(), enabled: Boolean(perms?.viewFinance) },
        { ...q.payments(), enabled: Boolean(perms?.viewFinance) },
        { ...q.fees(), enabled: Boolean(perms?.viewFinance) },
        { ...q.attendance(), enabled: Boolean(perms?.viewAttendance) },
        { ...q.grades(), enabled: Boolean(perms?.viewAcademics) },
        { ...q.evaluations(), enabled: Boolean(perms?.viewAcademics) },
        q.settings(),
      ],
    });

  const threshold = settings.data?.absence_threshold ?? 5;

  const scope = useMemo(() => {
    const actives = (students.data ?? []).filter((s) => s.status === "actif");
    if (!perms?.ownClassesOnly || !user?.teacherId) return actives;
    const mine = new Set(
      (classes.data ?? [])
        .filter(
          (c) =>
            c.main_teacher_id === user.teacherId ||
            (classSubjects.data ?? []).some((cs) => cs.class_id === c.id && cs.teacher_id === user.teacherId),
        )
        .map((c) => c.id),
    );
    return actives.filter((s) => s.class_id && mine.has(s.class_id));
  }, [students.data, classes.data, classSubjects.data, perms?.ownClassesOnly, user?.teacherId]);

  const className = (id: string | null) => classes.data?.find((c) => c.id === id)?.name ?? "—";

  const financeAlerts = useMemo(() => {
    if (!perms?.viewFinance) return [];
    return scope
      .map((s) => ({ s, f: computeFinance(s.id, studentFees.data ?? [], payments.data ?? [], fees.data ?? []) }))
      .filter((r) => r.f.status === "retard" || r.f.status === "impaye")
      .sort((a, b) => b.f.remaining - a.f.remaining);
  }, [scope, studentFees.data, payments.data, fees.data, perms?.viewFinance]);

  const absenceAlerts = useMemo(() => {
    if (!perms?.viewAttendance) return [];
    return scope
      .map((s) => ({
        s,
        absences: (attendance.data ?? []).filter((a) => a.student_id === s.id && a.status === "absent").length,
        lates: (attendance.data ?? []).filter((a) => a.student_id === s.id && a.status === "retard").length,
      }))
      .filter((r) => r.absences >= threshold)
      .sort((a, b) => b.absences - a.absences);
  }, [scope, attendance.data, threshold, perms?.viewAttendance]);

  const academicAlerts = useMemo(() => {
    if (!perms?.viewAcademics) return [];
    return scope
      .map((s) => ({ s, avg: studentAverage(s.id, grades.data ?? [], evaluations.data ?? []) }))
      .filter((r) => r.avg !== null && r.avg < 10)
      .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0));
  }, [scope, grades.data, evaluations.data, perms?.viewAcademics]);

  if (!perms) return <LoadingBlock />;
  if (students.isPending) return <LoadingBlock />;
  if (!perms.viewFinance && !perms.viewAttendance && !perms.viewAcademics) return <NoAccess />;

  const totalOwed = financeAlerts.reduce((s, r) => s + r.f.remaining, 0);

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Alertes"
        subtitle={`Suivi automatique — seuil d'absences : ${threshold}`}
      />

      <KpiGrid>
        {perms.viewFinance ? <Kpi label="Dossiers en retard" value={financeAlerts.length} /> : null}
        {perms.viewFinance ? <Kpi label="Montant à recouvrer" value={money(totalOwed)} /> : null}
        {perms.viewAttendance ? <Kpi label="Absentéisme" value={absenceAlerts.length} hint={`≥ ${threshold} absences`} /> : null}
        {perms.viewAcademics ? <Kpi label="Difficultés scolaires" value={academicAlerts.length} hint="Moyenne < 10" /> : null}
      </KpiGrid>

      {perms.viewFinance ? (
        <Section title="Impayés & retards de paiement">
          <TableWrap minWidth={720}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Élève</Th>
                <Th>Classe</Th>
                <Th>Statut</Th>
                <Th className="text-right">Payé</Th>
                <Th className="text-right">Reste à payer</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {financeAlerts.length === 0 ? (
                <EmptyRow colSpan={5} label="Aucun retard de paiement. " />
              ) : (
                financeAlerts.map((r) => (
                  <tr key={r.s.id} className="hover:bg-muted/40">
                    <Td>
                      <Link to="/eleves/$studentId" params={{ studentId: r.s.id }} className="font-medium hover:underline">
                        {fullName(r.s)}
                      </Link>
                      <div className="num-display text-[11px] text-faint">{r.s.matricule}</div>
                    </Td>
                    <Td className="text-muted-foreground">{className(r.s.class_id)}</Td>
                    <Td><FeeStatusBadge status={r.f.status} /></Td>
                    <Td className="num-display text-right text-muted-foreground">{money(r.f.paid)}</Td>
                    <Td className="num-display text-right font-medium text-late">{money(r.f.remaining)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      {perms.viewAttendance ? (
        <Section title={`Absentéisme (≥ ${threshold} absences)`}>
          <TableWrap minWidth={560}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Élève</Th>
                <Th>Classe</Th>
                <Th className="text-right">Absences</Th>
                <Th className="text-right">Retards</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {absenceAlerts.length === 0 ? (
                <EmptyRow colSpan={4} label="Aucun élève au-delà du seuil." />
              ) : (
                absenceAlerts.map((r) => (
                  <tr key={r.s.id} className="hover:bg-muted/40">
                    <Td>
                      <Link to="/eleves/$studentId" params={{ studentId: r.s.id }} className="font-medium hover:underline">
                        {fullName(r.s)}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">{className(r.s.class_id)}</Td>
                    <Td className="num-display text-right font-medium text-late">{r.absences}</Td>
                    <Td className="num-display text-right text-muted-foreground">{r.lates}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      {perms.viewAcademics ? (
        <Section title="Élèves en difficulté (moyenne < 10)">
          <TableWrap minWidth={480}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Élève</Th>
                <Th>Classe</Th>
                <Th className="text-right">Moyenne /20</Th>
                <Th>Niveau</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {academicAlerts.length === 0 ? (
                <EmptyRow colSpan={4} label="Aucun élève en difficulté." />
              ) : (
                academicAlerts.map((r) => (
                  <tr key={r.s.id} className="hover:bg-muted/40">
                    <Td>
                      <Link to="/eleves/$studentId" params={{ studentId: r.s.id }} className="font-medium hover:underline">
                        {fullName(r.s)}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">{className(r.s.class_id)}</Td>
                    <Td className="num-display text-right font-medium">{num(r.avg)}</Td>
                    <Td>
                      <Tag tone={(r.avg ?? 0) < 8 ? "late" : "partial"}>
                        {(r.avg ?? 0) < 8 ? "Critique" : "À surveiller"}
                      </Tag>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}
    </div>
  );
}
