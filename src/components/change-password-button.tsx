import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

/** Permet à l'utilisateur connecté de choisir lui-même son mot de passe. */
export function ChangePasswordButton({ className }: { className?: string }) {
  async function change() {
    const value = window.prompt("Nouveau mot de passe (8 caractères minimum) :");
    if (value === null) return;
    if (value.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: value });
    if (error) toast.error("Changement impossible", { description: error.message });
    else toast.success("Mot de passe modifié.");
  }

  return (
    <button type="button" onClick={change} className={className}>
      Changer mon mot de passe
    </button>
  );
}
