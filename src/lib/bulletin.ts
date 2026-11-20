/**
 * Calcul du bulletin du collège, fidèle au modèle de l'école :
 *  - moyenne du trimestre d'une matière = (moyenne de classe + composition) ÷ 2
 *  - note définitive = moyenne du trimestre × coefficient
 *  - moyenne d'un groupe = total des notes définitives ÷ total des coefficients
 *  - moyenne du trimestre = total général ÷ total général des coefficients
 *  - moyenne annuelle = moyenne des moyennes des trimestres
 *  - les moyennes affichées sont tronquées à 2 décimales (et non arrondies)
 */
export type Group = "litteraire" | "scientifique" | "facultative";

export const GROUP_ORDER: Group[] = ["litteraire", "scientifique", "facultative"];
export const GROUP_TITLES: Record<Group, string> = {
  litteraire: "MATIERES LITTERAIRES",
  scientifique: "MATIERES SCIENTIFIQUES & E.P.S",
  facultative: "MATIERES FACULTATIVES",
};

export type SubjectInfo = {
  subjectId: string;
  label: string;
  group: Group;
  coefficient: number;
  teacher: string;
};

export type Note = { classAvg: number | null; composition: number | null };

/** Clé d'une note : élève | matière | trimestre. */
export const noteKey = (studentId: string, subjectId: string, termId: string) =>
  `${studentId}|${subjectId}|${termId}`;

export type TermInfo = { id: string; name: string; order: number };

export type StudentLike = { id: string; first_name: string; last_name: string };

export function trunc2(x: number): number {
  return Math.floor(x * 100 + 1e-9) / 100;
}

/** 16.325 -> "16,32" */
export function fmt(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "";
  return trunc2(x).toFixed(2).replace(".", ",");
}

export function fmtCoef(n: number): string {
  return String(n).padStart(2, "0");
}

export function ordinal(n: number | null): string {
  if (n === null) return "";
  return n === 1 ? "1er" : `${n}ème`;
}

export function appreciation(avg: number | null): string {
  if (avg === null) return "";
  const v = trunc2(avg);
  if (v >= 18) return "Excellent";
  if (v >= 16) return "Très bien";
  if (v >= 14) return "Bien";
  if (v >= 12) return "Assez bien";
  if (v >= 10) return "Passable";
  if (v >= 8) return "Insuffisant";
  return "Faible";
}

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze",
  "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function numWords(n: number): string {
  if (n < 20) return UNITS[n] ?? "";
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7) return u === 1 ? "soixante et onze" : `soixante-${UNITS[10 + u]}`;
  if (t === 9) return `quatre-vingt-${UNITS[10 + u]}`;
  if (t === 8) return u === 0 ? "quatre-vingts" : `quatre-vingt-${UNITS[u]}`;
  if (u === 0) return TENS[t] ?? "";
  if (u === 1) return `${TENS[t]} et un`;
  return `${TENS[t]}-${UNITS[u]}`;
}

/** 16.09 -> "seize virgule zéro neuf" */
export function averageInWords(avg: number | null): string {
  if (avg === null) return "";
  const v = trunc2(avg);
  const whole = Math.floor(v + 1e-9);
  const dec = Math.round((v - whole) * 100);
  if (dec === 0) return numWords(whole);
  return `${numWords(whole)} virgule ${dec < 10 ? `zéro ${numWords(dec)}` : numWords(dec)}`;
}

/** Moyenne du trimestre d'une matière : nécessite la moyenne de classe ET la composition. */
export function trimAverage(note: Note | undefined): number | null {
  if (!note || note.classAvg === null || note.composition === null) return null;
  return (note.classAvg + note.composition) / 2;
}

/** Rang (ex aequo : même rang) d'une valeur parmi des valeurs. */
export function rankOf(value: number, all: number[]): number {
  const v = Math.round(value * 10000);
  return all.filter((x) => Math.round(x * 10000) > v).length + 1;
}

export type SubjectRow = {
  subject: SubjectInfo;
  classAvg: number | null;
  composition: number | null;
  trimAvg: number | null;
  points: number | null;
  rank: number | null;
};

export type GroupResult = {
  group: Group;
  rows: SubjectRow[];
  coefficient: number;
  points: number;
  average: number | null;
};

export type TermResult = {
  term: TermInfo;
  average: number | null;
  rank: number | null;
};

export type StudentReport<S extends StudentLike> = {
  student: S;
  groups: GroupResult[];
  totalCoefficient: number;
  totalPoints: number;
  average: number | null;
  rank: number | null;
  terms: TermResult[];
  annualAverage: number | null;
  annualRank: number | null;
};

export type ClassReport<S extends StudentLike> = {
  reports: StudentReport<S>[];
  effectif: number;
  weakest: number | null;
  strongest: number | null;
};

