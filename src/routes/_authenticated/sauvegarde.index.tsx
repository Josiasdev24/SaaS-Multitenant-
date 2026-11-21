import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  BACKUP_EVERY_DAYS,
  autoBackupEnabled,
  daysSince,
  downloadExcel,
  downloadJson,
  exportAll,
  lastBackup,
  markBackup,
  setAutoBackup,
  type BackupData,
} from "@/lib/backup";
import { useCurrentUser } from "@/lib/session";
import { EmptyRow, LoadingBlock, NoAccess, PageHeader, Panel, TableWrap, Td, Th } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/sauvegarde/")({
  head: () => ({ meta: [{ title: "Sauvegarde" }] }),
  component: BackupPage,
});

const button =
  "h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const plain =
  "h-9 rounded-md border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted disabled:opacity-60";

function BackupPage() {
  const { data: user } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [last, setLast] = useState<Date | null>(() => lastBackup());
  const [auto, setAuto] = useState(() => autoBackupEnabled());
  const [result, setResult] = useState<BackupData | null>(null);

  if (!user) return <LoadingBlock />;
  if (user.role !== "admin") return <NoAccess />;

  async function run(kind: "excel" | "json") {
    setBusy(true);
    setResult(null);
    try {
      const data = await exportAll((done, total, table) =>
        setProgress(table ? `Lecture de « ${table} » (${done + 1}/${total})…` : "Préparation du fichier…"),
      );
      const filename = kind === "excel" ? downloadExcel(data) : downloadJson(data);
      markBackup(data.exportedAt);
      setLast(new Date(data.exportedAt));
      setResult(data);
      toast.success("Sauvegarde téléchargée", { description: filename });
    } catch (e) {
      toast.error("Sauvegarde impossible", { description: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  const days = daysSince(last);

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Sauvegarde des données"
        subtitle="Une copie de toutes les données de l'école, enregistrée sur cet appareil"
      />

      <Panel>
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="text-[13px]">
            <div className="label-caps">Dernière sauvegarde sur cet appareil</div>
            <div className="mt-1 text-[15px] font-semibold">
              {last
                ? `${last.toLocaleDateString("fr-FR")} à ${last.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                : "Aucune"}
              {days !== null ? <span className="ml-2 text-[13px] font-normal text-muted-foreground">(il y a {days} jour(s))</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => void run("excel")} className={button}>
              {busy ? "Sauvegarde en cours…" : "Télécharger la sauvegarde (Excel)"}
            </button>
            <button type="button" disabled={busy} onClick={() => void run("json")} className={plain}>
              Format technique (JSON)
            </button>
          </div>
        </div>
        {progress ? <p className="mt-3 text-[12px] text-muted-foreground">{progress}</p> : null}

        <label className="mt-5 flex cursor-pointer items-start gap-2.5 border-t border-border pt-4 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked);
              setAutoBackup(e.target.checked);
            }}
          />
          <span>
            <span className="font-medium">Sauvegarde automatique</span> : à l'ouverture de l'application, si la dernière
            sauvegarde de cet appareil date de {BACKUP_EVERY_DAYS} jours ou plus, le fichier est téléchargé tout seul. Ce
            réglage est propre à chaque appareil (ordinateur, téléphone).
          </span>
        </label>
      </Panel>

      <Panel>
        <h2 className="text-[15px] font-semibold">À savoir</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-muted-foreground">
          <li>Le fichier arrive dans le dossier « Téléchargements » de l'appareil. Copiez-le sur un ordinateur de l'école et sur une clé USB.</li>
          <li>Il contient les données personnelles des élèves et des parents : ne l'envoyez à personne et ne le laissez pas sur un appareil partagé.</li>
          <li>Le fichier Excel se lit sans l'application. Le format JSON sert à restaurer les données en cas de besoin.</li>
          <li>Une application ne peut pas télécharger de fichier quand elle est fermée : la sauvegarde automatique se déclenche donc quand le Fondateur ouvre l'application.</li>
        </ul>
      </Panel>

      {result ? (
        <TableWrap minWidth={420}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Table sauvegardée</Th>
              <Th className="text-right">Lignes</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Object.entries(result.tables).length === 0 ? (
              <EmptyRow colSpan={2} label="Aucune table." />
            ) : (
              Object.entries(result.tables).map(([name, rows]) => (
                <tr key={name}>
                  <Td>{name}</Td>
                  <Td className="num-display text-right">{rows.length}</Td>
                </tr>
              ))
            )}
            {result.errors.map((e) => (
              <tr key={e.table}>
                <Td className="text-late">{e.table}</Td>
                <Td className="text-late">non lue : {e.message}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : null}
    </div>
  );
}
