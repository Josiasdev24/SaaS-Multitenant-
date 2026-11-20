import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ types */

export type Student = {
  id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  gender: "M" | "F" | null;
  birth_date: string | null;
  birth_place: string | null;
  address: string | null;
  phone: string | null;
  class_id: string | null;
  academic_year_id: string;
  enrollment_date: string;
  status: "actif" | "archive" | "transfere" | "sorti";
  notes: string | null;
  /** Régime d'écolage : normal, enfant du personnel, bourse totale/partielle, proche d'un membre du personnel. */
  fee_status?: FeeRegime | null;
  /** Somme exonérée (FCFA) pour les régimes à réduction. */
  fee_discount?: number | string | null;
  /** Précision libre : lien de parenté, nom du membre du personnel, motif de la bourse… */
  fee_note?: string | null;
};

export type FeeRegime = "normal" | "personnel" | "bourse" | "bourse_partielle" | "proche_personnel";
export const FEE_REGIME_LABELS: Record<FeeRegime, string> = {
  normal: "Normal",
  personnel: "Enfant du personnel (ne paie rien)",
  bourse: "Bourse totale (ne paie rien)",
  bourse_partielle: "Bourse partielle (somme à définir)",
  proche_personnel: "Proche d'un membre du personnel (somme à définir)",
};
/** Libellés courts pour les étiquettes dans les tableaux. */
export const FEE_REGIME_SHORT: Record<FeeRegime, string> = {
  normal: "Normal",
  personnel: "Enfant du personnel",
  bourse: "Bourse totale",
  bourse_partielle: "Bourse partielle",
  proche_personnel: "Proche du personnel",
};
/** Régimes qui exonèrent d'une somme choisie (et non de la totalité). */
export const isPartialRegime = (r: string | null | undefined): boolean =>
  r === "bourse_partielle" || r === "proche_personnel";
/** Régime spécial : bourse, enfant ou proche du personnel. */
export const hasRegime = (s: { fee_status?: string | null }): boolean =>
  Boolean(s.fee_status) && s.fee_status !== "normal";
/** Exonération totale : l'élève ne paie rien. */
export const isExempt = (s: { fee_status?: string | null }): boolean =>
  s.fee_status === "bourse" || s.fee_status === "personnel";

type RegimeInfo = { status: string; discount: number };
/**
 * Régimes connus, alimentés à chaque chargement des élèves : computeFinance en tient compte
 * automatiquement partout (tableau de bord, écolage, classes, alertes…).
 */
const REGIMES = new Map<string, RegimeInfo>();
function registerRegimes(list: Student[]) {
  REGIMES.clear();
  for (const st of list) {
    if (hasRegime(st)) REGIMES.set(st.id, { status: String(st.fee_status), discount: Number(st.fee_discount ?? 0) });
  }
}

export type SchoolClass = {
  id: string;
  name: string;
  level_id: string;
  academic_year_id: string;
  main_teacher_id: string | null;
  capacity: number | null;
  is_archived: boolean;
};

export type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  status: "actif" | "conge" | "inactif";
  hire_date: string | null;
};

export type Subject = { id: string; name: string; code: string; default_coefficient: number };
export type Level = { id: string; name: string; cycle: string; order_index: number };
export type Term = {
  id: string;
  name: string;
  order_index: number;
  start_date: string;
  end_date: string;
};
export type Parent = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  profession: string | null;
};

export type SchoolFee = {
  id: string;
  name: string;
  kind: "inscription" | "tranche" | "autre";
  amount: number;
  due_date: string | null;
  order_index: number;
};

export type StudentFee = {
  id: string;
  student_id: string;
  school_fee_id: string;
  amount_due: number;
  due_date: string | null;
};

export type Payment = {
  id: string;
  student_id: string;
  student_fee_id: string | null;
  amount: number;
  paid_at: string;
  method: string;
  receipt_number: string | null;
  note: string | null;
  created_at?: string;
};

export type Attendance = {
  id: string;
  student_id: string;
  class_id: string | null;
  attendance_date: string;
  status: "present" | "absent" | "retard";
  minutes_late: number | null;
  reason: string | null;
};

export type Evaluation = {
  id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
  title: string;
  eval_date: string;
  max_score: number;
};

export type Grade = {
  id: string;
  evaluation_id: string;
  student_id: string;
  score: number | null;
};

export type Settings = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  absence_threshold: number;
  current_academic_year_id: string | null;
};

/* --------------------------------------------------------------- fetchers */

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

type PageResult = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

