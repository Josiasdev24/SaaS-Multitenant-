import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import {
  q,
  computeFinance,
  fullName,
  compareNames,
  FEE_STATUS_LABELS,
  FEE_REGIME_LABELS,
  FEE_REGIME_SHORT,
  isPartialRegime,
  hasRegime,
  type FeeStatus,
  type FeeRegime,
  type Student,
} from "@/lib/data";
import { money, moneyShort, dateFr, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { EnrollmentForm } from "@/components/enrollment-form";
import { usePagination } from "@/lib/pagination";
import {
  PageHeader,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  FeeStatusBadge,
  Tag,
  Panel,
  LoadingBlock,
  Pagination,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/eleves/")({
  head: () => ({
    meta: [
      { title: "Élèves" },
      {
        name: "description",
        content:
          "Répertoire des élèves inscrits : matricule, classe, situation d'écolage et statut.",
      },
      { property: "og:title", content: "Élèves" },
      {
        property: "og:description",
        content: "Répertoire des élèves inscrits et de leur situation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentsPage,
});

const STATUS_LABELS: Record<string, string> = {
  actif: "Actif",
  archive: "Archivé",
  transfere: "Transféré",
  sorti: "Sorti",
};

/** Nouveau / Ancien : colonne student_type, distincte du statut actif/archivé. */
const TYPE_LABELS: Record<string, string> = { nouveau: "Nouveau", ancien: "Ancien" };
type WithType = { student_type?: string | null };
type StudentType = "nouveau" | "ancien";
type WithRegime = { fee_status?: string | null; fee_discount?: number | string | null; fee_note?: string | null };

const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/**
 * Définit « nouveau » ou « ancien » pour des élèves, et met leurs frais d'inscription en cohérence :
 * - ancien : la ligne « Frais d'inscription » est retirée (sauf si un paiement y est rattaché) ;
 * - nouveau : la ligne « Frais d'inscription » est vérifiée / ajoutée.
 */
async function setStudentType(ids: string[], type: StudentType) {
  for (const part of chunk(ids, 50)) {
    const { data, error } = await supabase
      .from("students")
      .update({ student_type: type } as never)
      .in("id", part)
      .select("id");
    if (error) throw new Error(error.message);
    if ((data as unknown[] | null)?.length !== part.length) {
      throw new Error("Modification refusée pour certains élèves (droits insuffisants).");
    }
  }

  let removed = 0;
  let failed = 0;
  if (type === "ancien") {
    const { data: feeRows } = await supabase.from("school_fees").select("id").eq("kind", "inscription");
    const feeIds = (feeRows ?? []).map((f) => f.id);
    if (feeIds.length > 0) {
      for (const part of chunk(ids, 50)) {
        const { data: lines } = await supabase
          .from("student_fees")
          .select("id")
          .in("student_id", part)
          .in("school_fee_id", feeIds);
        const lineIds = (lines ?? []).map((l) => l.id);
        if (lineIds.length === 0) continue;
        const { data: paid } = await supabase
          .from("fee_payments")
          .select("student_fee_id")
          .in("student_fee_id", lineIds);
        const paidIds = new Set((paid ?? []).map((x) => x.student_fee_id));
        const deletable = lineIds.filter((id) => !paidIds.has(id));
        if (deletable.length === 0) continue;
        const { data: gone } = await supabase.from("student_fees").delete().in("id", deletable).select("id");
        removed += (gone ?? []).length;
      }
    }
  } else {
    for (const part of chunk(ids, 10)) {
      await Promise.all(
        part.map(async (id) => {
          const { error } = await supabase.rpc(
            "assign_student_fees" as never,
            { _student_id: id, _include_inscription: true } as never,
          );
          if (error) failed += 1;
        }),
      );
    }
  }
  return { removed, failed };
}

function StudentsPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  // Seuls le Fondateur et le Directeur peuvent définir le type (nouveau/ancien) et le régime (bourse, personnel).
  const canSetType = user?.role === "admin" || user?.role === "direction";
  const today = todayISO();

  const [term, setTerm] = useState("");
  const [classId, setClassId] = useState("all");
  const [status, setStatus] = useState("actif");
  const [typeFilter, setTypeFilter] = useState("all");
  const [regimeFilter, setRegimeFilter] = useState("all");
  const [feeFilter, setFeeFilter] = useState<"all" | FeeStatus>("all");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const typeMutation = useMutation({
    mutationFn: ({ ids, type }: { ids: string[]; type: StudentType }) => setStudentType(ids, type),
    onSuccess: ({ removed, failed }, { ids, type }) => {
      const label = type === "ancien" ? "anciens" : "nouveaux";
      toast.success(`${ids.length} élève(s) défini(s) comme ${label}`, {
        description:
          type === "ancien"
            ? `${removed} ligne(s) d'inscription retirée(s) de leurs frais.` 
            : failed > 0
              ? `Frais d'inscription non vérifiés pour ${failed} élève(s) (droits insuffisants).`
              : "Leurs frais d'inscription ont été vérifiés.",
      });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student-fees"] });
    },
    onError: (e: Error) => toast.error("Changement impossible", { description: e.message }),
  });

  const [regimeFor, setRegimeFor] = useState<Student | null>(null);
  const [regimeDraft, setRegimeDraft] = useState<FeeRegime>("normal");
  const panelRef = useRef<HTMLDivElement>(null);

  const regimeMutation = useMutation({
    mutationFn: async (v: { id: string; fee_status: FeeRegime; fee_discount: number; fee_note: string }) => {
      const { data, error } = await supabase
        .from("students")
        .update({
          fee_status: v.fee_status,
          fee_discount: isPartialRegime(v.fee_status) ? v.fee_discount : 0,
          fee_note: v.fee_status === "normal" ? null : v.fee_note.trim() || null,
        } as never)
        .eq("id", v.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || (data as unknown[]).length === 0) {
        throw new Error("Modification refusée (droits insuffisants).");
      }
    },
    onSuccess: (_r, v) => {
      toast.success(
        v.fee_status === "normal"
          ? "Élève remis au régime normal"
          : `Régime enregistré : ${FEE_REGIME_SHORT[v.fee_status]}`,
      );
      setRegimeFor(null);
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error("Changement impossible", { description: e.message }),
  });

  const [students, classes, studentFees, payments, fees, parents] = useQueries({
    queries: [
      q.students(),
      q.classes(),
      { ...q.studentFees(), enabled: Boolean(perms?.viewFinance) },
      { ...q.payments(), enabled: Boolean(perms?.viewFinance) },
      { ...q.fees(), enabled: Boolean(perms?.viewFinance) },
      { ...q.parents(), enabled: Boolean(perms?.manageStructure) },
    ],
  });

  // Prochain matricule proposé : ELV-{année}-{dernier numéro + 1}.
  const nextMatricule = useMemo(() => {
    const year = today.slice(0, 4);
    const prefix = `ELV-${year}-`;
    const nums = (students.data ?? [])
      .filter((s) => s.matricule.startsWith(prefix))
      .map((s) => Number(s.matricule.slice(prefix.length)))
      .filter((n) => Number.isFinite(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}${String(next).padStart(4, "0")}`;
  }, [students.data, today]);

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (students.data ?? [])
      .filter((s) => (status === "all" ? true : s.status === status))
      .filter((s) => (classId === "all" ? true : s.class_id === classId))
      .filter((s) =>
        typeFilter === "all"
          ? true
          : typeFilter === "undefined"
            ? !(s as WithType).student_type
            : (s as WithType).student_type === typeFilter,
      )
      .filter((s) =>
        regimeFilter === "all" ? true : ((s as WithRegime).fee_status ?? "normal") === regimeFilter,
      )
      .filter(
        (s) => !t || fullName(s).toLowerCase().includes(t) || s.matricule.toLowerCase().includes(t),
      )
      .map((s) => ({
        student: s,
        className: classes.data?.find((c) => c.id === s.class_id)?.name ?? "Non affecté",
        finance: perms?.viewFinance
          ? computeFinance(
              s.id,
              studentFees.data ?? [],
              payments.data ?? [],
              fees.data ?? [],
              today,
            )
          : null,
      }))
      .filter((r) => (feeFilter === "all" || !r.finance ? true : r.finance.status === feeFilter))
      .sort((a, b) => compareNames(a.student, b.student));
  }, [
    students.data,
    classes.data,
    studentFees.data,
    payments.data,
    fees.data,
    term,
    classId,
    status,
    typeFilter,
    regimeFilter,
    feeFilter,
    perms?.viewFinance,
    today,
  ]);

  const { pageItems, page, setPage, totalPages } = usePagination(rows, 20);
  const showPick = canSetType && typeFilter === "undefined";

  if (students.isPending) return <LoadingBlock />;

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Élèves"
        subtitle={`${rows.length} élève(s) affiché(s) sur ${(students.data ?? []).length} enregistrés`}
        right={
          perms?.manageStructure ? (
            <div className="flex gap-2">
              <Link
                to="/eleves/import"
                className="h-9 rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted flex items-center"
              >
                Importer
              </Link>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
              >
                {showForm ? "Annuler" : "Inscrire un élève"}
              </button>
            </div>
          ) : null
        }
      />

      {showForm && perms?.manageStructure ? (
        <EnrollmentForm
          students={students.data ?? []}
          classes={classes.data ?? []}
          parents={parents.data ?? []}
          nextMatricule={nextMatricule}
          today={today}
          onClose={() => setShowForm(false)}
        />
      ) : null}

      <div className="flex flex-wrap gap-3">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Nom ou matricule"
          aria-label="Filtrer les élèves"
          className="h-9 w-full max-w-xs rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50"
        />
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          aria-label="Classe"
          className={filterClass}
        >
          <option value="all">Toutes les classes</option>
          {(classes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Nouveau ou ancien"
          className={filterClass}
        >
          <option value="all">Nouveaux et anciens</option>
          <option value="nouveau">Nouveaux</option>
          <option value="ancien">Anciens</option>
          {canSetType ? <option value="undefined">Type non défini</option> : null}
        </select>
        {canSetType || perms?.viewFinance ? (
          <select
            value={regimeFilter}
            onChange={(e) => setRegimeFilter(e.target.value)}
            aria-label="Régime d'écolage"
            className={filterClass}
          >
            <option value="all">Tous les régimes</option>
            {(Object.keys(FEE_REGIME_LABELS) as FeeRegime[]).map((r) => (
              <option key={r} value={r}>
                {FEE_REGIME_LABELS[r]}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Statut"
          className={filterClass}
        >
          <option value="actif">Actifs</option>
          <option value="all">Tous les statuts</option>
          <option value="transfere">Transférés</option>
          <option value="sorti">Sortis</option>
          <option value="archive">Archivés</option>
        </select>
        {perms?.viewFinance ? (
          <select
            value={feeFilter}
            onChange={(e) => setFeeFilter(e.target.value as "all" | FeeStatus)}
            aria-label="Situation d'écolage"
            className={filterClass}
          >
            <option value="all">Toute situation</option>
            {(Object.keys(FEE_STATUS_LABELS) as FeeStatus[]).map((s) => (
              <option key={s} value={s}>
                {FEE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {canSetType && regimeFor ? (
        <div ref={panelRef}>
          <Panel>
            <h2 className="text-[15px] font-semibold">Régime d'écolage — {fullName(regimeFor)}</h2>
            <form
              key={regimeFor.id}
              className="mt-4 grid gap-4 md:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const amount = Number(f.get("fee_discount") || 0);
                if (isPartialRegime(regimeDraft) && !(amount > 0)) {
                  toast.error("Indiquez la somme exonérée (en FCFA).");
                  return;
                }
                regimeMutation.mutate({
                  id: regimeFor.id,
                  fee_status: regimeDraft,
                  fee_discount: amount,
                  fee_note: String(f.get("fee_note") ?? ""),
                });
              }}
            >
              <div className="md:col-span-3">
                <label htmlFor="fee_status" className="label-caps">
                  Régime
                </label>
                <select
                  id="fee_status"
                  value={regimeDraft}
                  onChange={(e) => setRegimeDraft(e.target.value as FeeRegime)}
                  className={fieldClass}
                >
                  {(Object.keys(FEE_REGIME_LABELS) as FeeRegime[]).map((r) => (
                    <option key={r} value={r}>
                      {FEE_REGIME_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              {isPartialRegime(regimeDraft) ? (
                <div>
                  <label htmlFor="fee_discount" className="label-caps">
                    Somme exonérée (FCFA)
                  </label>
                  <input
                    id="fee_discount"
                    name="fee_discount"
                    type="number"
                    min="1"
                    step="500"
                    required
                    defaultValue={Number((regimeFor as WithRegime).fee_discount ?? 0) || ""}
                    className={fieldClass}
                  />
                </div>
              ) : null}
              {regimeDraft !== "normal" ? (
                <div className={isPartialRegime(regimeDraft) ? "md:col-span-2" : "md:col-span-3"}>
                  <label htmlFor="fee_note" className="label-caps">
                    Précision (lien de parenté, nom du membre du personnel, motif…)
                  </label>
                  <input
                    id="fee_note"
                    name="fee_note"
                    defaultValue={(regimeFor as WithRegime).fee_note ?? ""}
                    placeholder="Ex. neveu de M. KOFFI, enseignant"
                    className={fieldClass}
                  />
                </div>
              ) : null}
              <div className="flex gap-3 md:col-span-3">
                <button
                  type="submit"
                  disabled={regimeMutation.isPending}
                  className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {regimeMutation.isPending ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => setRegimeFor(null)}
                  className="h-9 rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted"
                >
                  Annuler
                </button>
              </div>
            </form>
          </Panel>
        </div>
      ) : null}

      {canSetType && typeFilter === "undefined" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-[13px]">
          <span className="text-muted-foreground">
            {rows.length} élève(s) sans type · {selected.size} sélectionné(s)
          </span>
          <button
            type="button"
            className="h-8 rounded-md border border-border px-3 font-medium hover:bg-muted"
            onClick={() =>
              setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.student.id)))
            }
          >
            {selected.size === rows.length && rows.length > 0 ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || typeMutation.isPending}
            className="h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            onClick={() => {
              if (window.confirm(`Définir ${selected.size} élève(s) comme NOUVEAUX ?`))
                typeMutation.mutate({ ids: [...selected], type: "nouveau" });
            }}
          >
            Définir comme nouveaux
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || typeMutation.isPending}
            className="h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            onClick={() => {
              if (
                window.confirm(
                  `Définir ${selected.size} élève(s) comme ANCIENS ?\n\nLeur ligne « Frais d'inscription » (5000 F) sera retirée de leurs frais.`,
                )
              )
                typeMutation.mutate({ ids: [...selected], type: "ancien" });
            }}
          >
            Définir comme anciens
          </button>
        </div>
      ) : null}

      <TableWrap
        minWidth={720}
        footer={
          <>
            <span>{rows.length} ligne(s)</span>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        }
      >
        <thead className="border-b border-border bg-muted/40">
          <tr>
            {showPick ? <Th className="w-8" /> : null}
            <Th>Matricule</Th>
            <Th>Élève</Th>
            <Th>Classe</Th>
            <Th>Inscription</Th>
            <Th>Statut</Th>
            {canSetType ? <Th>Type</Th> : null}
            {canSetType ? <Th>Régime</Th> : null}
            {perms?.viewFinance ? <Th className="text-right">Reste</Th> : null}
            {perms?.viewFinance ? <Th>Écolage</Th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <EmptyRow
              colSpan={(perms?.viewFinance ? 7 : 5) + (canSetType ? 2 : 0) + (showPick ? 1 : 0)}
              label="Aucun élève ne correspond à ces filtres."
            />
          ) : (
            pageItems.map(({ student, className, finance }) => {
              const studentType = (student as WithType).student_type;
              return (
                <tr key={student.id} className="hover:bg-muted/40">
                  {showPick ? (
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${fullName(student)}`}
                        checked={selected.has(student.id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(student.id);
                            else next.delete(student.id);
                            return next;
                          })
                        }
                      />
                    </Td>
                  ) : null}
                  <Td className="num-display text-[13px] text-muted-foreground">
                    {student.matricule}
                  </Td>
                  <Td>
                    <Link
                      to="/eleves/$studentId"
                      params={{ studentId: student.id }}
                      className="font-medium hover:underline"
                    >
                      {fullName(student)}
                    </Link>
                    <span className="ml-2 text-[12px] text-faint">{student.gender ?? "—"}</span>
                    {studentType ? (
                      <span className="ml-2 text-[12px] text-faint">
                        · {TYPE_LABELS[studentType] ?? studentType}
                      </span>
                    ) : null}
                    {hasRegime(student as WithRegime) ? (
                      <span className="ml-2 align-middle">
                        <Tag tone="partial">
                          {FEE_REGIME_SHORT[(student as WithRegime).fee_status as FeeRegime]}
                          {isPartialRegime((student as WithRegime).fee_status) &&
                          Number((student as WithRegime).fee_discount ?? 0) > 0
                            ? ` · −${money(Number((student as WithRegime).fee_discount))}`
                            : ""}
                        </Tag>
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-muted-foreground">{className}</Td>
                  <Td className="text-muted-foreground">{dateFr(student.enrollment_date)}</Td>
                  <Td>
                    <Tag tone={student.status === "actif" ? "ok" : "neutral"}>
                      {STATUS_LABELS[student.status] ?? student.status}
                    </Tag>
                  </Td>
                  {canSetType ? (
                    <Td>
                      <div className="flex gap-1">
                        {(["nouveau", "ancien"] as StudentType[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            disabled={typeMutation.isPending || studentType === t}
                            onClick={() => typeMutation.mutate({ ids: [student.id], type: t })}
                            className={
                              "h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors " +
                              (studentType === t
                                ? "bg-ok/15 text-ok"
                                : "border border-border text-muted-foreground hover:bg-muted")
                            }
                          >
                            {TYPE_LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </Td>
                  ) : null}
                  {canSetType ? (
                    <Td>
                      <button
                        type="button"
                        onClick={() => {
                          setRegimeFor(student);
                          setRegimeDraft(((student as WithRegime).fee_status as FeeRegime) ?? "normal");
                          window.setTimeout(
                            () => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            50,
                          );
                        }}
                        className="h-7 rounded-full border border-border px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-muted"
                      >
                        {hasRegime(student as WithRegime)
                          ? FEE_REGIME_SHORT[(student as WithRegime).fee_status as FeeRegime]
                          : "Définir"}
                      </button>
                    </Td>
                  ) : null}
                  {perms?.viewFinance ? (
                    <Td className="num-display text-right">
                      {finance ? moneyShort(finance.remaining) : "—"}
                    </Td>
                  ) : null}
                  {perms?.viewFinance ? (
                    <Td>{finance ? <FeeStatusBadge status={finance.status} /> : null}</Td>
                  ) : null}
                </tr>
              );
            })
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}

const filterClass =
  "h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
const fieldClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
