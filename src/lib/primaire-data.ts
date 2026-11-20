import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { q, type Student } from "@/lib/data";
import {
  groupOf,
  schoolMonths,
  schoolStartYear,
  scoreKey,
  type Block,
  type Grp,
  type PSubject,
} from "@/lib/primaire";

/**
 * Accès aux données du primaire. Les tables primary_subjects et primary_scores sont
 * récentes et absentes des types générés : client typé de façon souple.
 */
type DbError = { message: string } | null;
type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: DbError };
type Query = PromiseLike<Result> & {
  in: (col: string, values: string[]) => Query;
  range: (from: number, to: number) => Query;
};
type LooseDb = {
  from: (table: string) => {
    select: (cols: string) => Query;
    upsert: (values: Row[], opts: { onConflict: string }) => Promise<{ error: DbError }>;
    update: (values: Row) => { eq: (col: string, value: string) => Promise<{ error: DbError }> };
  };
};
const db = supabase as unknown as LooseDb;

/** Les listes d'élèves, de classes et de matières changent rarement : pas de rechargement à chaque page. */
const STALE = 5 * 60 * 1000;

const subjectsQuery = {
  queryKey: ["primary-subjects"],
  queryFn: async (): Promise<PSubject[]> => {
    const { data, error } = await db.from("primary_subjects").select("*").range(0, 999);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: String(r["id"]),
      grp: String(r["grp"]) as Grp,
      block: String(r["block"]) as Block,
      name: String(r["name"]),
      max: Number(r["max_points"]),
      coef: Number(r["coefficient"]),
      order: Number(r["order_index"] ?? 0),
      active: r["is_active"] !== false,
    }));
  },
};

/** Élèves actifs d'une classe, par ordre alphabétique. */
export function classStudents(students: Student[], classId: string): Student[] {
  return students
    .filter((s) => s.class_id === classId && s.status === "actif")
    .sort(
      (a, b) =>
        a.last_name.localeCompare(b.last_name, "fr") || a.first_name.localeCompare(b.first_name, "fr"),
    );
}

/** Données communes : élèves, classes du primaire, matières, mois de l'année. */
export function usePrimaryBase(enabled: boolean) {
  const [students, classes, terms, subjects] = useQueries({
    queries: [
      { ...q.students(), enabled, staleTime: STALE },
      { ...q.classes(), enabled, staleTime: STALE },
      { ...q.terms(), enabled, staleTime: STALE },
      { ...subjectsQuery, enabled, staleTime: STALE },
    ],
  });

  const startYear = useMemo(() => {
    const first = [...(terms.data ?? [])].sort(
      (a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0),
    )[0];
    return schoolStartYear(first?.start_date, new Date());
  }, [terms.data]);

  const months = useMemo(() => schoolMonths(startYear), [startYear]);

  const primaryClasses = useMemo(
    () =>
      (classes.data ?? [])
        .filter((c) => !c.is_archived && groupOf(c.name) !== null)
        .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })),
    [classes.data],
  );

  const allStudents = useMemo(() => students.data ?? [], [students.data]);
  const allSubjects = useMemo(() => subjects.data ?? [], [subjects.data]);

  return {
    pending: students.isPending || classes.isPending || terms.isPending || subjects.isPending,
    students: allStudents,
    classes: primaryClasses,
    subjects: allSubjects,
    startYear,
    months,
    schoolYear: `${startYear}-${startYear + 1}`,
  };
}

export type PrimaryBase = ReturnType<typeof usePrimaryBase>;

const CHUNK = 80;

async function fetchScores(studentIds: string[]): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < studentIds.length; i += CHUNK) {
    const chunk = studentIds.slice(i, i + CHUNK);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("primary_scores")
        .select("*")
        .in("student_id", chunk)
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      const page = data ?? [];
      out.push(...page);
      if (page.length < 1000) break;
    }
  }
  return out;
}

/** Toutes les notes des élèves donnés, sous forme d'une table clé → note. */
export function usePrimaryScores(scope: string, studentIds: string[], enabled: boolean) {
  const active = enabled && studentIds.length > 0;
  const query = useQuery({
    queryKey: ["primary-scores", scope, studentIds.join(",")],
    queryFn: () => fetchScores(studentIds),
    enabled: active,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const scores = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of query.data ?? []) {
      if (r["score"] === null || r["score"] === undefined) continue;
      m.set(scoreKey(String(r["student_id"]), String(r["subject_id"]), String(r["month_key"])), Number(r["score"]));
    }
    return m;
  }, [query.data]);

  return { scores, pending: active && query.isPending };
}

export type SaveRow = { studentId: string; subjectId: string; month: string; score: number | null };

export async function saveScores(rows: SaveRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db.from("primary_scores").upsert(
    rows.map((r) => ({
      student_id: r.studentId,
      subject_id: r.subjectId,
      month_key: r.month,
      score: r.score,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "student_id,subject_id,month_key" },
  );
  if (error) throw new Error(error.message);
}

export async function updateSubject(
  id: string,
  patch: { max_points: number; coefficient: number; is_active: boolean },
): Promise<void> {
  const { error } = await db.from("primary_subjects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
