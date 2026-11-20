import { supabase } from "@/integrations/supabase/client";
import { getActiveSchoolId } from "./active-school";

/**
 * Réglages de l'école active (table schools). Typage souple : les types
 * générés seront mis à jour avec le nouveau schéma.
 */
type LooseDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { secretary_can_collect: boolean } | null;
          error: { message: string } | null;
        }>;
      };
    };
    update: (values: { secretary_can_collect: boolean }) => {
      eq: (col: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

const db = supabase as unknown as LooseDb;

/** La secrétaire peut-elle encaisser les paiements dans cette école ? (faux par défaut) */
export async function getSecretaryCanCollect(): Promise<boolean> {
  const id = getActiveSchoolId();
  if (!id) return false;
  try {
    const { data } = await db.from("schools").select("secretary_can_collect").eq("id", id).maybeSingle();
    return data?.secretary_can_collect === true;
  } catch {
    return false;
  }
}

/** Réservé au Fondateur (la base refuse les autres). */
export async function setSecretaryCanCollect(value: boolean): Promise<void> {
  const id = getActiveSchoolId();
  if (!id) throw new Error("Aucune école active");
  const { error } = await db.from("schools").update({ secretary_can_collect: value }).eq("id", id);
  if (error) throw new Error(error.message);
}
