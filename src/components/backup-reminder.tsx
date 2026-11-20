import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  autoBackupEnabled,
  daysSince,
  downloadExcel,
  exportAll,
  isBackupDue,
  lastBackup,
  markBackup,
} from "@/lib/backup";

/**
 * Rappel et sauvegarde automatique pour le Fondateur : si la dernière sauvegarde de cet appareil date de
 * deux jours ou plus, le fichier est téléchargé à l'ouverture de l'application. Si le navigateur refuse
 * le téléchargement automatique, un bandeau propose de le faire en un clic.
 */
export function BackupReminder() {
  const [due, setDue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const started = useRef(false);

  async function run(manual: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const data = await exportAll();
      const filename = downloadExcel(data);
      markBackup(data.exportedAt);
      setDue(false);
      toast.success("Sauvegarde téléchargée", {
        description:
          data.errors.length > 0
            ? `${filename} — ${data.errors.length} table(s) n'ont pas pu être lues.`
            : `${filename} — gardez-la sur un ordinateur de l'école.`,
      });
    } catch (e) {
      if (manual) toast.error("Sauvegarde impossible", { description: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!isBackupDue(lastBackup())) return;
    setDue(true);
    if (autoBackupEnabled()) {
      const timer = window.setTimeout(() => void run(false), 5000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!due || dismissed) return null;
  const days = daysSince(lastBackup());
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-red bg-card px-4 py-3 text-[13px] print:hidden">
      <span className="font-semibold text-late">Sauvegarde des données</span>
      <span className="text-muted-foreground">
        {days === null ? "Aucune sauvegarde n'a encore été faite sur cet appareil." : `La dernière date de ${days} jour(s).`}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(true)}
        className="ml-auto h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Sauvegarde en cours…" : "Sauvegarder maintenant"}
      </button>
      <button type="button" onClick={() => setDismissed(true)} className="text-muted-foreground hover:underline">
        Plus tard
      </button>
    </div>
  );
}
