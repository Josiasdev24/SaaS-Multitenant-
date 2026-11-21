import { memo, useMemo, useRef, useState, type MutableRefObject } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { fmt } from "@/lib/bulletin";
import { fullName, type Student } from "@/lib/data";
import {
  computeFrom,
  fmtScore,
  groupOf,
  parseScore,
  periodsFor,
  scoreKey,
  subjectsFor,
  type PSubject,
} from "@/lib/primaire";
import {
  classStudents,
  saveScores,
  usePrimaryBase,
  usePrimaryScores,
  type SaveRow,
} from "@/lib/primaire-data";
import { useCurrentUser } from "@/lib/session";
import { PageHeader, Panel, Th, Td, LoadingBlock, NoAccess } from "@/components/kit";
import { TopScroll } from "@/components/top-scroll";

export const Route = createFileRoute("/_authenticated/primaire/saisie/$classId/$month")({
  head: () => ({
    meta: [{ title: "Saisie des notes du primaire" }],
  }),
  component: SaisiePage,
});

const inputClass =
  "h-8 w-16 rounded-md border border-border bg-card px-1.5 text-center text-[13px] outline-none focus:border-primary/50";

function SaisiePage() {
  const { classId, month } = Route.useParams();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const base = usePrimaryBase(Boolean(perms?.editAcademics));

  const klass = base.classes.find((c) => c.id === classId);
  const grp = klass ? groupOf(klass.name) : null;
  const subjects = useMemo(() => (grp ? subjectsFor(base.subjects, grp) : []), [base.subjects, grp]);
  const students = useMemo(() => classStudents(base.students, classId), [base.students, classId]);
  const ids = useMemo(() => students.map((s) => s.id), [students]);
  const { scores, pending } = usePrimaryScores(classId, ids, Boolean(perms?.editAcademics));

  if (!perms) return <LoadingBlock />;
  if (!perms.editAcademics || perms.scope === "own" || perms.scope === "college") return <NoAccess />;
  if (base.pending || pending) return <LoadingBlock />;
  if (!klass || !grp) {
    return (
      <Panel>
        <p className="text-[13px] text-muted-foreground">Classe du primaire introuvable.</p>
      </Panel>
    );
  }
  if (perms.ownClassesOnly && klass.main_teacher_id !== user?.teacherId) return <NoAccess />;

  const periods = periodsFor(grp, base.months);
  const info = periods.find((m) => m.key === month);

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title={`Saisie des notes — ${klass.name}`}
        subtitle={`${info?.label ?? month} · ${base.schoolYear} · une note vide veut dire « pas encore notée »`}
        right={
          <Link to="/primaire" className="text-[13px] text-primary hover:underline">
            Retour aux bulletins du primaire
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="month" className="label-caps">
          {grp === "je" ? "Trimestre" : "Mois"}
        </label>
        <select
          id="month"
          value={month}
          onChange={(e) =>
            void navigate({
              to: "/primaire/saisie/$classId/$month",
              params: { classId, month: e.target.value },
            })
          }
          className="h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50"
        >
          {periods.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {subjects.length === 0 ? (
        <Panel>
          <p className="text-[13px] text-muted-foreground">
            Aucune matière n'est paramétrée pour cette classe.
          </p>
        </Panel>
      ) : (
        <Grid
          key={`${classId}-${month}`}
          students={students}
          subjects={subjects}
          scores={scores}
          month={month}
        />
      )}
    </div>
  );
}

type Cells = Record<string, string>;

function Grid({
  students,
  subjects,
  scores,
  month,
}: {
  students: Student[];
  subjects: PSubject[];
  scores: Map<string, number>;
  month: string;
}) {
  const queryClient = useQueryClient();

  // Valeurs de départ de chaque élève (calculées une seule fois, à l'ouverture de la grille).
  const initial = useMemo(() => {
    const byStudent = new Map<string, Cells>();
    for (const s of students) {
      const cells: Cells = {};
      for (const sub of subjects) {
        const v = scores.get(scoreKey(s.id, sub.id, month));
        cells[sub.id] = v === undefined ? "" : fmtScore(v);
      }
      byStudent.set(s.id, cells);
    }
    return byStudent;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Valeurs en cours de saisie et dernière version enregistrée. Ce sont des références, pas de l'état :
  // taper une note ne redessine que la ligne concernée, pas les 50 autres.
  const current = useRef<Map<string, Cells>>(new Map());
  const saved = useRef<Map<string, Cells>>(new Map());
  if (saved.current.size === 0) {
    for (const [id, cells] of initial) {
      current.current.set(id, { ...cells });
      saved.current.set(id, { ...cells });
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const rows: SaveRow[] = [];
      for (const s of students) {
        const now = current.current.get(s.id) ?? {};
        const before = saved.current.get(s.id) ?? {};
        for (const sub of subjects) {
          const raw = now[sub.id] ?? "";
          if (raw === (before[sub.id] ?? "")) continue;
          rows.push({
            studentId: s.id,
            subjectId: sub.id,
            month,
            score: parseScore(raw, sub.max, `${fullName(s)} — ${sub.name}`),
          });
        }
      }
      await saveScores(rows);
      return rows.length;
    },
    onSuccess: (n) => {
      for (const [id, cells] of current.current) saved.current.set(id, { ...cells });
      toast.success(n === 0 ? "Aucune modification à enregistrer" : `${n} note(s) enregistrée(s)`);
      void queryClient.invalidateQueries({ queryKey: ["primary-scores"] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {save.isPending ? "Enregistrement…" : "Enregistrer les notes"}
        </button>
        <span className="text-[12px] text-muted-foreground">
          Entrée passe à l'élève suivant dans la même colonne. La barre de défilement est en haut du tableau.
        </span>
      </div>

      <TopScroll>
        <table className="w-full text-[13px]" style={{ minWidth: Math.max(720, 260 + subjects.length * 76) }}>
          <thead className="border-b border-border">
            <tr>
              <Th className="sticky left-0 top-0 z-30 bg-primary">Élève</Th>
              {subjects.map((sub) => (
                <Th key={sub.id} className="sticky top-0 z-20 bg-primary text-center">
                  <div>{sub.name}</div>
                  <div className="text-[10px] font-normal normal-case opacity-80">
                    /{fmtScore(sub.max)} · coef. {fmtScore(sub.coef)}
                  </div>
                </Th>
              ))}
              <Th className="sticky top-0 z-20 bg-primary text-right">Total</Th>
              <Th className="sticky top-0 z-20 bg-primary text-right">Moy. /10</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.length === 0 ? (
              <tr>
                <td
                  colSpan={subjects.length + 3}
                  className="px-4 py-10 text-center text-[13px] text-muted-foreground"
                >
                  Aucun élève dans cette classe.
                </td>
              </tr>
            ) : (
              students.map((s, i) => (
                <GridRow
                  key={s.id}
                  index={i}
                  student={s}
                  subjects={subjects}
                  month={month}
                  start={initial.get(s.id) ?? {}}
                  registry={current}
                />
              ))
            )}
          </tbody>
        </table>
      </TopScroll>
    </>
  );
}

/** Une ligne de la grille : garde ses propres valeurs et ne se redessine que quand on y tape. */
const GridRow = memo(function GridRow({
  index,
  student,
  subjects,
  month,
  start,
  registry,
}: {
  index: number;
  student: Student;
  subjects: PSubject[];
  month: string;
  start: Cells;
  registry: MutableRefObject<Map<string, Cells>>;
}) {
  const [cells, setCells] = useState<Cells>(start);

  function change(subjectId: string, value: string) {
    const next = { ...cells, [subjectId]: value };
    registry.current.set(student.id, next);
    setCells(next);
  }

  const r = computeFrom(subjects, (sub) => {
    try {
      return parseScore(cells[sub.id] ?? "", sub.max, "");
    } catch {
      return null;
    }
  });

  return (
    <tr className="hover:bg-muted/40">
      <Td className="sticky left-0 z-10 whitespace-nowrap bg-card font-medium">
        <span className="mr-2 text-muted-foreground">{index + 1}</span>
        {fullName(student)}
      </Td>
      {subjects.map((sub, j) => (
        <Td key={sub.id} className="text-center">
          <input
            inputMode="decimal"
            data-cell={`${index}-${j}`}
            value={cells[sub.id] ?? ""}
            onChange={(e) => change(sub.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                document
                  .querySelector<HTMLInputElement>(`[data-cell="${index + 1}-${j}"]`)
                  ?.focus();
              }
            }}
            aria-label={`${sub.name} — ${fullName(student)} (${month})`}
            className={inputClass}
          />
        </Td>
      ))}
      <Td className="num-display text-right">{r.entered > 0 ? fmtScore(r.total) : "—"}</Td>
      <Td className="num-display text-right font-semibold">{fmt(r.average) || "—"}</Td>
    </tr>
  );
});
