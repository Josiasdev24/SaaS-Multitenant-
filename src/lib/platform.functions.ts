import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const accountSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  fullName: z.string().trim().min(1).max(200),
  role: z.enum(["founder", "director", "secretary", "teacher", "primary"]),
  cycleCodes: z.array(z.string().regex(/^[a-z0-9_]{1,30}$/)).max(10).default([]),
});

const inputSchema = z.object({
  schoolId: z.string().uuid(),
  accounts: z.array(accountSchema).min(1).max(200),
});

export type AccountResult = {
  email: string;
  fullName: string;
  role: string;
  ok: boolean;
  /** Mot de passe provisoire (null si le compte existait déjà). */
  password: string | null;
  message: string;
};

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPassword(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Crée les comptes d'une école en une fois (super-administrateur uniquement).
 * La clé de service reste côté serveur ; le rattachement à l'école passe par
 * une fonction de la base qui revérifie que l'appelant est super-administrateur.
 */
export const createAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<AccountResult[]> => {
    const { supabase } = context;

    const { data: isSuper, error: superError } = await supabase.rpc("is_super_admin");
    if (superError || isSuper !== true) throw new Error("Accès refusé");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: AccountResult[] = [];

    for (const a of data.accounts) {
      const base = { email: a.email, fullName: a.fullName, role: a.role };
      try {
        let userId: string | null = null;
        let password: string | null = null;

        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", a.email)
          .maybeSingle();

        if (existing?.id) {
          userId = existing.id;
        } else {
          password = randomPassword();
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: a.email,
            password,
            email_confirm: true,
            user_metadata: { full_name: a.fullName },
          });
          if (error || !created.user) throw new Error(error?.message ?? "Création impossible");
          userId = created.user.id;
        }

        const { error: memberError } = await supabase.rpc("admin_add_member", {
          p_school: data.schoolId,
          p_user: userId,
          p_role: a.role,
          p_cycle_codes: a.cycleCodes,
          p_supervisor: false,
        });
        if (memberError) throw new Error(memberError.message);

        results.push({
          ...base,
          ok: true,
          password,
          message: password ? "Compte créé" : "Compte existant rattaché (mot de passe inchangé)",
        });
      } catch (e) {
        results.push({ ...base, ok: false, password: null, message: e instanceof Error ? e.message : "Erreur" });
      }
    }
    return results;
  });
