import { supabase } from "@/integrations/supabase/client";

/**
 * Gestion des enseignants et des matières : création, modification, suppression,
 * rattachement aux classes. Réservé à la direction (les droits sont aussi vérifiés côté base).
 */

export type TeacherStatus = "actif" | "conge" | "inactif";

export type TeacherRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  hire_date: string | null;
};
export type ClassRow = { id: string; name: string; main_teacher_id: string | null; is_archived: boolean };
export type SubjectRow = { id: string; name: string; code: string; default_coefficient: number };
export type ClassSubjectRow = {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  coefficient: number;
};
export type TeacherSubjectRow = { teacher_id: string; subject_id: string };

/** Différence entre deux ensembles : ce qu'il faut ajouter et ce qu'il faut retirer. */
export function diffSets<T>(before: Iterable<T>, after: Iterable<T>): { add: T[]; remove: T[] } {
  const b = new Set(before);
  const a = new Set(after);
  return {
    add: [...a].filter((x) => !b.has(x)),
    remove: [...b].filter((x) => !a.has(x)),
  };
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const clean = (v: string): string | null => {
  const t = v.trim();
  return t === "" ? null : t;
};

/* --------------------------------------------------------------- enseignants */

export type TeacherInput = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: TeacherStatus;
  hire_date: string;
};

export type TeacherLinks = {
  /** Classes dont il est titulaire. */
  titularClassIds: string[];
  /** Lignes class_subjects (matière dans une classe) qu'il enseigne. */
  courseIds: string[];
  /** Matières qu'il enseigne (hors des cours ci-dessus). */
  subjectIds: string[];
};

function checkTeacher(input: TeacherInput): void {
  if (input.first_name.trim() === "") throw new Error("Le prénom est obligatoire.");
  if (input.last_name.trim() === "") throw new Error("Le nom est obligatoire.");
  const email = input.email.trim();
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse email invalide.");
}

/** Crée (id = null) ou met à jour un enseignant, puis aligne ses classes, ses cours et ses matières. */
export async function saveTeacher(args: {
  id: string | null;
  input: TeacherInput;
  after: TeacherLinks;
  before: TeacherLinks;
  /** Matières de chaque cours (class_subjects.id → subject_id), pour déduire les matières enseignées. */
  courseSubject: Map<string, string>;
}): Promise<string> {
  const { input, after, before, courseSubject } = args;
  checkTeacher(input);

  const values = {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    phone: clean(input.phone),
    email: clean(input.email),
    status: input.status,
    hire_date: clean(input.hire_date),
  };

  let id = args.id;
  if (id === null) {
    const { data, error } = await supabase.from("teachers").insert(values as never).select("id").single();
    fail(error);
    id = String((data as { id: string }).id);
  } else {
    const { error } = await supabase.from("teachers").update(values as never).eq("id", id);
    fail(error);
  }

  // Titulaire de classe
  const titular = diffSets(before.titularClassIds, after.titularClassIds);
  if (titular.add.length > 0) {
    const { error } = await supabase.from("classes").update({ main_teacher_id: id } as never).in("id", titular.add);
    fail(error);
  }
  if (titular.remove.length > 0) {
    const { error } = await supabase
      .from("classes")
      .update({ main_teacher_id: null } as never)
      .in("id", titular.remove)
      .eq("main_teacher_id", id);
    fail(error);
  }

  // Cours (matière dans une classe)
  const courses = diffSets(before.courseIds, after.courseIds);
  if (courses.add.length > 0) {
    const { error } = await supabase.from("class_subjects").update({ teacher_id: id } as never).in("id", courses.add);
    fail(error);
  }
  if (courses.remove.length > 0) {
    const { error } = await supabase
      .from("class_subjects")
      .update({ teacher_id: null } as never)
      .in("id", courses.remove)
      .eq("teacher_id", id);
    fail(error);
  }

  // Matières enseignées = celles choisies + celles des cours cochés
  const wanted = new Set(after.subjectIds);
  for (const c of after.courseIds) {
    const s = courseSubject.get(c);
    if (s) wanted.add(s);
  }
  const subjects = diffSets(before.subjectIds, wanted);
  if (subjects.add.length > 0) {
    const { error } = await supabase
      .from("teacher_subjects")
      .upsert(subjects.add.map((subject_id) => ({ teacher_id: id, subject_id })) as never, {
        onConflict: "teacher_id,subject_id",
        ignoreDuplicates: true,
      });
    fail(error);
  }
  if (subjects.remove.length > 0) {
    const { error } = await supabase
      .from("teacher_subjects")
      .delete()
      .eq("teacher_id", id)
      .in("subject_id", subjects.remove);
    fail(error);
  }
  return id;
}

/** Supprime un enseignant : ses classes et cours deviennent « sans enseignant » (rien d'autre n'est perdu). */
export async function deleteTeacher(id: string): Promise<void> {
  const { error } = await supabase.from("teachers").delete().eq("id", id);
  fail(error);
}

