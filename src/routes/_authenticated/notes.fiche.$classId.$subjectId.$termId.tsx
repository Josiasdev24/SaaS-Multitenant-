import { Fragment, memo, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { flushSync } from "react-dom";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { fullName, q, type Student } from "@/lib/data";
import {
  INTERRO_COUNT,
  SLOTS,
  computeRow,
  deleteColumn,
  fmtNote,
  parseNote,
  saveFiche,
  scoreId,
  slotMax,
  syncBulletin,
  useFiche,
  type Cells,
  type FicheData,
  type Slot,
} from "@/lib/fiche";
import { useCurrentUser } from "@/lib/session";
import { PrintHeader } from "@/components/print-header";
import { TopScroll } from "@/components/top-scroll";
import { LoadingBlock, NoAccess, PageHeader, Panel, Td, Th } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/notes/fiche/$classId/$subjectId/$termId")({
  head: () => ({
    meta: [{ title: "Fiche de notes" }],
  }),
  component: FichePage,
});

const STALE = 5 * 60 * 1000;

/** Impression : A4 portrait, grande zone, tableau serré pour tenir 55 élèves sur une page. */
const FICHE_PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 7mm; }
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
  #print-area .no-print { display: none !important; }
  #print-area .top-scroll-body { max-height: none !important; overflow: visible !important; }
  #print-area .top-scroll-bar { display: none !important; }
  #print-area table { border-collapse: collapse; }
  #print-area .fiche-grid { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; }
  #print-area th, #print-area td { border: 1px solid #000 !important; padding: 1px 3px !important; font-size: 10.5px !important; line-height: 1.15 !important; position: static !important; background: transparent !important; }
  #print-area thead th { background: #d9d9d9 !important; color: #000 !important; text-transform: uppercase; }
  #print-area thead { position: static !important; }
  #print-area thead th { font-size: 9px !important; letter-spacing: 0 !important; }
  #print-area tbody tr { height: var(--row-h, 4.6mm); }
  #print-area input { border: 0 !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; height: auto !important; width: 100% !important; font-size: 10.5px !important; color: #000 !important; }
  #print-area.blank input, #print-area.blank .calc { color: transparent !important; }
  #print-area.blank .calc { visibility: hidden !important; }
}
`;

const inputClass =
  "h-8 w-14 rounded-md border border-border bg-card px-1 text-center text-[13px] outline-none focus:border-primary/50 disabled:bg-muted/50";

function FichePage() {
  const { classId, subjectId, termId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const enabled = Boolean(perms?.viewAcademics);
  const [version, setVersion] = useState(0);

  const [classes, subjects, terms, students, classSubjects, teachers] = useQueries({
    queries: [
      { ...q.classes(), enabled, staleTime: STALE },
      { ...q.subjects(), enabled, staleTime: STALE },
      { ...q.terms(), enabled, staleTime: STALE },
      { ...q.students(), enabled, staleTime: STALE },
      { ...q.classSubjects(), enabled, staleTime: STALE },
      { ...q.teachers(), enabled, staleTime: STALE },
    ],
  });
  const { data, pending } = useFiche(classId, subjectId, termId, enabled);

  const roster = useMemo(
    () =>
      (students.data ?? [])
        .filter((s) => s.class_id === classId && s.status === "actif")
        .sort(
          (a, b) =>
            a.last_name.localeCompare(b.last_name, "fr") || a.first_name.localeCompare(b.first_name, "fr"),
        ),
    [students.data, classId],
  );

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics || perms.scope === "primary") return <NoAccess />;
  if (classes.isPending || subjects.isPending || terms.isPending || students.isPending || pending) {
    return <LoadingBlock />;
  }

  const klass = (classes.data ?? []).find((c) => c.id === classId);
  const subject = (subjects.data ?? []).find((s) => s.id === subjectId);
  const term = (terms.data ?? []).find((t) => t.id === termId);
  if (!klass || !subject || !term) {
    return (
      <Panel>
        <p className="text-[13px] text-muted-foreground">Classe, matière ou trimestre introuvable.</p>
      </Panel>
    );
  }
  const link = (classSubjects.data ?? []).find((cs) => cs.class_id === classId && cs.subject_id === subjectId);
  if (perms.scope === "own" && (!link || link.teacher_id !== (user?.teacherId ?? null))) return <NoAccess />;
  const teacher = link?.teacher_id ? (teachers.data ?? []).find((t) => t.id === link.teacher_id) : undefined;

  async function refreshAndRemount() {
    await queryClient.invalidateQueries({
      predicate: (query) => /fiche|evaluation|grade|bulletin/i.test(String(query.queryKey[0])),
    });
    setVersion((v) => v + 1);
  }

  return (
    <Sheet
      key={`${classId}-${subjectId}-${termId}-${version}`}
      classId={classId}
      subjectId={subjectId}
      termId={termId}
      className={klass.name}
      subjectName={subject.name}
      termName={term.name}
      coefficient={link?.coefficient ?? subject.default_coefficient}
      teacherName={teacher ? fullName(teacher) : ""}
      roster={roster}
      data={data}
      canEdit={perms.editAcademics}
      onChanged={refreshAndRemount}
    />
  );
}

function Sheet({
  classId,
  subjectId,
  termId,
  className,
  subjectName,
  termName,
  coefficient,
  teacherName,
  roster,
  data,
  canEdit,
  onChanged,
}: {
  classId: string;
  subjectId: string;
  termId: string;
  className: string;
  subjectName: string;
  termName: string;
  coefficient: number;
  teacherName: string;
  roster: Student[];
  data: FicheData;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const ids = useMemo(() => roster.map((s) => s.id), [roster]);
  const boys = roster.filter((s) => s.gender === "M").length;
  // Hauteur des lignes à l'impression : la liste remplit la page (de 4,2 mm à 6 mm par élève)
  const rowMm = Math.max(4.2, Math.min(6, 228 / (roster.length + 2)));
  const girls = roster.filter((s) => s.gender === "F").length;

  const [interroMax, setInterroMax] = useState(() => {
    for (let i = 1; i <= INTERRO_COUNT; i += 1) {
      const e = data.evals.get(`interrogation-${i}`);
      if (e) return e.max;
    }
    return 20;
  });
  const [blank, setBlank] = useState(false);

  // Valeurs de départ (une seule fois), en cours de saisie, et dernier état enregistré
  const initial = useMemo(() => {
    const out = new Map<string, Cells>();
    for (const s of roster) {
      const cells: Cells = {};
      for (const slot of SLOTS) {
        const ev = data.evals.get(slot.key);
        const v = ev ? data.scores.get(scoreId(ev.id, s.id)) : undefined;
        cells[slot.key] = v === undefined ? "" : fmtNote(v);
      }
      out.set(s.id, cells);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const current = useRef<Map<string, Cells>>(new Map());
  const saved = useRef<Map<string, Cells>>(new Map());
  if (saved.current.size === 0) {
    for (const [id, cells] of initial) {
      current.current.set(id, { ...cells });
      saved.current.set(id, { ...cells });
    }
  }

  const save = useMutation({
    mutationFn: () =>
      saveFiche({ classId, subjectId, termId, interroMax, data, studentIds: ids, now: current.current, before: saved.current }),
    onSuccess: async ({ written, cleared }) => {
      for (const [id, cells] of current.current) saved.current.set(id, { ...cells });
      toast.success(
        written + cleared === 0
          ? "Aucune modification à enregistrer"
          : `Notes enregistrées (${written} saisie(s), ${cleared} effacée(s))`,
        { description: "La moyenne de classe et la composition sont reportées dans le bulletin." },
      );
      await onChanged();
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  const removeColumn = useMutation({
    mutationFn: async (slot: Slot) => {
      const ev = data.evals.get(slot.key);
      if (!ev) return false;
      const count = ids.filter((id) => data.scores.has(scoreId(ev.id, id))).length;
      if (!window.confirm(`Supprimer la colonne « ${slot.label} » et ses ${count} note(s) ?`)) return false;
      await deleteColumn(ev.id);
      const without = new Map<string, Cells>();
      for (const [id, cells] of current.current) without.set(id, { ...cells, [slot.key]: "" });
      const touched = new Set(ids.filter((id) => data.scores.has(scoreId(ev.id, id))));
      await syncBulletin({ subjectId, termId, interroMax, studentIds: ids, cells: without, touchedIds: touched });
      return true;
    },
    onSuccess: async (done) => {
      if (!done) return;
      toast.success("Colonne supprimée");
      await onChanged();
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  function printSheet(empty: boolean) {
    flushSync(() => setBlank(empty));
    window.print();
    setBlank(false);
  }

  const busy = save.isPending || removeColumn.isPending;

  return (
    <div className="space-y-6 rise">
      <style>{FICHE_PRINT_CSS}</style>
      <PageHeader
        title={`Fiche de notes — ${className}`}
        subtitle={`${subjectName} · ${termName} · coefficient ${fmtNote(coefficient)}`}
        right={
          <Link to="/notes" className="text-[13px] text-primary hover:underline">
            Retour aux notes
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3 no-print">
        {canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => save.mutate()}
            className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {save.isPending ? "Enregistrement…" : "Enregistrer les notes"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => printSheet(false)}
          className="h-9 rounded-md border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted"
        >
          Imprimer la fiche
        </button>
        <button
          type="button"
          onClick={() => printSheet(true)}
          className="h-9 rounded-md border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted"
        >
          Imprimer la fiche vierge
        </button>
        <label className="ml-auto flex items-center gap-2 text-[13px]">
          Interrogations sur
          <input
            inputMode="decimal"
            disabled={!canEdit}
            value={String(interroMax)}
            onChange={(e) => {
              const n = Number(e.target.value.replace(",", "."));
              if (Number.isFinite(n) && n > 0) setInterroMax(n);
              else if (e.target.value === "") setInterroMax(0);
            }}
            className={`${inputClass} w-16`}
            aria-label="Barème des interrogations"
          />
        </label>
      </div>

      <div
        id="print-area"
        className={`relative bg-card p-3 text-print-ink ${blank ? "blank" : ""}`}
        style={{ "--row-h": `${rowMm}mm` } as CSSProperties}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden select-none items-center justify-center overflow-hidden print:flex"
          style={{ fontSize: 420, fontWeight: 900, color: "rgba(0,0,0,0.07)", lineHeight: 1 }}
        >
          {className.match(/\d+/)?.[0] ?? ""}
        </div>
        <PrintHeader />
        <div className="mb-3 grid gap-2 text-[13px] sm:grid-cols-[1fr_auto]">
          <div>
            <div className="text-[15px] font-bold uppercase tracking-wide">Liste nominative</div>
            <div>
              Matière : <span className="font-semibold">{subjectName}</span>
              {teacherName ? (
                <>
                  {" "}
                  — Professeur : <span className="font-semibold">{teacherName}</span>
                </>
              ) : null}
            </div>
            <div>
              Coefficient : <span className="font-semibold">{fmtNote(coefficient)}</span> — Année scolaire 2026-2027
            </div>
          </div>
          <table className="text-[12px]" style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td className="border border-print-ink px-2 py-0.5 font-semibold">CLASSE</td>
                <td className="border border-print-ink px-2 py-0.5 text-center text-[14px] font-bold">{className}</td>
              </tr>
              <tr>
                <td className="border border-print-ink px-2 py-0.5">G : {boys}</td>
                <td className="border border-print-ink px-2 py-0.5">F : {girls}</td>
              </tr>
              <tr>
                <td className="border border-print-ink px-2 py-0.5 font-semibold" colSpan={2}>
                  {termName.toUpperCase()}
                </td>
              </tr>
              <tr>
                <td className="border border-print-ink px-2 py-0.5">EFFECTIF TOTAL</td>
                <td className="border border-print-ink px-2 py-0.5 text-center font-bold">{roster.length}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <TopScroll>
          <table className="fiche-grid w-full text-[13px]" style={{ minWidth: 860 }}>
            <colgroup>
              <col className="print:w-[7mm]" />
              <col className="print:w-[56mm]" />
              <col className="print:w-[10mm]" />
              {SLOTS.map((slot) => (
                <Fragment key={slot.key}>
                  {slot.kind === "composition" ? <col /> : null}
                  <col />
                </Fragment>
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20 bg-primary">
              <tr>
                <Th className="bg-primary text-center" >N°</Th>
                <Th className="sticky left-0 z-30 bg-primary">Noms &amp; prénoms</Th>
                <Th className="bg-primary text-center">Sexe</Th>
                <th
                  colSpan={INTERRO_COUNT}
                  className="bg-primary px-4 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.1em]"
                >
                  Interrogations sur {fmtNote(interroMax)}
                </th>
                <th
                  colSpan={4}
                  className="bg-primary px-4 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.1em]"
                >
                  Notes sur 20
                </th>
              </tr>
              <tr>
                <Th className="bg-primary" />
                <Th className="sticky left-0 z-30 bg-primary" />
                <Th className="bg-primary" />
                {SLOTS.map((slot) => {
                  const exists = data.evals.has(slot.key);
                  return (
                    <Fragment key={slot.key}>
                      {slot.kind === "composition" ? <Th className="bg-primary text-center">MG C</Th> : null}
                      <Th className="bg-primary text-center">
                        <div>{slot.label}</div>
                        {canEdit && exists ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removeColumn.mutate(slot)}
                            title={`Supprimer la colonne ${slot.label}`}
                            className="no-print mt-0.5 text-[10px] font-normal underline opacity-80 hover:opacity-100"
                          >
                            supprimer
                          </button>
                        ) : null}
                      </Th>
                    </Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roster.length === 0 ? (
                <tr>
                  <td colSpan={SLOTS.length + 4} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                    Aucun élève dans cette classe.
                  </td>
                </tr>
              ) : (
                roster.map((s, i) => (
                  <FicheRow
                    key={s.id}
                    index={i}
                    student={s}
                    start={initial.get(s.id) ?? {}}
                    registry={current}
                    interroMax={interroMax}
                    canEdit={canEdit}
                  />
                ))
              )}
            </tbody>
          </table>
        </TopScroll>
        <p className="no-print mt-2 text-[12px] text-muted-foreground">
          MG C = moyenne de classe : moyenne de (moyenne des interrogations ramenée sur 20, Note 1, Note 2), parmi
          les notes saisies. Une case vidée puis enregistrée supprime la note. Entrée passe à l'élève suivant.
        </p>
      </div>
    </div>
  );
}

/** Une ligne : garde ses propres valeurs, ne se redessine que lorsqu'on y tape. */
const FicheRow = memo(function FicheRow({
  index,
  student,
  start,
  registry,
  interroMax,
  canEdit,
}: {
  index: number;
  student: Student;
  start: Cells;
  registry: MutableRefObject<Map<string, Cells>>;
  interroMax: number;
  canEdit: boolean;
}) {
  const [cells, setCells] = useState<Cells>(start);

  function change(key: string, value: string) {
    const next = { ...cells, [key]: value };
    registry.current.set(student.id, next);
    setCells(next);
  }

  const computed = computeRow((key) => {
    const slot = SLOTS.find((s) => s.key === key);
    if (!slot) return null;
    try {
      return parseNote(cells[key] ?? "", slotMax(slot, interroMax || 20), "");
    } catch {
      return null;
    }
  }, interroMax || 20);

  return (
    <tr className="hover:bg-muted/40">
      <Td className="text-center text-muted-foreground">{index + 1}</Td>
      <Td className="sticky left-0 z-10 whitespace-nowrap bg-card font-medium">
        {student.last_name} {student.first_name}
      </Td>
      <Td className="text-center">{student.gender ?? ""}</Td>
      {SLOTS.map((slot, j) => (
        <Fragment key={slot.key}>
        {slot.kind === "composition" ? (
          <Td className="calc num-display text-center font-semibold">{fmtNote(computed.mgc)}</Td>
        ) : null}
        <Td className="text-center">
          <input
            inputMode="decimal"
            disabled={!canEdit}
            data-cell={`${index}-${j}`}
            value={cells[slot.key] ?? ""}
            onChange={(e) => change(slot.key, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                document.querySelector<HTMLInputElement>(`[data-cell="${index + 1}-${j}"]`)?.focus();
              }
            }}
            aria-label={`${slot.label} — ${fullName(student)}`}
            className={inputClass}
          />
        </Td>
        </Fragment>
      ))}
    </tr>
  );
});
