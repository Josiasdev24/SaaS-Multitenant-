import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { appreciation, fmt, ordinal } from "@/lib/bulletin";
import { fullName } from "@/lib/data";
import {
  BLOCKS,
  BLOCK_TITLES,
  PRIMAIRE_PRINT_CSS,
  computeYear,
  defaultPeriodKey,
  fmtScore,
  groupOf,
  monthRanking,
  periodsFor,
  ranks,
  subjectsFor,
  type YearResult,
} from "@/lib/primaire";
import { classStudents, usePrimaryBase, usePrimaryScores, type PrimaryBase } from "@/lib/primaire-data";
import { useCurrentUser } from "@/lib/session";
import { PrintHeader } from "@/components/print-header";
import {
  PageHeader,
  Panel,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  NoAccess,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/primaire/")({
  head: () => ({
    meta: [{ title: "Bulletins du primaire" }],
  }),
  component: PrimaireHub,
});

const filterClass =
  "h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
const linkButton =
  "inline-flex h-9 items-center rounded-md border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted";
const primaryButton =
  "inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90";

function PrimaireHub() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const base = usePrimaryBase(Boolean(perms?.viewAcademics));
  const [classId, setClassId] = useState("");
  const [monthKey, setMonthKey] = useState("");

  const myClasses = useMemo(
    () =>
      base.classes.filter((c) => !perms?.ownClassesOnly || c.main_teacher_id === user?.teacherId),
    [base.classes, perms?.ownClassesOnly, user?.teacherId],
  );

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics || perms.scope === "own" || perms.scope === "college") return <NoAccess />;
  if (base.pending) return <LoadingBlock />;

  if (myClasses.length === 0) {
    return (
      <Panel>
        <p className="text-[13px] text-muted-foreground">
          Aucune classe du primaire n'est disponible avec votre compte.
        </p>
      </Panel>
    );
  }

  const effectiveClass = myClasses.find((c) => c.id === classId)?.id ?? myClasses[0]?.id ?? "";
  const effectiveMonth = monthKey;

  return (
    <HubBody
      key={effectiveClass}
      base={base}
      classId={effectiveClass}
      monthKey={effectiveMonth}
      classes={myClasses.map((c) => ({ id: c.id, name: c.name }))}
      onClass={setClassId}
      onMonth={setMonthKey}
      canEdit={perms.editAcademics}
      canManage={perms.manageStructure}
    />
  );
}