/** Remplacement : toutes les classes, tous les cours et toutes les matières passent au nouvel enseignant. */
export async function transferTeacher(fromId: string, toId: string): Promise<void> {
  if (fromId === toId) throw new Error("Choisissez un autre enseignant.");
  const classes = await supabase.from("classes").update({ main_teacher_id: toId } as never).eq("main_teacher_id", fromId);
  fail(classes.error);
  const courses = await supabase.from("class_subjects").update({ teacher_id: toId } as never).eq("teacher_id", fromId);
  fail(courses.error);
  const { data, error } = await supabase.from("teacher_subjects").select("subject_id").eq("teacher_id", fromId);
  fail(error);
  const rows = ((data ?? []) as { subject_id: string }[]).map((s) => ({ teacher_id: toId, subject_id: s.subject_id }));
  if (rows.length > 0) {
    const up = await supabase
      .from("teacher_subjects")
      .upsert(rows as never, { onConflict: "teacher_id,subject_id", ignoreDuplicates: true });
    fail(up.error);
  }
}

/* ------------------------------------------------------------------ matières */

export type SubjectInput = { name: string; code: string; default_coefficient: string };
export type SubjectLink = { classId: string; coefficient: string; teacherId: string };

function checkSubject(input: SubjectInput): { name: string; code: string; coef: number } {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  const coef = Number(input.default_coefficient.replace(",", "."));
  if (name === "") throw new Error("L'intitulé est obligatoire.");
  if (code === "") throw new Error("Le code est obligatoire.");
  if (!Number.isFinite(coef) || coef <= 0) throw new Error("Le coefficient doit être supérieur à 0.");
  return { name, code, coef };
}

/**
 * Crée (id = null) ou met à jour une matière, puis aligne les classes où elle est enseignée
 * (avec le coefficient et l'enseignant de chaque classe).
 */
export async function saveSubject(args: {
  id: string | null;
  input: SubjectInput;
  links: SubjectLink[];
  existing: SubjectRow[];
  previousClassIds: string[];
}): Promise<string> {
  const { name, code, coef } = checkSubject(args.input);
  const others = args.existing.filter((s) => s.id !== args.id);
  if (others.some((s) => s.code.trim().toUpperCase() === code)) throw new Error(`Le code « ${code} » est déjà utilisé.`);
  if (others.some((s) => s.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error(`La matière « ${name} » existe déjà.`);
  }

  const values = { name, code, default_coefficient: coef };
  let id = args.id;
  if (id === null) {
    const { data, error } = await supabase.from("subjects").insert(values as never).select("id").single();
    fail(error);
    id = String((data as { id: string }).id);
  } else {
    const { error } = await supabase.from("subjects").update(values as never).eq("id", id);
    fail(error);
  }

  const rows = args.links.map((l) => {
    const c = Number(l.coefficient.replace(",", "."));
    if (!Number.isFinite(c) || c <= 0) throw new Error("Chaque coefficient doit être supérieur à 0.");
    return { class_id: l.classId, subject_id: id, teacher_id: l.teacherId === "" ? null : l.teacherId, coefficient: c };
  });
  if (rows.length > 0) {
    const { error } = await supabase
      .from("class_subjects")
      .upsert(rows as never, { onConflict: "class_id,subject_id" });
    fail(error);

    // Les enseignants choisis enseignent bien cette matière
    const teacherIds = [...new Set(rows.map((r) => r.teacher_id).filter((t): t is string => t !== null))];
    if (teacherIds.length > 0) {
      const up = await supabase
        .from("teacher_subjects")
        .upsert(teacherIds.map((teacher_id) => ({ teacher_id, subject_id: id })) as never, {
          onConflict: "teacher_id,subject_id",
          ignoreDuplicates: true,
        });
      fail(up.error);
    }
  }

  const removed = diffSets(args.previousClassIds, args.links.map((l) => l.classId)).remove;
  if (removed.length > 0) {
    const { error } = await supabase.from("class_subjects").delete().eq("subject_id", id).in("class_id", removed);
    fail(error);
  }
  return id;
}

type CountDb = {
  from: (t: string) => {
    select: (
      cols: string,
      opts: { count: "exact"; head: true },
    ) => { eq: (c: string, v: string) => PromiseLike<{ count: number | null; error: { message: string } | null }> };
  };
};
const countDb = supabase as unknown as CountDb;

async function countRows(table: string, subjectId: string): Promise<number> {
  const { count, error } = await countDb.from(table).select("id", { count: "exact", head: true }).eq("subject_id", subjectId);
  fail(error);
  return count ?? 0;
}

/** Ce qui serait perdu en supprimant une matière. */
export async function subjectUsage(subjectId: string): Promise<{ evaluations: number; bulletinNotes: number }> {
  const [evaluations, bulletinNotes] = await Promise.all([
    countRows("evaluations", subjectId),
    countRows("bulletin_notes", subjectId),
  ]);
  return { evaluations, bulletinNotes };
}

export async function deleteSubject(id: string): Promise<void> {
  const usage = await subjectUsage(id);
  if (usage.evaluations > 0) {
    throw new Error(
      `Cette matière a ${usage.evaluations} évaluation(s) enregistrée(s) : supprimez-les d'abord, ou désactivez la matière dans les classes.`,
    );
  }
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  fail(error);
}
