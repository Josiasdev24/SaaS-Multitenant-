import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/data";
import { todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { normalizeGender, splitFullName, generateImportMatricule } from "@/lib/validation";
import { PageHeader, Panel, LoadingBlock, TableWrap, Th, Td, EmptyRow } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/eleves/import")({
  head: () => ({
    meta: [{ title: "Importer des élèves — Complexe Scolaire Omarus Adodo" }],
  }),
  component: ImportPage,
});

type NameMode = "combined" | "separate";

type ColMap = {
  fullName: number | null;
  lastName: number | null;
  firstName: number | null;
  gender: number | null;
  className: number | null;
  birthDate: number | null;
  phone: number | null;
};

const emptyColMap: ColMap = {
  fullName: null,
  lastName: null,
  firstName: null,
  gender: null,
  className: null,
  birthDate: null,
  phone: null,
};

const selectClass =
  "h-9 w-full rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus:border-primary/50";

function downloadTemplate() {
  const rows = [
    ["Nom complet", "Sexe", "Classe"],
    ["ADE Carine Isabelle", "F", "JE1"],
    ["ADJETEVI Enock Jacob", "M", "JE1"],
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modele-import-eleves.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ImportPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const queryClient = useQueryClient();

  const classes = useQuery(q.classes());
  const students = useQuery(q.students());

  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [nameMode, setNameMode] = useState<NameMode>("combined");
  const [colMap, setColMap] = useState<ColMap>(emptyColMap);
  const [classMatch, setClassMatch] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    ok: number;
    failed: { row: number; label: string; reason: string }[];
  }>({
    ok: 0,
    failed: [],
  });

  async function handleFile(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      toast.error("Fichier vide", { description: "Aucune feuille trouvée dans le fichier." });
      return;
    }
    const sheet = wb.Sheets[firstSheetName];
    if (!sheet) {
      toast.error("Fichier vide", { description: "Feuille introuvable dans le fichier." });
      return;
    }
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown as (string | number)[][];
    const firstRow = rows[0];
    if (rows.length < 2 || !firstRow) {
      toast.error("Fichier vide", {
        description: "Aucune ligne de données trouvée après l'en-tête.",
      });
      return;
    }
    const rawHeader = firstRow.map((c) => String(c ?? "").trim());
    const rawData = rows
      .slice(1)
      .map((r) => rawHeader.map((_, i) => String((r ?? [])[i] ?? "").trim()));
    setFileName(file.name);
    setHeader(rawHeader);
    setDataRows(rawData);
    // Pré-remplissage naïf des colonnes par nom d'en-tête probable
    const findCol = (...needles: string[]) =>
      rawHeader.findIndex((h) => needles.some((n) => h.toLowerCase().includes(n)));
    const guessFull = findCol("nom complet", "noms & prenoms", "noms & prénoms", "nom et prénom");
    const guessLast = findCol("nom de famille") >= 0 ? findCol("nom de famille") : findCol("nom");
    const guessFirst = findCol("prenom", "prénom");
    setColMap({
      fullName: guessFull >= 0 ? guessFull : null,
      lastName: guessFull < 0 && guessLast >= 0 ? guessLast : null,
      firstName: guessFull < 0 && guessFirst >= 0 ? guessFirst : null,
      gender: findCol("sexe") >= 0 ? findCol("sexe") : null,
      className: findCol("classe") >= 0 ? findCol("classe") : null,
      birthDate: findCol("naissance") >= 0 ? findCol("naissance") : null,
      phone:
        findCol("tel", "téléphone", "phone") >= 0 ? findCol("tel", "téléphone", "phone") : null,
    });
    setNameMode(guessFull >= 0 ? "combined" : "separate");
    setStep("map");
  }

  const distinctClasses = useMemo(() => {
    if (colMap.className === null) return [];
    const set = new Set<string>();
    dataRows.forEach((r) => {
      const v = r[colMap.className as number];
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  }, [dataRows, colMap.className]);

  type PreviewRow = {
    index: number;
    label: string;
    last_name: string;
    first_name: string;
    gender: "M" | "F" | null;
    class_id: string | null;
    class_name_raw: string;
    matricule: string;
    ok: boolean;
    reason: string;
  };

  const preview = useMemo<PreviewRow[]>(() => {
    if (step !== "preview" && step !== "done") return [];
    const existingMatricules = new Set((students.data ?? []).map((s) => s.matricule));
    const year = todayISO().slice(0, 4);
    let seq = 1;
    return dataRows.map((r, i) => {
      let last_name = "";
      let first_name = "";
      if (nameMode === "combined" && colMap.fullName !== null) {
        const split = splitFullName(r[colMap.fullName] ?? "");
        last_name = split.last_name;
        first_name = split.first_name;
      } else {
        last_name = colMap.lastName !== null ? (r[colMap.lastName] ?? "") : "";
        first_name = colMap.firstName !== null ? (r[colMap.firstName] ?? "") : "";
      }
      const label = [last_name, first_name].filter(Boolean).join(" ") || `Ligne ${i + 2}`;
      const genderRaw = colMap.gender !== null ? (r[colMap.gender] ?? "") : "";
      const gender = genderRaw ? normalizeGender(genderRaw) : null;
      const classRaw: string = colMap.className !== null ? (r[colMap.className] ?? "") : "";
      const class_id = classRaw ? classMatch[classRaw] || null : null;

      const reasons: string[] = [];
      if (!last_name) reasons.push("nom manquant");
      if (!gender) reasons.push("sexe invalide");
      if (!classRaw) reasons.push("classe manquante");
      else if (!class_id) reasons.push("classe non associée");

      const matricule = generateImportMatricule(year, seq, existingMatricules);
      if (reasons.length === 0) seq += 1;

      return {
        index: i,
        label,
        last_name,
        first_name,
        gender,
        class_id,
        class_name_raw: classRaw,
        matricule,
        ok: reasons.length === 0,
        reason: reasons.join(", "),
      };
    });
  }, [step, dataRows, nameMode, colMap, classMatch, students.data]);

  const okCount = preview.filter((p) => p.ok).length;
  const errorCount = preview.length - okCount;

  async function runImport() {
    setImporting(true);
    const failed: { row: number; label: string; reason: string }[] = [];
    let ok = 0;
    const today = todayISO();
    const classById = new Map((classes.data ?? []).map((c) => [c.id, c]));

    for (const p of preview) {
      if (!p.ok || !p.class_id || !p.gender) continue;
      const cls = classById.get(p.class_id);
      if (!cls) {
        failed.push({ row: p.index + 2, label: p.label, reason: "classe introuvable" });
        continue;
      }
      const { error } = await supabase.from("students").insert({
        matricule: p.matricule,
        first_name: p.first_name || p.last_name,
        last_name: p.last_name,
        gender: p.gender,
        class_id: cls.id,
        academic_year_id: cls.academic_year_id,
        enrollment_date: today,
        status: "actif",
      } as never);
      if (error) {
        failed.push({ row: p.index + 2, label: p.label, reason: error.message });
      } else {
        ok += 1;
      }
    }

    setResult({ ok, failed });
    setImporting(false);
    setStep("done");
    queryClient.invalidateQueries({ queryKey: ["students"] });
    if (failed.length === 0) {
      toast.success(`${ok} élève(s) importé(s)`);
    } else {
      toast.warning(`${ok} importé(s), ${failed.length} échec(s)`, {
        description: "Voir le détail en bas de page.",
      });
    }
  }

  if (classes.isPending || students.isPending) return <LoadingBlock />;

  if (!perms?.manageStructure) {
    return (
      <div className="space-y-6 rise">
        <PageHeader title="Importer des élèves" subtitle="Accès réservé" />
        <Panel>Vous n'avez pas les droits pour importer des élèves.</Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Importer des élèves"
        subtitle="Import en masse depuis un fichier Excel (.xlsx) ou CSV"
        right={
          <Link
            to="/eleves"
            className="h-9 rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted flex items-center"
          >
            Retour aux élèves
          </Link>
        }
      />

      {step === "upload" ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">1. Choisir le fichier</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Colonnes attendues au minimum : nom (ou nom complet), sexe, classe. Les colonnes peuvent
            être dans n'importe quel ordre, elles seront associées à l'étape suivante.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
              className="text-[13px]"
            />
            <button
              type="button"
              onClick={downloadTemplate}
              className="h-9 rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted"
            >
              Télécharger un modèle
            </button>
          </div>
        </Panel>
      ) : null}

      {step === "map" ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">2. Associer les colonnes</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Fichier : {fileName} — {dataRows.length} ligne(s) de données détectée(s)
          </p>

          <div className="mt-4 flex gap-4 text-[13px]">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={nameMode === "combined"}
                onChange={() => setNameMode("combined")}
              />
              Nom et prénom dans une seule colonne
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={nameMode === "separate"}
                onChange={() => setNameMode("separate")}
              />
              Colonnes séparées
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {nameMode === "combined" ? (
              <ColSelect
                label="Colonne Nom complet"
                header={header}
                value={colMap.fullName}
                onChange={(v) => setColMap((m) => ({ ...m, fullName: v }))}
              />
            ) : (
              <>
                <ColSelect
                  label="Colonne Nom"
                  header={header}
                  value={colMap.lastName}
                  onChange={(v) => setColMap((m) => ({ ...m, lastName: v }))}
                />
                <ColSelect
                  label="Colonne Prénom"
                  header={header}
                  value={colMap.firstName}
                  onChange={(v) => setColMap((m) => ({ ...m, firstName: v }))}
                />
              </>
            )}
            <ColSelect
              label="Colonne Sexe"
              header={header}
              value={colMap.gender}
              onChange={(v) => setColMap((m) => ({ ...m, gender: v }))}
            />
            <ColSelect
              label="Colonne Classe"
              header={header}
              value={colMap.className}
              onChange={(v) => setColMap((m) => ({ ...m, className: v }))}
            />
            <ColSelect
              label="Colonne Date de naissance (optionnel)"
              header={header}
              value={colMap.birthDate}
              onChange={(v) => setColMap((m) => ({ ...m, birthDate: v }))}
            />
            <ColSelect
              label="Colonne Téléphone (optionnel)"
              header={header}
              value={colMap.phone}
              onChange={(v) => setColMap((m) => ({ ...m, phone: v }))}
            />
          </div>

          {colMap.className !== null && distinctClasses.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-[13px] font-semibold">Correspondance des classes</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {distinctClasses.length} valeur(s) de classe trouvée(s) dans le fichier — associez
                chacune à une classe existante dans l'application.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {distinctClasses.map((raw) => (
                  <div key={raw} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 truncate text-[13px]">{raw}</span>
                    <select
                      className={selectClass}
                      value={classMatch[raw] ?? ""}
                      onChange={(e) => setClassMatch((m) => ({ ...m, [raw]: e.target.value }))}
                    >
                      <option value="">— non associée —</option>
                      {(classes.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("preview")}
              disabled={
                (nameMode === "combined" ? colMap.fullName === null : colMap.lastName === null) ||
                colMap.gender === null ||
                colMap.className === null
              }
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Prévisualiser
            </button>
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="h-9 rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted"
            >
              Changer de fichier
            </button>
          </div>
        </Panel>
      ) : null}

      {step === "preview" ? (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">3. Vérifier avant import</h2>
            <div className="text-[13px]">
              <span className="text-emerald-600 font-medium">{okCount} prêt(s)</span>
              {errorCount > 0 ? (
                <span className="ml-3 text-destructive font-medium">{errorCount} en erreur</span>
              ) : null}
            </div>
          </div>

          <TableWrap minWidth={720} footer={<span>{preview.length} ligne(s) au total</span>}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th>Ligne</Th>
                <Th>Élève</Th>
                <Th>Sexe</Th>
                <Th>Classe</Th>
                <Th>Matricule généré</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {preview.length === 0 ? (
                <EmptyRow colSpan={6} label="Aucune ligne à afficher." />
              ) : (
                preview.map((p) => (
                  <tr key={p.index} className={p.ok ? "" : "bg-destructive/5"}>
                    <Td>{p.index + 2}</Td>
                    <Td>{p.label}</Td>
                    <Td>{p.gender ?? "—"}</Td>
                    <Td>{p.class_name_raw || "—"}</Td>
                    <Td className="font-mono text-[12px]">{p.ok ? p.matricule : "—"}</Td>
                    <Td>
                      {p.ok ? (
                        <span className="text-emerald-600">Prêt</span>
                      ) : (
                        <span className="text-destructive">{p.reason}</span>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={importing || okCount === 0}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {importing ? "Import en cours…" : `Importer ${okCount} élève(s)`}
            </button>
            <button
              type="button"
              onClick={() => setStep("map")}
              disabled={importing}
              className="h-9 rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted disabled:opacity-50"
            >
              Retour
            </button>
          </div>
        </Panel>
      ) : null}

      {step === "done" ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">Import terminé</h2>
          <p className="mt-2 text-[13px]">
            <span className="text-emerald-600 font-medium">{result.ok} élève(s) importé(s)</span>
            {result.failed.length > 0 ? (
              <span className="ml-3 text-destructive font-medium">
                {result.failed.length} échec(s)
              </span>
            ) : null}
          </p>

          {result.failed.length > 0 ? (
            <TableWrap minWidth={600} footer={<span>{result.failed.length} échec(s)</span>}>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <Th>Ligne</Th>
                  <Th>Élève</Th>
                  <Th>Raison</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.failed.map((f) => (
                  <tr key={f.row}>
                    <Td>{f.row}</Td>
                    <Td>{f.label}</Td>
                    <Td>{f.reason}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : null}

          <div className="mt-4 flex gap-3">
            <Link
              to="/eleves"
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 flex items-center"
            >
              Voir les élèves
            </Link>
            <button
              type="button"
              onClick={() => {
                setStep("upload");
                setDataRows([]);
                setHeader([]);
                setColMap(emptyColMap);
                setClassMatch({});
                setResult({ ok: 0, failed: [] });
              }}
              className="h-9 rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted"
            >
              Importer un autre fichier
            </button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function ColSelect({
  label,
  header,
  value,
  onChange,
}: {
  label: string;
  header: string[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label className="label-caps">{label}</label>
      <select
        className={selectClass + " mt-1.5"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">— ignorer —</option>
        {header.map((h, i) => (
          <option key={i} value={i}>
            {h || `Colonne ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
}
