import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Fiche de notes du collège (modèle « liste nominative » de l'école) :
 * Interrogations (jusqu'à 5, sur un barème choisi) · Devoirs (Note 1, Note 2, sur 20)
 * · MG C (moyenne de classe, calculée) · COMP (composition, sur 20).
 *
 * Chaque colonne est une évaluation de la base (table evaluations) et chaque note une ligne de grades.
 * Les valeurs MG C et COMP alimentent aussi le bulletin (table bulletin_notes).
 */

export type Kind = "interrogation" | "devoir" | "composition";

export type Slot = { key: string; kind: Kind; rank: number; label: string; title: string };

export const INTERRO_COUNT = 5;

export const SLOTS: Slot[] = [
  ...Array.from({ length: INTERRO_COUNT }, (_, i) => ({
    key: `interrogation-${i + 1}`,
    kind: "interrogation" as const,
    rank: i + 1,
    label: `Interro ${i + 1}`,
    title: `Interrogation ${i + 1}`,
  })),
  { key: "devoir-1", kind: "devoir", rank: 1, label: "Note 1", title: "Devoir 1" },
  { key: "devoir-2", kind: "devoir", rank: 2, label: "Note 2", title: "Devoir 2" },
  { key: "composition-1", kind: "composition", rank: 1, label: "Comp", title: "Composition" },
];

export const slotMax = (slot: Slot, interroMax: number): number => (slot.kind === "interrogation" ? interroMax : 20);

export type EvalRow = { id: string; key: string; max: number };

export type FicheData = {
  evals: Map<string, EvalRow>;
  /** Notes : clé « évaluation|élève ». */
  scores: Map<string, number>;
};

export const scoreId = (evaluationId: string, studentId: string) => `${evaluationId}|${studentId}`;

/* ------------------------------------------------------------------ calcul */

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Computed = {
  /** Moyenne des interrogations, ramenée sur 20. */
  interro: number | null;
  /** Moyenne de classe : moyenne de (moyenne des interrogations, Note 1, Note 2) parmi celles saisies. */
  mgc: number | null;
  comp: number | null;
};

/** Valeurs d'un élève : clé de colonne → note (ou null si vide). */
export function computeRow(values: (key: string) => number | null, interroMax: number): Computed {
  const interros: number[] = [];
  for (let i = 1; i <= INTERRO_COUNT; i += 1) {
    const v = values(`interrogation-${i}`);
    if (v !== null) interros.push((v / interroMax) * 20);
  }
  const interro = interros.length > 0 ? interros.reduce((a, b) => a + b, 0) / interros.length : null;

  const parts: number[] = [];
  if (interro !== null) parts.push(interro);
  for (const key of ["devoir-1", "devoir-2"]) {
    const v = values(key);
    if (v !== null) parts.push(v);
  }
  const mgc = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : null;

  return {
    interro: interro === null ? null : round2(interro),
    mgc: mgc === null ? null : round2(mgc),
    comp: values("composition-1"),
  };
}

/** "14,5" ou "14.5" → 14.5 ; "" → null ; hors de 0 au barème → erreur. */
export function parseNote(raw: string, max: number, label: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`${label} : note invalide « ${raw} » (entre 0 et ${max}).`);
  return n;
}

export const fmtNote = (n: number | null | undefined): string =>
  n === null || n === undefined || Number.isNaN(n) ? "" : String(Math.round(n * 100) / 100).replace(".", ",");

/* ------------------------------------------------------------------- accès */

type DbError = { message: string } | null;
type Row = Record<string, unknown>;
type Q = PromiseLike<{ data: Row[] | null; error: DbError }> & {
  eq: (c: string, v: string) => Q;
  in: (c: string, v: string[]) => Q;
  range: (a: number, b: number) => Q;
  single: () => PromiseLike<{ data: Row | null; error: DbError }>;
  select: (c: string) => Q;
};
type Write = PromiseLike<{ error: DbError }> & { eq: (c: string, v: string) => Write; in: (c: string, v: string[]) => Write };
type Db = {
  from: (t: string) => {
    select: (c: string) => Q;
    insert: (v: Row | Row[]) => Q;
    update: (v: Row) => Write;
    upsert: (v: Row[], o: { onConflict: string }) => Write;
    delete: () => Write;
  };
};
const db = supabase as unknown as Db;

function fail(error: DbError): void {
  if (error) throw new Error(error.message);
}

export async function loadFiche(classId: string, subjectId: string, termId: string): Promise<FicheData> {
  const ev = await db
    .from("evaluations")
    .select("id, kind, rank, max_score")
    .eq("class_id", classId)
    .eq("subject_id", subjectId)
    .eq("term_id", termId);
  fail(ev.error);
  const evals = new Map<string, EvalRow>();
  for (const r of ev.data ?? []) {
    const key = `${String(r["kind"])}-${Number(r["rank"])}`;
    evals.set(key, { id: String(r["id"]), key, max: Number(r["max_score"]) });
  }

  const scores = new Map<string, number>();
  const ids = [...evals.values()].map((e) => e.id);
  if (ids.length > 0) {
    for (let from = 0; ; from += 1000) {
      const g = await db.from("grades").select("evaluation_id, student_id, score").in("evaluation_id", ids).range(from, from + 999);
      fail(g.error);
      const page = g.data ?? [];
      for (const r of page) {
        if (r["score"] !== null && r["score"] !== undefined) {
          scores.set(scoreId(String(r["evaluation_id"]), String(r["student_id"])), Number(r["score"]));
        }
      }
      if (page.length < 1000) break;
    }
  }
  return { evals, scores };
}

export function useFiche(classId: string, subjectId: string, termId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ["fiche", classId, subjectId, termId],
    queryFn: () => loadFiche(classId, subjectId, termId),
    enabled: enabled && classId !== "" && subjectId !== "" && termId !== "",
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
  const data = useMemo(() => query.data ?? { evals: new Map(), scores: new Map() }, [query.data]);
  return { data, pending: query.isPending && query.fetchStatus !== "idle" };
}

export type Cells = Record<string, string>;

/**
 * Enregistre la fiche : crée les colonnes qui n'existent pas encore, écrit ou efface chaque note modifiée,
 * ajuste le barème des interrogations, puis recopie MG C et COMP dans le bulletin.
 */
export async function saveFiche(args: {
  classId: string;
  subjectId: string;
  termId: string;
  interroMax: number;
  data: FicheData;
  studentIds: string[];
  /** Valeurs affichées (texte) de chaque élève, et valeurs enregistrées au dernier chargement. */
  now: Map<string, Cells>;
  before: Map<string, Cells>;
}): Promise<{ written: number; cleared: number }> {
  const { classId, subjectId, termId, interroMax, data, studentIds, now, before } = args;
  if (!(interroMax > 0)) throw new Error("Le barème des interrogations doit être supérieur à 0.");

  // 1. Lire les notes saisies et repérer ce qui a changé
  const changes: { slot: Slot; studentId: string; value: number | null }[] = [];
  const nameOf = new Map<string, string>();
  for (const id of studentIds) nameOf.set(id, id);
  for (const studentId of studentIds) {
    const a = now.get(studentId) ?? {};
    const b = before.get(studentId) ?? {};
    for (const slot of SLOTS) {
      const raw = a[slot.key] ?? "";
      if (raw === (b[slot.key] ?? "")) continue;
      changes.push({ slot, studentId, value: parseNote(raw, slotMax(slot, interroMax), slot.label) });
    }
  }

  // 2. Barème des interrogations modifié : mettre à jour les colonnes existantes
  const interroEvals = SLOTS.filter((s) => s.kind === "interrogation")
    .map((s) => data.evals.get(s.key))
    .filter((e): e is EvalRow => e !== undefined);
  const staleMax = interroEvals.filter((e) => e.max !== interroMax).map((e) => e.id);
  if (staleMax.length > 0) {
    // Refuser si une note existante dépasse le nouveau barème
    for (const [key, v] of data.scores) {
      const evaluationId = key.split("|")[0] ?? "";
      if (staleMax.includes(evaluationId) && v > interroMax) {
        throw new Error(`Une interrogation contient la note ${fmtNote(v)}, supérieure au nouveau barème (${interroMax}).`);
      }
    }
    const up = await db.from("evaluations").update({ max_score: interroMax }).in("id", staleMax);
    fail(up.error);
    for (const e of interroEvals) e.max = interroMax;
  }

  // 3. Créer les colonnes nécessaires (une colonne naît à sa première note)
  const evals = new Map(data.evals);
  const needed = [...new Set(changes.filter((c) => c.value !== null).map((c) => c.slot.key))];
  for (const key of needed) {
    if (evals.has(key)) continue;
    const slot = SLOTS.find((s) => s.key === key);
    if (!slot) continue;
    const ins = await db
      .from("evaluations")
      .insert({
        class_id: classId,
        subject_id: subjectId,
        term_id: termId,
        title: slot.title,
        eval_date: new Date().toISOString().slice(0, 10),
        max_score: slotMax(slot, interroMax),
        kind: slot.kind,
        rank: slot.rank,
      })
      .select("id")
      .single();
    fail(ins.error);
    evals.set(key, { id: String((ins.data as Row)["id"]), key, max: slotMax(slot, interroMax) });
  }

  // 4. Écrire / effacer les notes
  const upserts: Row[] = [];
  const clears = new Map<string, string[]>(); // évaluation → élèves
  for (const c of changes) {
    const ev = evals.get(c.slot.key);
    if (!ev) continue;
    if (c.value === null) {
      const list = clears.get(ev.id) ?? [];
      list.push(c.studentId);
      clears.set(ev.id, list);
    } else {
      upserts.push({ evaluation_id: ev.id, student_id: c.studentId, score: c.value });
    }
  }
  for (let i = 0; i < upserts.length; i += 500) {
    const r = await db.from("grades").upsert(upserts.slice(i, i + 500), { onConflict: "evaluation_id,student_id" });
    fail(r.error);
  }
  let cleared = 0;
  for (const [evaluationId, students] of clears) {
    for (let i = 0; i < students.length; i += 80) {
      const r = await db.from("grades").delete().eq("evaluation_id", evaluationId).in("student_id", students.slice(i, i + 80));
      fail(r.error);
    }
    cleared += students.length;
  }

  // 5. Recopier MG C et COMP dans le bulletin
  await syncBulletin({
    subjectId,
    termId,
    interroMax,
    studentIds,
    cells: now,
    touchedIds: new Set(changes.map((c) => c.studentId)),
  });
  return { written: upserts.length, cleared };
}

/** Recopie la moyenne de classe et la composition de chaque élève dans le bulletin. */
export async function syncBulletin(args: {
  subjectId: string;
  termId: string;
  interroMax: number;
  studentIds: string[];
  cells: Map<string, Cells>;
  /** Élèves dont une note vient de changer : leur ligne de bulletin est mise à jour même si elle devient vide. */
  touchedIds: ReadonlySet<string>;
}): Promise<void> {
  const rows: Row[] = [];
  for (const studentId of args.studentIds) {
    const a = args.cells.get(studentId) ?? {};
    const value = (key: string): number | null => {
      const raw = (a[key] ?? "").trim().replace(",", ".");
      if (raw === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    const c = computeRow(value, args.interroMax);
    // Une ligne de bulletin saisie à la main n'est jamais vidée par une fiche qu'on n'a pas touchée.
    if (c.mgc === null && c.comp === null && !args.touchedIds.has(studentId)) continue;
    rows.push({
      student_id: studentId,
      subject_id: args.subjectId,
      term_id: args.termId,
      class_avg: c.mgc,
      composition: c.comp,
    });
  }
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 200) {
    const r = await db.from("bulletin_notes").upsert(rows.slice(i, i + 200), { onConflict: "student_id,subject_id,term_id" });
    fail(r.error);
  }
}

/** Supprime une colonne entière (une interrogation, un devoir ou la composition) et ses notes. */
export async function deleteColumn(evaluationId: string): Promise<void> {
  const g = await db.from("grades").delete().eq("evaluation_id", evaluationId);
  fail(g.error);
  const e = await db.from("evaluations").delete().eq("id", evaluationId);
  fail(e.error);
}
