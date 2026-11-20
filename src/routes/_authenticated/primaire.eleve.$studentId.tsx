import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { appreciation, fmt, ordinal } from "@/lib/bulletin";
import { fullName } from "@/lib/data";
import {
  BLOCKS,
  BLOCK_TOTAL_LABELS,
  JARDIN_PRINT_CSS,
  PRIMAIRE_PRINT_CSS,
  computeYear,
  fmtScore,
  groupOf,
  monthRanking,
  periodsFor,
  ranks,
  scoreKey,
  subjectsFor,
  type Block,
  type MonthInfo,
  type MonthResult,
  type PSubject,
} from "@/lib/primaire";
import { classStudents, usePrimaryBase, usePrimaryScores } from "@/lib/primaire-data";
import { useCurrentUser } from "@/lib/session";
import { PrintHeader } from "@/components/print-header";
import { LoadingBlock, NoAccess, PageHeader, Panel } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/primaire/eleve/$studentId")({
  head: () => ({
    meta: [{ title: "Fiche de notes du primaire — Complexe Scolaire Omarus Adodo" }],
  }),
  component: StudentSheetPage,
});

const cell = "border border-print-ink px-2 py-1 text-[12px]";

type Rankings = Map<string, ReturnType<typeof monthRanking>>;

/** Nom de la matière, avec le barème quand il n'est pas sur 10. */
const subjectLabel = (s: PSubject) => (s.max === 10 ? s.name : `${s.name} (/${fmtScore(s.max)})`);

