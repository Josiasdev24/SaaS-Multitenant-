import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { fmt, ordinal, appreciation } from "@/lib/bulletin";
import { fullName, compareNames } from "@/lib/data";
import { useBulletinData } from "@/lib/bulletin-data";
import { useCurrentUser } from "@/lib/session";
import { DeleteAction, ensureNoError } from "@/components/delete-actions";
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

export const Route = createFileRoute("/_authenticated/bulletins/")({
  head: () => ({
    meta: [{ title: "Bulletins du collège — Registre scolaire" }],
  }),
  component: BulletinsHub,
});

const filterClass =
  "h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
const linkButton =
  "inline-flex h-9 items-center rounded-md border border-border px-3.5 text-[13px] font-medium hover:bg-muted";

function BulletinsHub() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");

  const data = useBulletinData(classId, termId, Boolean(perms?.viewAcademics));

  // Classes du collège : celles qui ont des matières paramétrées.
  const collegeClasses = useMemo(() => {
    const ids = new Set(data.classSubjects.map((cs) => cs.class_id));
    return data.classes
      .filter((c) => ids.has(c.id))
      .filter(
        (c) =>
          !perms?.ownClassesOnly ||
          data.classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === user?.teacherId),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.classes, data.classSubjects, perms?.ownClassesOnly, user?.teacherId]);

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics) return <NoAccess />;
  if (data.pending) return <LoadingBlock />;

  const effectiveClass = classId || collegeClasses[0]?.id || "";
  const effectiveTerm = termId || data.terms.sort((a, b) => a.order - b.order)[0]?.id || "";

  return (
    <HubBody
      key={`${effectiveClass}-${effectiveTerm}`}
      classId={effectiveClass}
      termId={effectiveTerm}
      onClass={setClassId}
      onTerm={setTermId}
      collegeClasses={collegeClasses.map((c) => ({ id: c.id, name: c.name }))}
      canEdit={perms.editAcademics}
      isFounder={user?.role === "admin"}
    />
  );
}

function HubBody({
  classId,
  termId,
  onClass,
  onTerm,
  collegeClasses,
  canEdit,
  isFounder,
}: {
  classId: string;
  termId: string;
  onClass: (id: string) => void;
  onTerm: (id: string) => void;
  collegeClasses: { id: string; name: string }[];
  canEdit: boolean;
  isFounder: boolean;
}) {
  const data = useBulletinData(classId, termId);
  if (data.pending) return <LoadingBlock />;

  const terms = [...data.terms].sort((a, b) => a.order - b.order);
  const termName = terms.find((t) => t.id === termId)?.name ?? "ce trimestre";
  // Ordre alphabétique (NOM puis prénom) ; le rang reste affiché dans sa colonne.
  const rows = [...data.report.reports].sort((a, b) => compareNames(a.student, b.student));

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Bulletins du collège"
        subtitle="Saisie des notes, bulletins individuels et fiche de classement par classe."
      />

      <div className="flex flex-wrap gap-3">
        <select value={classId} onChange={(e) => onClass(e.target.value)} aria-label="Classe" className={filterClass}>
          {collegeClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={termId} onChange={(e) => onTerm(e.target.value)} aria-label="Trimestre" className={filterClass}>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {classId && termId ? (
        <Panel>
          <div className="flex flex-wrap gap-3">
            {canEdit ? (
              <Link
                to="/bulletins/saisie/$classId/$termId"
                params={{ classId, termId }}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
              >
                Saisir les notes
              </Link>
            ) : null}
            <Link to="/bulletins/classement/$classId/$termId" params={{ classId, termId }} className={linkButton}>
              Fiche de classement
            </Link>
            <Link to="/bulletins/classe/$classId/$termId" params={{ classId, termId }} className={linkButton}>
              Imprimer tous les bulletins
            </Link>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            {data.students.length} élève(s) · {data.subjects.length} matière(s) · titulaire :{" "}
            {data.titulaire || "non renseigné"}
          </p>
        </Panel>
      ) : null}

      <TableWrap minWidth={620}>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <Th>Élève</Th>
            <Th>Sexe</Th>
            <Th className="text-right">Moyenne du trimestre</Th>
            <Th>Rang</Th>
            <Th>Appréciation</Th>
            <Th className="text-right">Bulletin</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} label="Aucun élève dans cette classe." />
          ) : (
            rows.map((r) => (
              <tr key={r.student.id} className="hover:bg-muted/40">
                <Td className="font-medium">{fullName(r.student)}</Td>
                <Td className="text-muted-foreground">{r.student.gender ?? "—"}</Td>
                <Td className="num-display text-right">{r.average === null ? "—" : fmt(r.average)}</Td>
                <Td>{ordinal(r.rank) || "—"}</Td>
                <Td className="text-muted-foreground">{appreciation(r.average) || "—"}</Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-4">
                    <Link
                      to="/bulletins/eleve/$studentId/$termId"
                      params={{ studentId: r.student.id, termId }}
                      className="text-[12px] font-medium text-primary hover:underline"
                    >
                      Ouvrir
                    </Link>
                    {isFounder ? (
                      <DeleteAction
                        message={
                          `Supprimer le bulletin de ${fullName(r.student)} pour ${termName} ?\n\n` +
                          "Sont effacés : ses appréciations et observations, ses compositions et moyennes de classe saisies pour le bulletin, et le bulletin généré.\n" +
                          "Les notes des fiches (interrogations, devoirs) ne sont PAS supprimées : le bulletin pourra être refait."
                        }
                        success={`Bulletin de ${fullName(r.student)} supprimé`}
                        className="text-[12px] font-medium text-destructive hover:underline disabled:opacity-50"
                        run={async () => {
                          ensureNoError(
                            await supabase
                              .from("bulletin_remarks")
                              .delete()
                              .eq("student_id", r.student.id)
                              .eq("term_id", termId),
                          );
                          ensureNoError(
                            await supabase
                              .from("bulletin_notes")
                              .delete()
                              .eq("student_id", r.student.id)
                              .eq("term_id", termId),
                          );
                          ensureNoError(
                            await supabase
                              .from("report_cards")
                              .delete()
                              .eq("student_id", r.student.id)
                              .eq("term_id", termId),
                          );
                        }}
                      />
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