/**
 * Lit toute une table par pages de 1000 lignes. Le serveur ne renvoie jamais plus de
 * 1000 lignes d'un coup : sans cette boucle, les dernières lignes (par exemple les
 * échéances des élèves du collège) n'arrivaient jamais dans l'application.
 */
async function fetchAllRows<T>(page: (from: number, to: number) => PageResult): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/* ------------------------------------------------------ ordre alphabétique */

type Named = { first_name: string; last_name: string };

/** Ordre alphabétique : NOM puis prénom, sans tenir compte des accents ni des majuscules. */
export function compareNames(a: Named, b: Named): number {
  return (
    (a.last_name ?? "").localeCompare(b.last_name ?? "", "fr", { sensitivity: "base" }) ||
    (a.first_name ?? "").localeCompare(b.first_name ?? "", "fr", { sensitivity: "base" })
  );
}

/** Copie triée par ordre alphabétique (NOM puis prénom). */
export function sortByName<T extends Named>(list: readonly T[]): T[] {
  return [...list].sort(compareNames);
}

export const q = {
  students: () => ({
    queryKey: ["students"],
    queryFn: async () => {
      const list = sortByName(
        await fetchAllRows<Student>(
          (f, t) => supabase.from("students").select("*").order("matricule").range(f, t) as never,
        ),
      );
      registerRegimes(list);
      return list;
    },
  }),
  classes: () => ({
    queryKey: ["classes"],
    queryFn: async () =>
      unwrap<SchoolClass[]>((await supabase.from("classes").select("*").order("name")) as never),
  }),
  teachers: () => ({
    queryKey: ["teachers"],
    queryFn: async () =>
      sortByName(
        unwrap<Teacher[]>((await supabase.from("teachers").select("*").order("last_name")) as never),
      ),
  }),
  subjects: () => ({
    queryKey: ["subjects"],
    queryFn: async () =>
      unwrap<Subject[]>((await supabase.from("subjects").select("*").order("name")) as never),
  }),
  levels: () => ({
    queryKey: ["levels"],
    queryFn: async () =>
      unwrap<Level[]>(
        (await supabase.from("education_levels").select("*").order("order_index")) as never,
      ),
  }),
  terms: () => ({
    queryKey: ["terms"],
    queryFn: async () =>
      unwrap<Term[]>((await supabase.from("terms").select("*").order("order_index")) as never),
  }),
  parents: () => ({
    queryKey: ["parents"],
    queryFn: async () =>
      sortByName(
        await fetchAllRows<Parent>(
          (f, t) => supabase.from("parents").select("*").order("last_name").order("id").range(f, t) as never,
        ),
      ),
  }),
  studentParents: () => ({
    queryKey: ["student-parents"],
    queryFn: async () =>
      fetchAllRows<{
        id: string;
        student_id: string;
        parent_id: string;
        relationship: string;
        is_primary: boolean;
      }>(
        // select("*") : renvoie aussi l'identifiant du lien (id), nécessaire pour
        // modifier ou retirer un parent depuis la fiche de l'élève.
        (f, t) => supabase.from("student_parents").select("*").order("id").range(f, t) as never,
      ),
  }),
  classSubjects: () => ({
    queryKey: ["class-subjects"],
    queryFn: async () =>
      unwrap<{
        id: string;
        class_id: string;
        subject_id: string;
        teacher_id: string | null;
        coefficient: number;
      }[]>(
        (await supabase
          .from("class_subjects")
          .select("id, class_id, subject_id, teacher_id, coefficient")) as never,
      ),
  }),
  teacherSubjects: () => ({
    queryKey: ["teacher-subjects"],
    queryFn: async () =>
      unwrap<{ teacher_id: string; subject_id: string }[]>(
        (await supabase.from("teacher_subjects").select("teacher_id, subject_id")) as never,
      ),
  }),
  fees: () => ({
    queryKey: ["school-fees"],
    queryFn: async () =>
      fetchAllRows<SchoolFee>(
        (f, t) => supabase.from("school_fees").select("*").order("order_index").order("id").range(f, t) as never,
      ),
  }),
  studentFees: () => ({
    queryKey: ["student-fees"],
    queryFn: async () =>
      fetchAllRows<StudentFee>(
        (f, t) => supabase.from("student_fees").select("*").order("id").range(f, t) as never,
      ),
  }),
  payments: () => ({
    queryKey: ["payments"],
    queryFn: async () =>
      fetchAllRows<Payment>(
        (f, t) =>
          supabase
            .from("fee_payments")
            .select("*")
            .order("paid_at", { ascending: false })
            .order("id")
            .range(f, t) as never,
      ),
  }),
  attendance: () => ({
    queryKey: ["attendance"],
    queryFn: async () =>
      fetchAllRows<Attendance>(
        (f, t) =>
          supabase
            .from("attendance")
            .select("*")
            .order("attendance_date", { ascending: false })
            .order("id")
            .range(f, t) as never,
      ),
  }),
  evaluations: () => ({
    queryKey: ["evaluations"],
    queryFn: async () =>
      fetchAllRows<Evaluation>(
        (f, t) =>
          supabase
            .from("evaluations")
            .select("*")
            .order("eval_date", { ascending: false })
            .order("id")
            .range(f, t) as never,
      ),
  }),
  grades: () => ({
    queryKey: ["grades"],
    queryFn: async () =>
      fetchAllRows<Grade>(
        (f, t) =>
          supabase
            .from("grades")
            .select("id, evaluation_id, student_id, score")
            .order("id")
            .range(f, t) as never,
      ),
  }),
  settings: () => ({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as Settings | null;
    },
  }),
};

