import { supabase } from "@/integrations/supabase/client";

/**
 * Réductions familiales, bourses et arriérés.
 * Les tables sont récentes et absentes des types générés : on utilise donc
 * un client typé de façon souple pour les appeler.
 */
export type AdjustmentKind = "reduction_familiale" | "bourse" | "arriere";

export type FeeAdjustment = {
  id: string;
  student_id: string;
  kind: AdjustmentKind;
  amount: number;
  label: string | null;
  created_at: string;
};

type RpcResult = { data: unknown; error: { message: string } | null };
type LooseDb = {
  from: (table: string) => {
    select: (cols: string) => {
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => Promise<{ data: FeeAdjustment[] | null; error: { message: string } | null }>;
    };
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
};

const db = supabase as unknown as LooseDb;

export const adjustmentsQuery = {
  queryKey: ["fee-adjustments"],
  queryFn: async (): Promise<FeeAdjustment[]> => {
    const { data, error } = await db
      .from("fee_adjustments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((a) => ({ ...a, amount: Number(a.amount) }));
  },
};

/** Ajoute l'ajustement ET met à jour l'écolage de l'élève (fonction côté base). */
export async function addAdjustment(input: {
  studentId: string;
  kind: AdjustmentKind;
  amount: number;
  label: string | null;
}): Promise<void> {
  const { error } = await db.rpc("add_fee_adjustment", {
    _student_id: input.studentId,
    _kind: input.kind,
    _amount: input.amount,
    _label: input.label,
  });
  if (error) throw new Error(error.message);
}

/** Retire l'ajustement ET rétablit l'écolage de l'élève. */
export async function removeAdjustment(id: string): Promise<void> {
  const { error } = await db.rpc("remove_fee_adjustment", { _adjustment_id: id });
  if (error) throw new Error(error.message);
}

export type ArrearSettlement = {
  /** Somme payée depuis l'enregistrement de l'arriéré, plafonnée au montant dû. */
  paid: number;
  /** Date du paiement qui a soldé l'arriéré ; null s'il n'est pas (encore) soldé. */
  paidOn: string | null;
};

/**
 * Pour chaque arriéré : à quelle date l'élève a fini de le payer.
 * Les paiements enregistrés depuis la création de l'arriéré sont imputés dessus en priorité
 * (il est exigible immédiatement), par ordre de date, puis sur l'arriéré suivant s'il y en a plusieurs.
 */
export function arrearSettlements(
  adjustments: FeeAdjustment[],
  payments: { student_id: string; amount: number; paid_at: string; created_at?: string }[],
): Map<string, ArrearSettlement> {
  const out = new Map<string, ArrearSettlement>();
  const arrears = adjustments
    .filter((a) => a.kind === "arriere")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Reste à imputer de chaque paiement (par élève, du plus ancien au plus récent).
  const pools = new Map<string, { date: string; left: number }[]>();
  for (const p of [...payments].sort(
    (a, b) => a.paid_at.localeCompare(b.paid_at) || (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  )) {
    const list = pools.get(p.student_id) ?? [];
    list.push({ date: p.paid_at.slice(0, 10), left: Number(p.amount) });
    pools.set(p.student_id, list);
  }

  for (const a of arrears) {
    const since = a.created_at.slice(0, 10);
    let need = a.amount;
    let paid = 0;
    let paidOn: string | null = null;
    for (const chunk of pools.get(a.student_id) ?? []) {
      if (need <= 0) break;
      if (chunk.date < since || chunk.left <= 0) continue;
      const used = Math.min(chunk.left, need);
      chunk.left -= used;
      need -= used;
      paid += used;
      if (need <= 0) paidOn = chunk.date;
    }
    out.set(a.id, { paid, paidOn });
  }
  return out;
}

