import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";

/**
 * Sauvegarde des données de l'école : toutes les tables de l'application sont lues et enregistrées
 * dans un fichier téléchargé sur l'appareil (ordinateur ou téléphone). Réservé au Fondateur.
 */

export const BACKUP_TABLES = [
  "academic_years",
  "attendance",
  "bulletin_notes",
  "bulletin_remarks",
  "class_subjects",
  "classes",
  "education_levels",
  "evaluations",
  "expenses",
  "fee_adjustment_effects",
  "fee_adjustments",
  "fee_payments",
  "grades",
  "incomes",
  "parents",
  "payment_deletions",
  "primary_scores",
  "primary_subjects",
  "report_cards",
  "school_cycles",
  "school_fees",
  "student_fees",
  "student_parents",
  "students",
  "subjects",
  "teacher_subjects",
  "teachers",
  "terms",
  "tontine_deposits",
] as const;

export type BackupRow = Record<string, unknown>;

export type BackupData = {
  exportedAt: string;
  tables: Record<string, BackupRow[]>;
  errors: { table: string; message: string }[];
};

type Page = PromiseLike<{ data: BackupRow[] | null; error: { message: string } | null }> & {
  range: (a: number, b: number) => Page;
};
type LooseDb = { from: (table: string) => { select: (cols: string) => Page } };
const db = supabase as unknown as LooseDb;

const PAGE = 1000;

/** Lit toutes les lignes de toutes les tables. Une table illisible est signalée sans arrêter la sauvegarde. */
export async function exportAll(onProgress?: (done: number, total: number, table: string) => void): Promise<BackupData> {
  const tables: Record<string, BackupRow[]> = {};
  const errors: { table: string; message: string }[] = [];
  let done = 0;
  for (const table of BACKUP_TABLES) {
    onProgress?.(done, BACKUP_TABLES.length, table);
    const rows: BackupRow[] = [];
    try {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db.from(table).select("*").range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        const page = data ?? [];
        rows.push(...page);
        if (page.length < PAGE) break;
      }
    } catch (e) {
      errors.push({ table, message: e instanceof Error ? e.message : "Erreur inconnue" });
    }
    tables[table] = rows;
    done += 1;
  }
  onProgress?.(done, BACKUP_TABLES.length, "");
  return { exportedAt: new Date().toISOString(), tables, errors };
}

const MAX_CELL = 32000; // limite d'une cellule Excel : 32 767 caractères

function cleanRow(row: BackupRow): BackupRow {
  const out: BackupRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && typeof v === "object") out[k] = JSON.stringify(v);
    else if (typeof v === "string" && v.length > MAX_CELL) out[k] = v.slice(0, MAX_CELL);
    else out[k] = v;
  }
  return out;
}

/** Classeur Excel : une feuille « LISEZ-MOI » puis une feuille par table. */
export function buildWorkbook(data: BackupData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const summary: (string | number)[][] = [
    ["Sauvegarde des données"],
    ["Date de la sauvegarde", data.exportedAt],
    ["Ce fichier contient des données personnelles (élèves, parents, paiements) : ne le partagez pas."],
    [],
    ["Table", "Nombre de lignes"],
    ...Object.entries(data.tables).map(([name, rows]) => [name, rows.length] as (string | number)[]),
  ];
  if (data.errors.length > 0) {
    summary.push([], ["Tables non sauvegardées (erreur)"]);
    for (const e of data.errors) summary.push([e.table, e.message]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "LISEZ-MOI");
  for (const [name, rows] of Object.entries(data.tables)) {
    const sheet = rows.length > 0 ? XLSX.utils.json_to_sheet(rows.map(cleanRow)) : XLSX.utils.aoa_to_sheet([["(vide)"]]);
    XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31));
  }
  return wb;
}

export const stamp = (iso: string) => iso.slice(0, 16).replace("T", "_").replace(":", "h");

export function downloadExcel(data: BackupData): string {
  const filename = `sauvegarde-${stamp(data.exportedAt)}.xlsx`;
  XLSX.writeFile(buildWorkbook(data), filename);
  return filename;
}

export function downloadJson(data: BackupData): string {
  const filename = `sauvegarde-${stamp(data.exportedAt)}.json`;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return filename;
}

/* ------------------------------------------------- mémoire de l'appareil */

const LAST_KEY = "sw-backup-last";
const AUTO_KEY = "sw-backup-auto";
export const BACKUP_EVERY_DAYS = 2;

export function lastBackup(): Date | null {
  try {
    const v = window.localStorage.getItem(LAST_KEY);
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

export function markBackup(iso: string): void {
  try {
    window.localStorage.setItem(LAST_KEY, iso);
  } catch {
    /* stockage indisponible : la sauvegarde reste valable */
  }
}

/** Sauvegarde automatique à l'ouverture de l'application : activée par défaut. */
export function autoBackupEnabled(): boolean {
  try {
    return window.localStorage.getItem(AUTO_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAutoBackup(on: boolean): void {
  try {
    window.localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    /* ignoré */
  }
}

export function daysSince(date: Date | null, now = new Date()): number | null {
  return date ? Math.floor((now.getTime() - date.getTime()) / 86_400_000) : null;
}

export function isBackupDue(date: Date | null, now = new Date(), everyDays = BACKUP_EVERY_DAYS): boolean {
  const d = daysSince(date, now);
  return d === null || d >= everyDays;
}