function termTotals(
  studentId: string,
  termId: string,
  subjects: SubjectInfo[],
  notes: Map<string, Note>,
) {
  let coefficient = 0;
  let points = 0;
  for (const s of subjects) {
    const t = trimAverage(notes.get(noteKey(studentId, s.subjectId, termId)));
    if (t === null) continue;
    coefficient += s.coefficient;
    points += t * s.coefficient;
  }
  return { coefficient, points, average: coefficient > 0 ? points / coefficient : null };
}

export function buildClassReport<S extends StudentLike>(input: {
  students: S[];
  subjects: SubjectInfo[];
  notes: Map<string, Note>;
  terms: TermInfo[];
  termId: string;
}): ClassReport<S> {
  const { students, subjects, notes, termId } = input;
  const terms = [...input.terms].sort((a, b) => a.order - b.order);
  const current = terms.find((t) => t.id === termId);
  const upTo = current ? terms.filter((t) => t.order <= current.order) : [];

  // Moyennes de chaque trimestre (jusqu'au trimestre demandé) et rangs.
  const termAvg = new Map<string, Map<string, number | null>>(); // termId -> studentId -> avg
  const termRank = new Map<string, Map<string, number | null>>();
  for (const t of upTo) {
    const avgs = new Map<string, number | null>();
    for (const st of students) avgs.set(st.id, termTotals(st.id, t.id, subjects, notes).average);
    const valid = [...avgs.values()].filter((v): v is number => v !== null);
    const ranks = new Map<string, number | null>();
    for (const [id, v] of avgs) ranks.set(id, v === null ? null : rankOf(v, valid));
    termAvg.set(t.id, avgs);
    termRank.set(t.id, ranks);
  }

  // Moyenne annuelle : moyenne des moyennes des trimestres disponibles.
  const annual = new Map<string, number | null>();
  for (const st of students) {
    const list = upTo
      .map((t) => termAvg.get(t.id)?.get(st.id) ?? null)
      .filter((v): v is number => v !== null);
    annual.set(st.id, list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
  }
  const annualValid = [...annual.values()].filter((v): v is number => v !== null);

  // Moyennes de chaque matière dans le trimestre demandé (pour les rangs par matière).
  const subjectAvgs = new Map<string, number[]>();
  for (const s of subjects) {
    const arr: number[] = [];
    for (const st of students) {
      const t = trimAverage(notes.get(noteKey(st.id, s.subjectId, termId)));
      if (t !== null) arr.push(t);
    }
    subjectAvgs.set(s.subjectId, arr);
  }

  const reports: StudentReport<S>[] = students.map((student) => {
    const groups: GroupResult[] = GROUP_ORDER.map((group) => {
      const rows: SubjectRow[] = subjects
        .filter((s) => s.group === group)
        .map((subject) => {
          const note = notes.get(noteKey(student.id, subject.subjectId, termId));
          const trimAvg = trimAverage(note);
          return {
            subject,
            classAvg: note?.classAvg ?? null,
            composition: note?.composition ?? null,
            trimAvg,
            points: trimAvg === null ? null : trimAvg * subject.coefficient,
            rank:
              trimAvg === null ? null : rankOf(trimAvg, subjectAvgs.get(subject.subjectId) ?? []),
          };
        });
      const done = rows.filter((r) => r.trimAvg !== null);
      const coefficient = done.reduce((s, r) => s + r.subject.coefficient, 0);
      const points = done.reduce((s, r) => s + (r.points ?? 0), 0);
      return { group, rows, coefficient, points, average: coefficient > 0 ? points / coefficient : null };
    }).filter((g) => g.rows.length > 0);

    const totalCoefficient = groups.reduce((s, g) => s + g.coefficient, 0);
    const totalPoints = groups.reduce((s, g) => s + g.points, 0);
    const average = totalCoefficient > 0 ? totalPoints / totalCoefficient : null;

    const annualAverage = annual.get(student.id) ?? null;
    return {
      student,
      groups,
      totalCoefficient,
      totalPoints,
      average,
      rank: termRank.get(termId)?.get(student.id) ?? null,
      terms: upTo.map((t) => ({
        term: t,
        average: termAvg.get(t.id)?.get(student.id) ?? null,
        rank: termRank.get(t.id)?.get(student.id) ?? null,
      })),
      annualAverage,
      annualRank: annualAverage === null ? null : rankOf(annualAverage, annualValid),
    };
  });

  const currentAvgs = reports.map((r) => r.average).filter((v): v is number => v !== null);
  return {
    reports,
    effectif: students.length,
    weakest: currentAvgs.length ? Math.min(...currentAvgs) : null,
    strongest: currentAvgs.length ? Math.max(...currentAvgs) : null,
  };
}
