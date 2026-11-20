import { supabase } from "@/integrations/supabase/client";

const RECEIPT_START = 1001;

/** Plus grand numéro de reçu numérique déjà utilisé, lu dans la base au moment de l'enregistrement. */
export async function latestReceiptNumber(): Promise<number> {
  const { data, error } = await supabase
    .from("fee_payments")
    .select("receipt_number")
    .not("receipt_number", "is", null)
    .order("receipt_number", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  let max = RECEIPT_START - 1;
  for (const row of data ?? []) {
    const r = String(row.receipt_number ?? "");
    if (/^\d+$/.test(r)) max = Math.max(max, Number(r));
  }
  return max;
}

export const formatReceipt = (n: number) => String(n).padStart(7, "0");
