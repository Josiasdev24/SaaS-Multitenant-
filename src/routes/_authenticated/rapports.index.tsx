import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";

import { q, fullName, averageOn20, computeFinance } from "@/lib/data";
import { money, num, pct } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
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
  Tag,
} from "@/components/kit";
import { PrintHeader } from "@/components/print-header";

const printCss = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body * { visibility: hidden !important; }
  #report-sheet, #report-sheet * { visibility: visible !important; }
  #report-sheet { position: absolute; inset: 0; width: 100%; }
  #report-sheet .print-hidden { display: none !important; }
  #report-sheet table { color: black !important; }
  #report-sheet tr { break-inside: avoid; }
}
`;

export const Route = createFileRoute("/_authenticated/rapports/")({
  head: () => ({
    meta: [
      { title: "Rapports & bulletins — Complexe Scolaire Omarus Adodo" },
      { name: "description", content: "Bulletins trimestriels par classe, classements, moyennes par matière et synthèses financières." },
      { property: "og:title", content: "Rapports & bulletins — Complexe Scolaire Omarus Adodo" },
      { property: "og:description", content: "Bulletins par classe et trimestre, classements et synthèses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;

  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");

  const [classes, terms, students, subjects, evaluations, grades, attendance, studentFees, payments, fees] =
    useQueries({
      queries: [
        q.classes(),
        q.terms(),
        q.students(),
        q.subjects(),
        { ...q.evaluations(), enabled: Boolean(perms?.viewAcademics) },
        { ...q.grades(), enabled: Boolean(perms?.viewAcademics) },
        { ...q.attendance(), enabled: Boolean(perms?.viewAttendance) },
        { ...q.studentFees(), enabled: Boolean(perms?.viewFinance) },
        { ...q.payments(), enabled: Boolean(perms?.viewFinance) },
        { ...q.fees(), enabled: Boolean(perms?.viewFinance) },
      ],
    });

  useEffect(() => {
    if (!classId && classes.data?.length) setClassId(classes.data[0]!.id);
  }, [classes.data, classId]);
  useEffect(() => {
    if (!termId && terms.data?.length) setTermId(terms.data[0]!.id);
  }, [terms.data, termId]);

  const termEvals = useMemo(
    () => (evaluations.data ?? []).filter((e) => e.class_id === classId && e.term_id === termId),
    [evaluations.data, classId, termId],
  );

  const roster = useMemo(
    () => (students.data ?? []).filter((s) => s.class_id === classId && s.status === "actif"),
    [students.data, classId],
  );

  const bulletins = useMemo(() => {
    const evalIds = new Set(termEvals.map((e) => e.id));
    const termGrades = (grades.data ?? []).filter((g) => evalIds.has(g.evaluation_id));
    return roster
      .map((s) => {
        const own = termGrades.filter((g) => g.student_id === s.id);
        const avg = averageOn20(own, termEvals);
        const absences = (attendance.data ?? []).filter(
          (a) => a.student_id === s.id && a.status === "absent",
        ).length;
        const finance = perms?.viewFinance
          ? computeFinance(s.id, studentFees.data ?? [], payments.data ?? [], fees.data ?? [])
          : null;
        return { student: s, avg, count: own.length, absences, finance };
      })
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  }, [roster, termEvals, grades.data, attendance.data, studentFees.data, payments.data, fees.data, perms?.viewFinance]);

  const bySubject = useMemo(() => {
    return (subjects.data ?? [])
      .map((sub) => {
        const evs = termEvals.filter((e) => e.subject_id === sub.id);
        const evalIds = new Set(evs.map((e) => e.id));
        const avg = averageOn20((grades.data ?? []).filter((g) => evalIds.has(g.evaluation_id)), evs);
        return { subject: sub, evalCount: evs.length, avg };
      })
      .filter((r) => r.evalCount > 0)
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  }, [subjects.data, termEvals, grades.data]);

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics && !perms.viewFinance) return <NoAccess />;
  if (classes.isPending || terms.isPending) return <LoadingBlock />;

  const withAvg = bulletins.filter((b) => b.avg !== null);
  const classAvg = withAvg.length ? withAvg.reduce((s, b) => s + (b.avg ?? 0), 0) / withAvg.length : null;
  const successRate = withAvg.length
    ? (withAvg.filter((b) => (b.avg ?? 0) >= 10).length / withAvg.length) * 100
    : 0;
  const className = classes.data?.find((c) => c.id === classId)?.name ?? "—";
  const termName = terms.data?.find((t) => t.id === termId)?.name ?? "—";

  return (
    <div id="report-sheet" className="space-y-6 rise">
      <style>{printCss}</style>
      <PrintHeader className="hidden print:flex" />
      <div className="print-hidden">
        <PageHeader
          title="Rapports & bulletins"
          subtitle={`Synthèse ${className} — ${termName}`}
          right={
            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted"
            >
              Imprimer
            </button>
          }
        />
      </div>

      <Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="r-class" className="label-caps">Classe</label>
            <select id="r-class" value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
              {(classes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="r-term" className="label-caps">Trimestre</label>
            <select id="r-term" value={termId} onChange={(e) => setTermId(e.target.value)} className={inputClass}>
              {(terms.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Panel>

      <KpiGrid>
        <Kpi label="Effectif" value={roster.length} />
        <Kpi label="Moyenne de classe" value={num(classAvg)} hint="Sur 20" />
        <Kpi label="Taux de réussite" value={pct(successRate)} hint="Moyenne ≥ 10" />
        <Kpi label="Évaluations" value={termEvals.length} />
      </KpiGrid>

      {perms.viewAcademics ? (
        <Section title="Classement des élèves">
          <TableWrap minWidth={720} footer={<span>{bulletins.length} bulletins</span>}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th className="text-right">Rang</Th>
                <Th>Élève</Th>
                <Th className="text-right">Moyenne</Th>
                <Th className="text-right">Notes</Th>
                <Th className="text-right">Absences</Th>
                <Th>Appréciation</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bulletins.length === 0 ? (
                <EmptyRow colSpan={6} label="Aucun élève pour cette sélection." />
              ) : (
                bulletins.map((b, i) => (
                  <tr key={b.student.id} className="hover:bg-muted/40">
                    <Td className="num-display text-right text-muted-foreground">{b.avg === null ? "—" : i + 1}</Td>
                    <Td>
                      <Link to="/eleves/$studentId" params={{ studentId: b.student.id }} className="font-medium hover:underline">
                        {fullName(b.student)}
                      </Link>
                      <div className="num-display text-[11px] text-faint">{b.student.matricule}</div>
                    </Td>
                    <Td className="num-display text-right font-medium">{num(b.avg)}</Td>
                    <Td className="num-display text-right text-muted-foreground">{b.count}</Td>
                    <Td className="num-display text-right text-muted-foreground">{b.absences}</Td>
                    <Td>
                      <Tag tone={appreciationTone(b.avg)}>{appreciation(b.avg)}</Tag>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      {perms.viewAcademics ? (
        <Section title="Moyennes par matière">
          <TableWrap minWidth={480}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Matière</Th>
                <Th className="text-right">Évaluations</Th>
                <Th className="text-right">Moyenne /20</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bySubject.length === 0 ? (
                <EmptyRow colSpan={3} label="Aucune évaluation sur ce trimestre." />
              ) : (
                bySubject.map((r) => (
                  <tr key={r.subject.id} className="hover:bg-muted/40">
                    <Td className="font-medium">{r.subject.name}</Td>
                    <Td className="num-display text-right text-muted-foreground">{r.evalCount}</Td>
                    <Td className="num-display text-right">{num(r.avg)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      {perms.viewFinance ? (
        <Section title="Synthèse financière de la classe">
          <TableWrap minWidth={560}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Élève</Th>
                <Th className="text-right">Attendu</Th>
                <Th className="text-right">Payé</Th>
                <Th className="text-right">Reste</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bulletins.length === 0 ? (
                <EmptyRow colSpan={4} label="Aucune donnée." />
              ) : (
                bulletins.map((b) => (
                  <tr key={b.student.id} className="hover:bg-muted/40">
                    <Td className="font-medium">{fullName(b.student)}</Td>
                    <Td className="num-display text-right">{money(b.finance?.due ?? 0)}</Td>
                    <Td className="num-display text-right text-ok">{money(b.finance?.paid ?? 0)}</Td>
                    <Td className="num-display text-right font-medium">{money(b.finance?.remaining ?? 0)}</Td>
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

function appreciation(avg: number | null): string {
  if (avg === null) return "Non évalué";
  if (avg >= 16) return "Excellent";
  if (avg >= 14) return "Très bien";
  if (avg >= 12) return "Bien";
  if (avg >= 10) return "Passable";
  return "Insuffisant";
}

function appreciationTone(avg: number | null): "neutral" | "ok" | "partial" | "late" {
  if (avg === null) return "neutral";
  if (avg >= 14) return "ok";
  if (avg >= 10) return "partial";
  return "late";
}

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
