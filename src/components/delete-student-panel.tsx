import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { Panel } from "@/components/kit";

/**
 * Suppression définitive d'un élève — réservée au fondateur.
 * Supprimer un élève efface AUSSI tout ce qui le concerne (paiements, frais, notes, bulletins,
 * absences, tontine, liens avec les parents…). Il faut taper son matricule pour confirmer.
 */
export function DeleteStudentPanel({
  studentId,
  name,
  matricule,
  paymentCount,
  paidTotal,
  gradeCount,
  absenceCount,
}: {
  studentId: string;
  name: string;
  matricule: string;
  paymentCount: number | null;
  paidTotal: number | null;
  gradeCount: number | null;
  absenceCount: number | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").delete().eq("id", studentId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Élève supprimé", { description: `${name} et toutes ses données ont été effacés.` });
      queryClient.invalidateQueries();
      void navigate({ to: "/eleves" });
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  const confirmed = typed.trim().toUpperCase() === matricule.trim().toUpperCase();

  return (
    <Panel className="border-destructive/40">
      <h2 className="text-[15px] font-semibold text-destructive">Supprimer cet élève</h2>
      {!open ? (
        <>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Action réservée au fondateur. Elle est définitive et efface aussi toutes les données de
            l'élève.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 h-9 rounded-md border border-destructive/50 px-3.5 text-[13px] font-medium text-destructive hover:bg-destructive/10"
          >
            Supprimer l'élève…
          </button>
        </>
      ) : (
        <div className="mt-3 space-y-3 text-[13px]">
          <p>
            Vous allez supprimer définitivement <span className="font-semibold">{name}</span> (
            {matricule}). <span className="font-semibold">Tout ce qui le concerne disparaît aussi :</span>
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              ses paiements et ses reçus
              {paymentCount !== null
                ? ` (${paymentCount} paiement(s), ${money(paidTotal ?? 0)} encaissé)`
                : ""}
              , son écolage, ses réductions, bourses et arriérés ;
            </li>
            <li>
              ses notes et ses bulletins
              {gradeCount !== null ? ` (${gradeCount} note(s) enregistrée(s))` : ""}, ses
              observations ;
            </li>
            <li>
              ses absences et retards
              {absenceCount !== null ? ` (${absenceCount})` : ""} ;
            </li>
            <li>ses versements de tontine et ses liens avec ses parents.</li>
          </ul>
          <p className="text-muted-foreground">
            Si l'élève a simplement quitté l'école, il est préférable de changer sa situation
            (Transféré, Sorti ou Archivé) dans « État civil → Modifier » : il disparaît alors de la
            liste, mais son historique est conservé.
          </p>
          <div>
            <label htmlFor="confirm-matricule" className="label-caps">
              Pour confirmer, tapez son matricule : <span className="font-semibold">{matricule}</span>
            </label>
            <input
              id="confirm-matricule"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-1.5 h-9 w-full max-w-xs rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-destructive/60"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!confirmed || remove.isPending}
              onClick={() => remove.mutate()}
              className="h-9 rounded-md bg-destructive px-3.5 text-[13px] font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {remove.isPending ? "Suppression…" : "Supprimer définitivement"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
              className="h-9 rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