function HubBody({
  base,
  classId,
  monthKey: rawMonth,
  classes,
  onClass,
  onMonth,
  canEdit,
  canManage,
}: {
  base: PrimaryBase;
  classId: string;
  monthKey: string;
  classes: { id: string; name: string }[];
  onClass: (id: string) => void;
  onMonth: (key: string) => void;
  canEdit: boolean;
  canManage: boolean;
}) {
  const klass = classes.find((c) => c.id === classId);
  const grp = klass ? groupOf(klass.name) : null;
  const periods = useMemo(() => periodsFor(grp, base.months), [grp, base.months]);
  const isYear = rawMonth === "annee";
  const monthKey =
    isYear || periods.some((p) => p.key === rawMonth)
      ? rawMonth
      : defaultPeriodKey(grp, base.months, new Date());

  const subjects = useMemo(() => (grp ? subjectsFor(base.subjects, grp) : []), [base.subjects, grp]);
  const students = useMemo(() => classStudents(base.students, classId), [base.students, classId]);
  const ids = useMemo(() => students.map((s) => s.id), [students]);
  const monthKeys = useMemo(() => periods.map((m) => m.key), [periods]);
  const { scores, pending } = usePrimaryScores(classId, ids, true);

  const ranking = useMemo(
    () => (isYear ? new Map() : monthRanking(subjects, scores, ids, monthKey)),
    [isYear, subjects, scores, ids, monthKey],
  );

  const year = useMemo(() => {
    const results = new Map<string, YearResult>();
    for (const id of ids) results.set(id, computeYear(subjects, scores, id, monthKeys));
    const rk = ranks(ids.map((id) => ({ id, value: results.get(id)?.annual ?? null })));
    return { results, rk };
  }, [ids, subjects, scores, monthKeys]);

  const blocksPresent =
    grp === "je" ? [] : BLOCKS.filter((b) => subjects.some((s) => s.block === b));
  const monthInfo = periods.find((m) => m.key === monthKey);
  const periodLabel = isYear ? "Année entière" : (monthInfo?.label ?? "");
  const saisieMonth = isYear ? (periods[0]?.key ?? "") : monthKey;

  return (
    <div className="space-y-6 rise">
      <style>{PRIMAIRE_PRINT_CSS}</style>
      <PageHeader
        title="Bulletins du primaire"
        subtitle={`Primaire : saisie mensuelle de septembre à juin · Jardin : par trimestre · moyenne sur 10 · ${base.schoolYear}`}
        right={
          canManage ? (
            <Link to="/primaire/matieres" className="text-[13px] text-primary hover:underline">
              Matières du primaire
            </Link>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={classId}
          onChange={(e) => onClass(e.target.value)}
          aria-label="Classe"
          className={filterClass}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={monthKey}
          onChange={(e) => onMonth(e.target.value)}
          aria-label="Période"
          className={filterClass}
        >
          {periods.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
          <option value="annee">Année entière</option>
        </select>
        {canEdit && saisieMonth ? (
          <Link
            to="/primaire/saisie/$classId/$month"
            params={{ classId, month: saisieMonth }}
            className={primaryButton}
          >
            Saisir les notes
          </Link>
        ) : null}
        <button type="button" onClick={() => window.print()} className={linkButton}>
          Imprimer
        </button>
      </div>

      {pending ? (
        <LoadingBlock />
      ) : subjects.length === 0 ? (
        <Panel>
          <p className="text-[13px] text-muted-foreground">
            Aucune matière n'est paramétrée pour cette classe. Exécutez le script SQL du lot 6.
          </p>
        </Panel>
      ) : (
        <div id="print-area">
          <PrintHeader />
          <div className="mb-3 text-[13px] font-semibold uppercase">
            Fiche de classe — {klass?.name} — {periodLabel} — Année scolaire {base.schoolYear}
          </div>
          {isYear ? (
            <TableWrap minWidth={900}>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <Th>N°</Th>
                  <Th>Élève</Th>
                  {periods.map((m) => (
                    <Th key={m.key} className="text-right">
                      {m.short}
                    </Th>
                  ))}
                  <Th className="text-right">Moy. annuelle</Th>
                  <Th className="text-right">Rang</Th>
                  <Th>Appréciation</Th>
                  <Th className="print-hidden" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.length === 0 ? (
                  <EmptyRow colSpan={periods.length + 6} label="Aucun élève dans cette classe." />
                ) : (
                  students.map((s, i) => {
                    const y = year.results.get(s.id);
                    const annual = y?.annual ?? null;
                    return (
                      <tr key={s.id} className="hover:bg-muted/40">
                        <Td className="text-muted-foreground">{i + 1}</Td>
                        <Td className="font-medium">{fullName(s)}</Td>
                        {periods.map((m) => (
                          <Td key={m.key} className="num-display text-right">
                            {fmt(y?.months.get(m.key)?.average) || "—"}
                          </Td>
                        ))}
                        <Td className="num-display text-right font-semibold">{fmt(annual) || "—"}</Td>
                        <Td className="text-right">{ordinal(year.rk.get(s.id) ?? null) || "—"}</Td>
                        <Td className="text-muted-foreground">
                          {annual === null ? "—" : appreciation(annual * 2)}
                        </Td>
                        <Td className="print-hidden">
                          <Link
                            to="/primaire/eleve/$studentId"
                            params={{ studentId: s.id }}
                            className="text-primary hover:underline"
                          >
                            Fiche
                          </Link>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </TableWrap>
          ) : (
            <TableWrap minWidth={820}>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <Th>N°</Th>
                  <Th>Élève</Th>
                  {blocksPresent.map((b) => (
                    <Th key={b} className="text-right">
                      {BLOCK_TITLES[b]}
                    </Th>
                  ))}
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Sur</Th>
                  <Th className="text-right">Moyenne /10</Th>
                  <Th className="text-right">Rang</Th>
                  <Th>Appréciation</Th>
                  <Th className="print-hidden">Notes</Th>
                  <Th className="print-hidden" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.length === 0 ? (
                  <EmptyRow colSpan={blocksPresent.length + 9} label="Aucun élève dans cette classe." />
                ) : (
                  students.map((s, i) => {
                    const r = ranking.get(s.id);
                    const res = r?.result;
                    const avg = res?.average ?? null;
                    return (
                      <tr key={s.id} className="hover:bg-muted/40">
                        <Td className="text-muted-foreground">{i + 1}</Td>
                        <Td className="font-medium">{fullName(s)}</Td>
                        {blocksPresent.map((b) => {
                          const bt = res?.blocks[b];
                          return (
                            <Td key={b} className="text-right">
                              {bt && bt.count > 0 ? `${fmtScore(bt.total)}/${fmtScore(bt.sur)}` : "—"}
                            </Td>
                          );
                        })}
                        <Td className="num-display text-right">{res && res.entered > 0 ? fmtScore(res.total) : "—"}</Td>
                        <Td className="text-right">{res && res.entered > 0 ? fmtScore(res.sur) : "—"}</Td>
                        <Td className="num-display text-right font-semibold">{fmt(avg) || "—"}</Td>
                        <Td className="text-right">{ordinal(r?.rank ?? null) || "—"}</Td>
                        <Td className="text-muted-foreground">
                          {avg === null ? "—" : appreciation(avg * 2)}
                        </Td>
                        <Td className="print-hidden text-muted-foreground">
                          {res ? `${res.entered}/${res.expected}` : "—"}
                        </Td>
                        <Td className="print-hidden">
                          <Link
                            to="/primaire/eleve/$studentId"
                            params={{ studentId: s.id }}
                            className="text-primary hover:underline"
                          >
                            Fiche
                          </Link>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </TableWrap>
          )}
        </div>
      )}
    </div>
  );
}
