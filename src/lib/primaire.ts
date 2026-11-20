import { trunc2 } from "@/lib/bulletin";

/**
 * Bulletin du primaire : saisie mensuelle (septembre à juin), moyenne sur 10.
 *
 * Moyenne du mois = somme(note / barème × coefficient) ÷ somme(coefficients) × 10,
 * calculée sur les matières notées. Avec les coefficients de l'école (barème 10 → coef. 1,
 * barème 20 → coef. 2), c'est exactement « total des points ÷ total des coefficients » :
 * un élève parfait obtient 10/10.
 * « Nombre de fautes » n'est pas une matière : il n'est ni saisi ni calculé.
 */

export type Grp = "je" | "cp" | "ce" | "cm";
export type Block = "francais" | "calcul" | "lecon" | "art" | "general";

export const BLOCKS: Block[] = ["francais", "calcul", "lecon", "art", "general"];

export const BLOCK_TITLES: Record<Block, string> = {
  francais: "Français",
  calcul: "Calcul",
  lecon: "Leçons",
  art: "Éducation artistique",
  general: "Matières",
};

export const BLOCK_TOTAL_LABELS: Record<Block, string> = {
  francais: "TOTAL FRANÇAIS",
  calcul: "TOTAL CALCUL",
  lecon: "TOTAL LEÇON",
  art: "TOTAL ARTISTIQUE",
  general: "TOTAL",
};

export const GRP_LABELS: Record<Grp, string> = {
  je: "Jardin (JE1, JE2) — par trimestre",
  cp: "CP (CP1, CP2 A, CP2 B)",
  ce: "CE (CE1, CE2)",
  cm: "CM (CM1, CM2)",
};

export const GRPS: Grp[] = ["je", "cp", "ce", "cm"];

/** Groupe de feuille d'une classe du primaire, d'après son nom ; null si ce n'est pas le primaire. */
export function groupOf(className: string): Grp | null {
  const n = className.trim().toUpperCase();
  if (n.startsWith("JE") || n.startsWith("JARDIN")) return "je";
  if (n.startsWith("CP")) return "cp";
  if (n.startsWith("CE")) return "ce";
  if (n.startsWith("CM")) return "cm";
  return null;
}

export type PSubject = {
  id: string;
  grp: Grp;
  block: Block;
  name: string;
  max: number;
  coef: number;
  order: number;
  active: boolean;
};

/** Matières actives d'un groupe, dans l'ordre de la feuille. */
export function subjectsFor(all: PSubject[], grp: Grp): PSubject[] {
  return all.filter((s) => s.grp === grp && s.active).sort((a, b) => a.order - b.order);
}

// ---------- Mois ----------

const NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
const SHORT = ["Janv", "Fév", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

export type MonthInfo = { key: string; label: string; short: string };

/** Septembre à décembre de l'année de rentrée, puis janvier à juin. */
export function schoolMonths(startYear: number): MonthInfo[] {
  return [9, 10, 11, 12, 1, 2, 3, 4, 5, 6].map((m) => {
    const year = m >= 9 ? startYear : startYear + 1;
    return {
      key: `${year}-${String(m).padStart(2, "0")}`,
      label: NAMES[m - 1] ?? "",
      short: SHORT[m - 1] ?? "",
    };
  });
}

/** Année de rentrée : celle du premier trimestre, sinon déduite de la date du jour. */
export function schoolStartYear(firstTermStart: string | undefined, now: Date): number {
  const y = Number((firstTermStart ?? "").slice(0, 4));
  if (Number.isFinite(y) && y > 2000) return y;
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Le Jardin se note par trimestre (comme sa feuille), le reste du primaire par mois. */
export const TRIMESTERS: MonthInfo[] = [
  { key: "T1", label: "1er trimestre", short: "1er trim." },
  { key: "T2", label: "2e trimestre", short: "2e trim." },
  { key: "T3", label: "3e trimestre", short: "3e trim." },
];

export function periodsFor(grp: Grp | null, months: MonthInfo[]): MonthInfo[] {
  return grp === "je" ? TRIMESTERS : months;
}

/** Période proposée par défaut selon la date du jour. */
export function defaultPeriodKey(grp: Grp | null, months: MonthInfo[], now: Date): string {
  if (grp !== "je") return defaultMonthKey(months, now);
  const m = now.getMonth();
  if (m >= 8) return "T1";
  return m <= 2 ? "T2" : "T3";
}

/** Mois courant s'il fait partie de l'année scolaire, sinon septembre. */
export function defaultMonthKey(months: MonthInfo[], now: Date): string {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return months.some((m) => m.key === key) ? key : (months[0]?.key ?? "");
}

// ---------- Notes ----------

export const scoreKey = (studentId: string, subjectId: string, month: string) =>
  `${studentId}|${subjectId}|${month}`;

/** "16,5" ou "16.5" → 16.5 ; "" → null ; hors de 0 au barème → erreur. */
export function parseScore(raw: string, max: number, label: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw new Error(`${label} : note invalide « ${raw} » (entre 0 et ${max}).`);
  }
  return n;
}

export function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

export type BlockTotal = { total: number; sur: number; count: number };

export type MonthResult = {
  total: number;
  sur: number;
  /** Moyenne sur 10, ou null si aucune note. */
  average: number | null;
  entered: number;
  expected: number;
  blocks: Record<Block, BlockTotal>;
};

/** Résultat d'un élève pour un mois, à partir d'une fonction qui donne la note de chaque matière. */
export function computeFrom(
  subjects: PSubject[],
  get: (subject: PSubject) => number | null,
): MonthResult {
  const blocks: Record<Block, BlockTotal> = {
    francais: { total: 0, sur: 0, count: 0 },
    calcul: { total: 0, sur: 0, count: 0 },
    lecon: { total: 0, sur: 0, count: 0 },
    art: { total: 0, sur: 0, count: 0 },
    general: { total: 0, sur: 0, count: 0 },
  };
  let total = 0;
  let sur = 0;
  let coefSum = 0;
  let weighted = 0;
  let entered = 0;
  for (const s of subjects) {
    const v = get(s);
    if (v === null) continue;
    entered += 1;
    total += v;
    sur += s.max;
    coefSum += s.coef;
    weighted += (v / s.max) * s.coef;
    const b = blocks[s.block];
    b.total += v;
    b.sur += s.max;
    b.count += 1;
  }
  return {
    total,
    sur,
    average: coefSum > 0 ? Math.round((weighted / coefSum) * 10 * 1e6) / 1e6 : null,
    entered,
    expected: subjects.length,
    blocks,
  };
}

export function computeMonth(
  subjects: PSubject[],
  scores: Map<string, number>,
  studentId: string,
  month: string,
): MonthResult {
  return computeFrom(subjects, (s) => scores.get(scoreKey(studentId, s.id, month)) ?? null);
}

/** Rangs avec ex æquo : deux moyennes affichées identiques ont le même rang. */
export function ranks(entries: { id: string; value: number | null }[]): Map<string, number> {
  const valid: { id: string; value: number }[] = [];
  for (const e of entries) {
    if (e.value !== null) valid.push({ id: e.id, value: trunc2(e.value) });
  }
  const out = new Map<string, number>();
  for (const e of valid) {
    out.set(e.id, 1 + valid.filter((o) => o.value > e.value).length);
  }
  return out;
}

export type RankedMonth = { result: MonthResult; rank: number | null };

export function monthRanking(
  subjects: PSubject[],
  scores: Map<string, number>,
  studentIds: string[],
  month: string,
): Map<string, RankedMonth> {
  const results = new Map<string, MonthResult>();
  for (const id of studentIds) results.set(id, computeMonth(subjects, scores, id, month));
  const rk = ranks(studentIds.map((id) => ({ id, value: results.get(id)?.average ?? null })));
  const out = new Map<string, RankedMonth>();
  for (const id of studentIds) {
    const result = results.get(id);
    if (result) out.set(id, { result, rank: rk.get(id) ?? null });
  }
  return out;
}

export type YearResult = {
  months: Map<string, MonthResult>;
  /** Moyenne des moyennes mensuelles, sur 10. */
  annual: number | null;
  monthsWithData: number;
};

export function computeYear(
  subjects: PSubject[],
  scores: Map<string, number>,
  studentId: string,
  monthKeys: string[],
): YearResult {
  const months = new Map<string, MonthResult>();
  let sum = 0;
  let n = 0;
  for (const key of monthKeys) {
    const r = computeMonth(subjects, scores, studentId, key);
    months.set(key, r);
    if (r.average !== null) {
      sum += r.average;
      n += 1;
    }
  }
  return { months, annual: n > 0 ? Math.round((sum / n) * 1e6) / 1e6 : null, monthsWithData: n };
}

/** Impression en A4 paysage : seule la zone #print-area est imprimée. */
export const PRIMAIRE_PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: absolute; left: 0; top: 0; width: 100%; }
}
`;

/** Feuille du Jardin : A4 portrait. */
export const JARDIN_PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: absolute; left: 0; top: 0; width: 100%; }
}
`;