/* ------------------------------------------------------- calculs métiers */

export type FeeStatus = "ajour" | "partiel" | "retard" | "impaye";

export const FEE_STATUS_LABELS: Record<FeeStatus, string> = {
  ajour: "À jour",
  partiel: "Partiellement payé",
  retard: "En retard",
  impaye: "Non payé",
};

export type StudentFinance = {
  due: number;
  paid: number;
  remaining: number;
  status: FeeStatus;
  nextDue: { name: string; date: string | null } | null;
  /** Somme exonérée (bourse, enfant ou proche du personnel), déjà déduite de « due ». */
  discount: number;
};

export function computeFinance(
  studentId: string,
  studentFees: StudentFee[],
  payments: Payment[],
  fees: SchoolFee[],
  today = new Date().toISOString().slice(0, 10),
): StudentFinance {
  const mine = studentFees.filter((f) => f.student_id === studentId);
  const grossDue = mine.reduce((s, f) => s + Number(f.amount_due), 0);
  const regime = REGIMES.get(studentId);
  const discount = !regime
    ? 0
    : regime.status === "personnel" || regime.status === "bourse"
      ? grossDue
      : Math.min(Math.max(regime.discount, 0), grossDue);
  const due = grossDue - discount;
  const paid = payments
    .filter((p) => p.student_id === studentId)
    .reduce((s, p) => s + Number(p.amount), 0);
  // La réduction s'applique d'abord aux premières échéances.
  const expectedToDate = Math.max(
    mine.filter((f) => f.due_date && f.due_date <= today).reduce((s, f) => s + Number(f.amount_due), 0) -
      discount,
    0,
  );

  let status: FeeStatus;
  if ((discount > 0 && due <= 0) || regime?.status === "personnel" || regime?.status === "bourse") status = "ajour";
  else if (due > 0 && paid >= due) status = "ajour";
  else if (paid <= 0) status = expectedToDate > 0 ? "retard" : "impaye";
  else if (paid < expectedToDate) status = "retard";
  else status = "partiel";

  const upcoming = mine
    .filter((f) => f.due_date && f.due_date > today)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];
  const feeName = upcoming
    ? (fees.find((f) => f.id === upcoming.school_fee_id)?.name ?? "Échéance")
    : null;

  return {
    due,
    paid,
    remaining: Math.max(due - paid, 0),
    status,
    nextDue: upcoming && due > 0 ? { name: feeName ?? "Échéance", date: upcoming.due_date } : null,
    discount,
  };
}

/** Moyenne arithmétique simple, ramenée sur 20. */
export function averageOn20(grades: Grade[], evaluations: Evaluation[]): number | null {
  const byEval = new Map(evaluations.map((e) => [e.id, Number(e.max_score) || 20]));
  const values = grades
    .filter((g) => g.score !== null && byEval.has(g.evaluation_id))
    .map((g) => (Number(g.score) / byEval.get(g.evaluation_id)!) * 20);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function studentAverage(
  studentId: string,
  grades: Grade[],
  evaluations: Evaluation[],
): number | null {
  return averageOn20(
    grades.filter((g) => g.student_id === studentId),
    evaluations,
  );
}

/** Nom affiché : NOM puis prénom (usage au Togo), ex. « ADE Carinne Isabelle ». */
export function fullName(p: { first_name: string; last_name: string }): string {
  return `${p.last_name} ${p.first_name}`.trim();
}
