import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Suppression avec confirmation, réservée au Fondateur (les pages n'affichent le bouton que pour lui).
 * - message : ce qui va disparaître, affiché avant de confirmer ;
 * - typeToConfirm : si renseigné, il faut taper ce texte (classes, matières…) pour confirmer ;
 * - blockedReason : si renseigné, la suppression est refusée tout de suite avec ce message.
 */

type DeleteResult = { error: { message: string } | null; data: unknown[] | null };

function friendly(message: string): string {
  if (/foreign key|violates/i.test(message)) {
    return "Cet élément est encore utilisé ailleurs (par exemple des évaluations liées). Supprimez d'abord ce qui en dépend.";
  }
  if (/row-level security|permission denied/i.test(message)) {
    return "Vous n'avez pas le droit de supprimer cet élément.";
  }
  return message;
}

/** Vérifie une suppression qui doit effacer au moins une ligne (erreur sinon). */
export function ensureDeleted(result: DeleteResult): number {
  if (result.error) throw new Error(friendly(result.error.message));
  const count = result.data?.length ?? 0;
  if (count === 0) {
    throw new Error(
      "Rien n'a été supprimé : l'élément n'existe plus ou vous n'avez pas le droit de le supprimer.",
    );
  }
  return count;
}

/** Vérifie une suppression qui peut légitimement ne rien effacer (erreur seulement si la base refuse). */
export function ensureNoError(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(friendly(result.error.message));
}

export function DeleteAction({
  label = "Supprimer",
  message,
  typeToConfirm,
  blockedReason,
  success,
  run,
  className,
}: {
  label?: string | undefined;
  message: string;
  typeToConfirm?: string | undefined;
  blockedReason?: string | undefined;
  success: string;
  run: () => Promise<unknown>;
  className?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: run,
    onSuccess: () => {
      toast.success(success);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  function ask() {
    if (blockedReason) {
      toast.error("Suppression impossible", { description: blockedReason });
      return;
    }
    if (typeToConfirm) {
      const answer = window.prompt(`${message}\n\nPour confirmer, tapez exactement : ${typeToConfirm}`);
      if (answer === null) return;
      if (answer.trim().toUpperCase() !== typeToConfirm.trim().toUpperCase()) {
        toast.error("Suppression annulée", { description: "Le texte saisi ne correspond pas." });
        return;
      }
    } else if (!window.confirm(message)) {
      return;
    }
    mutation.mutate();
  }

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={ask}
      className={
        className ?? "text-[13px] font-medium text-destructive hover:underline disabled:opacity-50"
      }
    >
      {mutation.isPending ? "Suppression…" : label}
    </button>
  );
}
