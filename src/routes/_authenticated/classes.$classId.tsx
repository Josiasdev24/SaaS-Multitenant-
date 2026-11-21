import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";

import { q, studentAverage, computeFinance, fullName, compareNames } from "@/lib/data";
import { num, moneyShort, pct, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import {
  PageHeader,
  Panel,
  Section,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  KpiGrid,
  Kpi,
  Tag,
  FeeStatusBadge,
  LoadingBlock,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/classes/$classId")({
  head: () => ({
    meta: [
      { title: "Fiche classe" },
      {
        name: "description",
        content: "Détail d'une classe : élèves inscrits, matières enseignées, moyennes et présence.",
      },
      { property: "og:title", content: "Fiche classe" },
      { property: "og:description", content: "Élèves, matières, moyennes et présence de la classe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClassDetail,
});

function ClassDetail() {
  const { classId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const today = todayISO();

  const [
    classes,
    levels,
    students,
    teachers,
    subjects,
    classSubjects,
    grades,
    evaluations,
    attendance,
    studentFees,
    payments,
    fees,
  ] = useQueries({
    queries: [
      q.classes(),
      q.levels(),
      q.students(),
      { ...q.teachers(), enabled: Boolean(perms?.manageStructure || perms?.viewFamilies) },
      q.subjects(),
      q.classSubjects(),
      { ...q.grades(), enabled: Boolean(perms?.viewAcademics) },
      { ...q.evaluations(), enabled: Boolean(perms?.viewAcademics) },
      { ...q.attendance(), enabled: Boolean(perms?.viewAttendance) },
      { ...q.studentFees(), enabled: Boolean(perms?.viewFinance) },
      { ...q.payments(), enabled: Boolean(perms?.viewFinance) },
      { ...q.fees(), enabled: Boolean(perms?.viewFinance) },
    ],
  });

  const klass = (classes.data ?? []).find((c) => c.id === classId);
  const level = levels.data?.find((l) => l.id === klass?.level_id);
  const enrolled = useMemo(
    () =>
      (students.data ?? [])
        .filter((s) => s.class_id === classId && s.status === "actif")
        .sort(compareNames),
    [students.data, classId],
  );

  const rows = useMemo(
    () =>
      enrolled.map((s) => ({
        student: s,
        average: perms?.viewAcademics ? studentAverage(s.id, grades.data ?? [], evaluations.data ?? []) : null,
        absences: (attendance.data ?? []).filter((a) => a.student_id === s.id && a.status === "absent").length,
        finance: perms?.viewFinance
          ? computeFinance(s.id, studentFees.data ?? [], payments.data ?? [], fees.data ?? [], today)
          : null,
      })),
    [enrolled, grades.data, evaluations.data, attendance.data, studentFees.data, payments.data, fees.data, perms, today],
  );

  const classAverage = useMemo(() => {
    const values = rows.map((r) => r.average).filter((v): v is number => v !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }, [rows]);

  const presenceRate = useMemo(() => {
    const rowsA = (attendance.data ?? []).filter((a) => a.class_id === classId);
    if (rowsA.length === 0) return null;
    return (rowsA.filter((a) => a.status === "present").length / rowsA.length) * 100;
  }, [attendance.data, classId]);

  const taught = useMemo(
    () =>
      (classSubjects.data ?? [])
        .filter((cs) => cs.class_id === classId)
        .map((cs) => ({
          id: cs.id,
          subject: subjects.data?.find((s) => s.id === cs.subject_id)?.name ?? "—",
          teacher: teachers.data?.find((t) => t.id === cs.teacher_id) ?? null,
        })),
    [classSubjects.data, subjects.data, teachers.data, classId],
  );

  if (classes.isPending) return <LoadingBlock />;
  if (!klass) {
    return (
      <Panel>
        <p className="text-[15px] font-medium">Classe introuvable</p>
        <Link to="/classes" className="mt-3 inline-block text-[13px] text-primary hover:underline">
          Retour aux classes
        </Link>
      </Panel>
    );
  }

  return (
    <div className="space-y-8 rise">
      <PageHeader
        title={klass.name}
        subtitle={`${level?.name ?? "—"} · Cycle ${level?.cycle ?? "—"}`}
        right={
          <Link to="/classes" className="text-[13px] text-primary hover:underline">
            Retour aux classes
          </Link>
        }
      />

      <KpiGrid>
        <Kpi label="Effectif" value={enrolled.length} hint={klass.capacity ? `Capacité ${klass.capacity}` : "Capacité non définie"} />
        {perms?.viewAcademics ? <Kpi label="Moyenne de classe" value={num(classAverage)} hint="sur 20" /> : null}
        {perms?.viewAttendance ? (
          <Kpi label="Présence" value={presenceRate === null ? "—" : pct(presenceRate)} hint="sur les relevés enregistrés" />
        ) : null}
        <Kpi label="Matières" value={taught.length} hint="au programme de la classe" />
      </KpiGrid>

      <Section title="Matières et enseignants">
        <TableWrap minWidth={420}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Matière</Th>
              <Th>Enseignant</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {taught.length === 0 ? (
              <EmptyRow colSpan={2} label="Aucune matière affectée à cette classe." />
            ) : (
              taught.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <Td className="font-medium">{t.subject}</Td>
                  <Td className="text-muted-foreground">{t.teacher ? fullName(t.teacher) : "Non affecté"}</Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </Section>

      <Section title="Élèves de la classe">
        <TableWrap minWidth={640} footer={<span>{rows.length} élève(s)</span>}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Matricule</Th>
              <Th>Élève</Th>
              {perms?.viewAcademics ? <Th className="text-right">Moyenne</Th> : null}
              {perms?.viewAttendance ? <Th className="text-right">Absences</Th> : null}
              {perms?.viewFinance ? <Th className="text-right">Reste</Th> : null}
              {perms?.viewFinance ? <Th>Écolage</Th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <EmptyRow colSpan={6} label="Aucun élève inscrit dans cette classe." />
            ) : (
              rows.map((r) => (
                <tr key={r.student.id} className="hover:bg-muted/40">
                  <Td className="num-display text-muted-foreground">{r.student.matricule}</Td>
                  <Td>
                    <Link
                      to="/eleves/$studentId"
                      params={{ studentId: r.student.id }}
                      className="font-medium hover:underline"
                    >
                      {fullName(r.student)}
                    </Link>
                  </Td>
                  {perms?.viewAcademics ? (
                    <Td className="num-display text-right">
                      {r.average === null ? "—" : num(r.average)}
                      {r.average !== null && r.average < 10 ? (
                        <span className="ml-2 align-middle">
                          <Tag tone="late">Alerte</Tag>
                        </span>
                      ) : null}
                    </Td>
                  ) : null}
                  {perms?.viewAttendance ? <Td className="num-display text-right">{r.absences}</Td> : null}
                  {perms?.viewFinance ? (
                    <Td className="num-display text-right">{r.finance ? moneyShort(r.finance.remaining) : "—"}</Td>
                  ) : null}
                  {perms?.viewFinance ? (
                    <Td>{r.finance ? <FeeStatusBadge status={r.finance.status} /> : null}</Td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </Section>
    </div>
  );
}
