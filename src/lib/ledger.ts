import { supabase } from "@/integrations/supabase/client";

/**
 * Recettes, dépenses et tontine. Ces tables sont récentes et absentes des
 * types générés : on utilise un client typé de façon souple.
 */
export type LedgerKind = "incomes" | "expenses";

export type LedgerItem = {
  id: string;
  date: string;
  category: string;
  label: string | null;
  amount: number;
};

export type TontineDeposit = {
  id: string;
  student_id: string;
  amount: number;
  deposit_date: string;
  note: string | null;
  settled_at: string | null;
  created_at: string;
};

type DbError = { message: string } | null;
type Row = Record<string, unknown>;
type LooseDb = {
  from: (table: string) => {
    select: (cols: string) => {
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => Promise<{ data: Row[] | null; error: DbError }>;
    };
    insert: (values: Row) => Promise<{ error: DbError }>;
    delete: () => { eq: (col: string, value: string) => Promise<{ error: DbError }> };
  };
  rpc: (fn: string, args: Row) => Promise<{ data: unknown; error: DbError }>;
};

const db = supabase as unknown as LooseDb;

const dateColumn = (kind: LedgerKind) => (kind === "incomes" ? "income_date" : "expense_date");

export function ledgerQuery(kind: LedgerKind) {
  const dateCol = dateColumn(kind);
  return {
    queryKey: ["ledger", kind],
    queryFn: async (): Promise<LedgerItem[]> => {
      const { data, error } = await db.from(kind).select("*").order(dateCol, { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: String(r["id"]),
        date: String(r[dateCol]),
        category: String(r["category"]),
        label: (r["label"] as string | null) ?? null,
        amount: Number(r["amount"]),
      }));
    },
  };
}

export async function addLedgerItem(
  kind: LedgerKind,
  v: { date: string; category: string; label: string | null; amount: number },
): Promise<void> {
  const { error } = await db.from(kind).insert({
    [dateColumn(kind)]: v.date,
    category: v.category,
    label: v.label,
    amount: v.amount,
  });
  if (error) throw new Error(error.message);
}

export async function removeLedgerItem(kind: LedgerKind, id: string): Promise<void> {
  const { error } = await db.from(kind).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export const tontineQuery = {
  queryKey: ["tontine"],
  queryFn: async (): Promise<TontineDeposit[]> => {
    const { data, error } = await db
      .from("tontine_deposits")
      .select("*")
      .order("deposit_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: String(r["id"]),
      student_id: String(r["student_id"]),
      amount: Number(r["amount"]),
      deposit_date: String(r["deposit_date"]),
      note: (r["note"] as string | null) ?? null,
      settled_at: (r["settled_at"] as string | null) ?? null,
      created_at: String(r["created_at"]),
    }));
  },
};

export async function addTontineDeposit(v: {
  studentId: string;
  amount: number;
  date: string;
  note: string | null;
}): Promise<void> {
  const { error } = await db.from("tontine_deposits").insert({
    student_id: v.studentId,
    amount: v.amount,
    deposit_date: v.date,
    note: v.note,
  });
  if (error) throw new Error(error.message);
}

export async function removeTontineDeposit(id: string): Promise<void> {
  const { error } = await db.from("tontine_deposits").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Applique à l'écolage tous les versements non appliqués d'un élève pour un mois ("AAAA-MM-01"). */
export async function settleTontine(studentId: string, monthStart: string): Promise<void> {
  const { error } = await db.rpc("settle_tontine", { _student_id: studentId, _month: monthStart });
  if (error) throw new Error(error.message);
}

/** Applique les versements de tous les élèves pour un mois ; renvoie le nombre d'élèves traités. */
export async function settleTontineMonth(monthStart: string): Promise<number> {
  const { data, error } = await db.rpc("settle_tontine_month", { _month: monthStart });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
