import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { q, compareNames, type Student } from "@/lib/data";
import {
  buildClassReport,
  noteKey,
  type Group,
  type Note,
  type SubjectInfo,
  type TermInfo,
} from "@/lib/bulletin";

/**
 * Accès aux données du bulletin. Les tables bulletin_notes et bulletin_remarks sont
 * récentes et absentes des types générés : client typé de façon souple.
 */
type DbError = { message: string } | null;
type Row = Record<string, unknown>;
type LooseDb = {
  from: (table: string) => {
    select: (cols: string) => {
      range: (from: number, to: number) => Promise<{ data: Row[] | null; error: DbError }>;
    };
    upsert: (values: Row[], opts: { onConflict: string }) => Promise<{ error: DbError }>;
  };
};
const db = supabase as unknown as LooseDb;

/** Lit toute une table par pages de 1000 lignes (limite du serveur). */
async function fetchAll(table: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

export type BulletinNoteRow = {
  student_id: string;
  subject_id: string;
  term_id: string;
  class_avg: number | null;
  composition: number | null;
};

export type Remarks = {
  student_id: string;
  term_id: string;
  absences: string | null;
  retards: string | null;
  honor_roll: string | null;
  congratulations: string | null;
  encouragement: string | null;
  warning: string | null;
  blame: string | null;
  decision: string | null;
  observation: string | null;
};

const toNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const toStr = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export const notesQuery = {
  queryKey: ["bulletin-notes"],
  queryFn: async (): Promise<BulletinNoteRow[]> =>
    (await fetchAll("bulletin_notes")).map((r) => ({
      student_id: String(r["student_id"]),
      subject_id: String(r["subject_id"]),
      term_id: String(r["term_id"]),
      class_avg: toNum(r["class_avg"]),
      composition: toNum(r["composition"]),
    })),
};

export const remarksQuery = {
  queryKey: ["bulletin-remarks"],
  queryFn: async (): Promise<Remarks[]> =>
    (await fetchAll("bulletin_remarks")).map((r) => ({
      student_id: String(r["student_id"]),
      term_id: String(r["term_id"]),
      absences: toStr(r["absences"]),
      retards: toStr(r["retards"]),
      honor_roll: toStr(r["honor_roll"]),
      congratulations: toStr(r["congratulations"]),
      encouragement: toStr(r["encouragement"]),
      warning: toStr(r["warning"]),
      blame: toStr(r["blame"]),
      decision: toStr(r["decision"]),
      observation: toStr(r["observation"]),
    })),
};

/** Enregistre (ou met à jour) des notes ; une ligne par élève, matière et trimestre. */
export async function saveNotes(
  rows: { studentId: string; subjectId: string; termId: string; classAvg: number | null; composition: number | null }[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db.from("bulletin_notes").upsert(
    rows.map((r) => ({
      student_id: r.studentId,
      subject_id: r.subjectId,
      term_id: r.termId,
      class_avg: r.classAvg,
      composition: r["composition"],
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "student_id,subject_id,term_id" },
  );
  if (error) throw new Error(error.message);
}

export async function saveRemarks(r: Remarks): Promise<void> {
  const { error } = await db.from("bulletin_remarks").upsert(
    [{ ...r, updated_at: new Date().toISOString() }],
    { onConflict: "student_id,term_id" },
  );
  if (error) throw new Error(error.message);
}

const classSubjectsQuery = {
  queryKey: ["class-subjects-all"],
  queryFn: async () => {
    const { data, error } = await supabase.from("class_subjects").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      id: string;
      class_id: string;
      subject_id: string;
      teacher_id: string | null;
      coefficient: number | string | null;
    }[];
  },
};

const teachersQuery = {
  queryKey: ["teachers-names"],
  queryFn: async () => {
    const { data, error } = await supabase.from("teachers").select("id, first_name, last_name");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; first_name: string; last_name: string }[];
  },
};

/** Ordre des matières sur le bulletin de l'école. */
const SUBJECT_ORDER = [
  "FRANÇAIS",
  "ANGLAIS",
  "HISTO&GEO",
  "ECM",
  "MATHEMATIQUES",
  "S. PHYSIQUES & T.",
  "SVT",
  "E.P.S",
  "INFORMATIQUE",
];
const subjectOrder = (label: string) => {
  const i = SUBJECT_ORDER.indexOf(label);
  return i === -1 ? 99 : i;
};

export type StudentWithType = Student & { student_type?: string | null };

/** Tout ce qu'il faut pour les écrans de bulletin d'une classe. */
export function useBulletinData(classId: string, termId: string, enabled = true) {
  const [students, classes, terms, subjects, classSubjects, teachers, notes, remarks] = useQueries({
    queries: [
      { ...q.students(), enabled },
      { ...q.classes(), enabled },
      { ...q.terms(), enabled },
      { ...q.subjects(), enabled },
      { ...classSubjectsQuery, enabled },
      { ...teachersQuery, enabled },
      { ...notesQuery, enabled },
      { ...remarksQuery, enabled },
    ],
  });

  const pending = [students, classes, terms, subjects, classSubjects, teachers, notes, remarks].some(
    (x) => x.isPending,
  );

  const klass = (classes.data ?? []).find((c) => c.id === classId) ?? null;

  const classStudents = useMemo(
    () =>
      ((students.data ?? []) as StudentWithType[])
        .filter((s) => s.class_id === classId && s.status === "actif")
        .sort(compareNames),
    [students.data, classId],
  );

  const termInfos: TermInfo[] = useMemo(
    () =>
      (terms.data ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        order: Number((t as { order_index?: number }).order_index ?? 0),
      })),
    [terms.data],
  );

  const subjectInfos: SubjectInfo[] = useMemo(() => {
    const teacherName = (id: string | null) => {
      const t = (teachers.data ?? []).find((x) => x.id === id);
      return t ? t.last_name : "";
    };
    return (classSubjects.data ?? [])
      .filter((cs) => cs.class_id === classId)
      .map((cs) => {
        const sub = (subjects.data ?? []).find((s) => s.id === cs.subject_id) as
          | (Record<string, unknown> & { id: string; name: string; code?: string | null })
          | undefined;
        const group = ((sub?.["groupe"] as string | undefined) ?? "litteraire") as Group;
        return {
          subjectId: cs.subject_id,
          label: ((sub?.code as string | null | undefined) || sub?.name || "Matière").toString(),
          group,
          coefficient: Number(cs.coefficient ?? 1),
          teacher: teacherName(cs.teacher_id),
          teacherId: cs.teacher_id,
        };
      })
      .sort((a, b) => subjectOrder(a.label) - subjectOrder(b.label));
  }, [classSubjects.data, subjects.data, teachers.data, classId]);

  const schoolYear = useMemo(() => {
    const first = [...(terms.data ?? [])].sort(
      (a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0),
    )[0];
    const y = first?.start_date ? Number(String(first.start_date).slice(0, 4)) : new Date().getFullYear();
    return `${y}-${y + 1}`;
  }, [terms.data]);

  const titulaire = useMemo(() => {
    const t = (teachers.data ?? []).find((x) => x.id === klass?.main_teacher_id);
    return t ? `${t.last_name} ${t.first_name}` : "";
  }, [teachers.data, klass?.main_teacher_id]);

  const noteMap = useMemo(() => {
    const m = new Map<string, Note>();
    for (const n of notes.data ?? []) {
      m.set(noteKey(n.student_id, n.subject_id, n.term_id), {
        classAvg: n.class_avg,
        composition: n.composition,
      });
    }
    return m;
  }, [notes.data]);

  const report = useMemo(
    () =>
      buildClassReport({
        students: classStudents,
        subjects: subjectInfos,
        notes: noteMap,
        terms: termInfos,
        termId,
      }),
    [classStudents, subjectInfos, noteMap, termInfos, termId],
  );

  return {
    pending,
    klass,
    schoolYear,
    titulaire,
    classes: classes.data ?? [],
    classSubjects: classSubjects.data ?? [],
    students: classStudents,
    terms: termInfos,
    subjects: subjectInfos as (SubjectInfo & { teacherId?: string | null })[],
    notes: noteMap,
    remarks: remarks.data ?? [],
    report,
  };
}