function StudentSheetPage() {
  const { studentId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const base = usePrimaryBase(Boolean(perms?.viewAcademics));

  const student = base.students.find((s) => s.id === studentId);
  const klass = base.classes.find((c) => c.id === student?.class_id);
  const grp = klass ? groupOf(klass.name) : null;
  const subjects = useMemo(() => (grp ? subjectsFor(base.subjects, grp) : []), [base.subjects, grp]);
  const classmates = useMemo(
    () => (klass ? classStudents(base.students, klass.id) : []),
    [base.students, klass],
  );
  const ids = useMemo(() => classmates.map((s) => s.id), [classmates]);
  const periods = useMemo(() => periodsFor(grp, base.months), [grp, base.months]);
  const monthKeys = useMemo(() => periods.map((m) => m.key), [periods]);
  const { scores, pending } = usePrimaryScores(klass?.id ?? "", ids, Boolean(perms?.viewAcademics));

  const rankings: Rankings = useMemo(() => {
    const out: Rankings = new Map();
    for (const key of monthKeys) out.set(key, monthRanking(subjects, scores, ids, key));
    return out;
  }, [monthKeys, subjects, scores, ids]);

  const yearInfo = useMemo(() => {
    const results = new Map<string, ReturnType<typeof computeYear>>();
    for (const id of ids) results.set(id, computeYear(subjects, scores, id, monthKeys));
    const rk = ranks(ids.map((id) => ({ id, value: results.get(id)?.annual ?? null })));
    return { results, rk, ranked: rk.size };
  }, [ids, subjects, scores, monthKeys]);

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics || perms.scope === "own" || perms.scope === "college") return <NoAccess />;
  if (base.pending || pending) return <LoadingBlock />;

  if (!student || !klass || !grp) {
    return (
      <Panel>
        <p className="text-[13px] text-muted-foreground">
          Élève introuvable, ou pas dans une classe du Jardin ou du primaire.
        </p>
      </Panel>
    );
  }

  const isJardin = grp === "je";
  const annual = yearInfo.results.get(student.id)?.annual ?? null;
  const annualRank = yearInfo.rk.get(student.id) ?? null;

  return (
    <div className="space-y-6 rise">
      <style>{isJardin ? JARDIN_PRINT_CSS : PRIMAIRE_PRINT_CSS}</style>
      <PageHeader
        title={fullName(student)}
        subtitle={`${klass.name} · ${isJardin ? "bulletin du Jardin" : "fiche de notes"} · ${base.schoolYear}`}
        right={
          <div className="flex items-center gap-4">
            <Link to="/primaire" className="text-[13px] text-primary hover:underline">
              Retour aux bulletins du primaire
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              Imprimer
            </button>
          </div>
        }
      />

      <div id="print-area" className="bg-card p-4 text-print-ink">
        <PrintHeader />
        <div className="mb-3 flex flex-wrap justify-between gap-2 text-[13px]">
          <div>
            <span className="font-semibold uppercase">{fullName(student)}</span> — Matricule{" "}
            {student.matricule}
          </div>
          <div>
            Année scolaire : <span className="font-semibold">{base.schoolYear}</span> — Classe :{" "}
            <span className="font-semibold">{klass.name}</span>
          </div>
        </div>

        {isJardin ? (
          <JardinSheet
            subjects={subjects}
            periods={periods}
            studentId={student.id}
            scores={scores}
            rankings={rankings}
          />
        ) : (
          <MonthlySheet
            subjects={subjects}
            periods={periods}
            studentId={student.id}
            scores={scores}
            rankings={rankings}
          />
        )}

        {isJardin ? null : (
          <div className="mt-4 grid gap-1 text-[13px] sm:grid-cols-3">
            <div>
              Moyenne annuelle : <span className="font-bold">{fmt(annual) || "—"}</span> / 10
            </div>
            <div>
              Classement général annuel :{" "}
              <span className="font-bold">{ordinal(annualRank) || "—"}</span> sur {yearInfo.ranked}
            </div>
            <div>
              Appréciation :{" "}
              <span className="font-bold">{annual === null ? "—" : appreciation(annual * 2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type SheetProps = {
  subjects: PSubject[];
  periods: MonthInfo[];
  studentId: string;
  scores: Map<string, number>;
  rankings: Rankings;
};

/** CP, CE, CM : la feuille mensuelle de l'école (matières en lignes, septembre à juin en colonnes). */
function MonthlySheet({ subjects, periods, studentId, scores, rankings }: SheetProps) {
  const result = (key: string) => rankings.get(key)?.get(studentId)?.result;
  const blocksPresent: Block[] = BLOCKS.filter((b) => subjects.some((s) => s.block === b));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${cell} text-left`}>Matières</th>
            {periods.map((m) => (
              <th key={m.key} className={`${cell} text-center`}>
                {m.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {blocksPresent.map((b) => {
            const list = subjects.filter((s) => s.block === b);
            return (
              <MonthlyBlock
                key={b}
                list={list}
                block={b}
                showTotal={list.length > 1 && b !== "art" && b !== "general"}
                studentId={studentId}
                periods={periods}
                scores={scores}
                result={result}
              />
            );
          })}
          <tr>
            <td className={`${cell} font-bold`}>TOTAUX</td>
            {periods.map((m) => {
              const r = result(m.key);
              return (
                <td key={m.key} className={`${cell} text-center font-semibold`}>
                  {r && r.entered > 0 ? fmtScore(r.total) : ""}
                </td>
              );
            })}
          </tr>
          <tr>
            <td className={`${cell} italic`}>Sur</td>
            {periods.map((m) => {
              const r = result(m.key);
              return (
                <td key={m.key} className={`${cell} text-center`}>
                  {r && r.entered > 0 ? fmtScore(r.sur) : ""}
                </td>
              );
            })}
          </tr>
          <tr>
            <td className={`${cell} font-bold italic`}>Moyenne</td>
            {periods.map((m) => (
              <td key={m.key} className={`${cell} text-center font-bold`}>
                {fmt(result(m.key)?.average)}
              </td>
            ))}
          </tr>
          <tr>
            <td className={`${cell} font-bold italic`}>Classement mensuel</td>
            {periods.map((m) => (
              <td key={m.key} className={`${cell} text-center`}>
                {ordinal(rankings.get(m.key)?.get(studentId)?.rank ?? null)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MonthlyBlock({
  list,
  block,
  showTotal,
  studentId,
  periods,
  scores,
  result,
}: {
  list: PSubject[];
  block: Block;
  showTotal: boolean;
  studentId: string;
  periods: MonthInfo[];
  scores: Map<string, number>;
  result: (key: string) => MonthResult | undefined;
}) {
  return (
    <>
      {list.map((sub) => (
        <tr key={sub.id}>
          <td className={cell}>{subjectLabel(sub)}</td>
          {periods.map((m) => (
            <td key={m.key} className={`${cell} text-center`}>
              {fmtScore(scores.get(scoreKey(studentId, sub.id, m.key)))}
            </td>
          ))}
        </tr>
      ))}
      {showTotal ? (
        <tr>
          <td className={`${cell} font-bold`}>{BLOCK_TOTAL_LABELS[block]}</td>
          {periods.map((m) => {
            const bt = result(m.key)?.blocks[block];
            return (
              <td key={m.key} className={`${cell} text-center font-semibold`}>
                {bt && bt.count > 0 ? fmtScore(bt.total) : ""}
              </td>
            );
          })}
        </tr>
      ) : null}
    </>
  );
}

/** Jardin (Section I et II) : notes et appréciation par trimestre, TOTAL, Moyenne, Rang. */
function JardinSheet({ subjects, periods, studentId, scores, rankings }: SheetProps) {
  const entry = (key: string) => rankings.get(key)?.get(studentId);
  return (
    <>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th rowSpan={2} className={`${cell} text-center text-[13px] uppercase`}>
              Matières
            </th>
            {periods.map((p) => (
              <th key={p.key} colSpan={2} className={`${cell} text-center`}>
                {p.label}
              </th>
            ))}
          </tr>
          <tr>
            {periods.map((p) => (
              <JardinSubHead key={p.key} />
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map((sub) => (
            <tr key={sub.id}>
              <td className={cell}>{subjectLabel(sub)}</td>
              {periods.map((p) => {
                const v = scores.get(scoreKey(studentId, sub.id, p.key));
                return (
                  <JardinCells
                    key={p.key}
                    note={fmtScore(v)}
                    appreciation={v === undefined ? "" : appreciation((v / sub.max) * 20)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 grid grid-cols-3 gap-4 text-[13px] font-semibold">
        <div>
          TOTAL :{" "}
          {periods.map((p) => {
            const r = entry(p.key)?.result;
            return (
              <span key={p.key} className="mr-3 font-normal">
                {r && r.entered > 0 ? fmtScore(r.total) : "…"}
              </span>
            );
          })}
        </div>
        <div>
          Moyenne :{" "}
          {periods.map((p) => (
            <span key={p.key} className="mr-3 font-normal">
              {fmt(entry(p.key)?.result.average) || "…"}
            </span>
          ))}
        </div>
        <div>
          Rang :{" "}
          {periods.map((p) => (
            <span key={p.key} className="mr-3 font-normal">
              {ordinal(entry(p.key)?.rank ?? null) || "…"}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        Dans l'ordre : {periods.map((p) => p.label).join(", ")}.
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th colSpan={2} className={`${cell} text-center`}>
                Observation du Titulaire
              </th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.key}>
                <td className={`${cell} w-28 font-medium`}>{p.label}</td>
                <td className={`${cell} h-14`} />
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${cell} text-center`}>Visa du Directeur Pédagogique</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cell} h-40`} />
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function JardinSubHead() {
  return (
    <>
      <th className={`${cell} text-center font-medium`}>Notes</th>
      <th className={`${cell} text-center font-medium`}>Appréciation</th>
    </>
  );
}

function JardinCells({ note, appreciation: text }: { note: string; appreciation: string }) {
  return (
    <>
      <td className={`${cell} text-center`}>{note}</td>
      <td className={`${cell} text-center`}>{text}</td>
    </>
  );
}
