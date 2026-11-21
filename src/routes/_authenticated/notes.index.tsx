import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/data";
import { groupOf } from "@/lib/primaire";
import { useCurrentUser } from "@/lib/session";
import { DeleteAction, ensureDeleted } from "@/components/delete-actions";
import { LoadingBlock, NoAccess, PageHeader, Panel, TableWrap, Td, Th, EmptyRow } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/notes/")({
  head: () => ({
    meta: [
      { title: "Notes" },
      {
        name: "description",
        content: "Fiches de notes du collège : interrogations, devoirs, composition et moyenne de classe.",
      },
    ],
  }),
  component: NotesHub,
});

const STALE = 5 * 60 * 1000;
const selectClass =
  "h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";

/** Choix de la classe et du trimestre, puis une fiche de notes par matière. */
function NotesHub() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const enabled = Boolean(perms?.viewAcademics);
  const isFounder = user?.role === "admin";
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");

  const [classes, terms, subjects, classSubjects, teachers, evaluations, grades] = useQueries({
    queries: [
      { ...q.classes(), enabled, staleTime: STALE },
      { ...q.terms(), enabled, staleTime: STALE },
      { ...q.subjects(), enabled, staleTime: STALE },
      { ...q.classSubjects(), enabled, staleTime: STALE },
      { ...q.teachers(), enabled, staleTime: STALE },
      { ...q.evaluations(), enabled: enabled && isFounder },
      { ...q.grades(), enabled: enabled && isFounder },
    ],
  });

  const own = perms?.scope === "own";
  const myTeacherId = user?.teacherId ?? null;

  const collegeClasses = useMemo(
    () =>
      (classes.data ?? [])
        .filter((c) => !c.is_archived && groupOf(c.name) === null)
        .filter(
          (c) =>
            !own ||
            (classSubjects.data ?? []).some((cs) => cs.class_id === c.id && cs.teacher_id === myTeacherId),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })),
    [classes.data, classSubjects.data, own, myTeacherId],
  );
  const termList = useMemo(
    () => [...(terms.data ?? [])].sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0)),
    [terms.data],
  );

  const effectiveClass = collegeClasses.find((c) => c.id === classId)?.id ?? collegeClasses[0]?.id ?? "";
  const effectiveTerm = termList.find((t) => t.id === termId)?.id ?? termList[0]?.id ?? "";

  const rows = useMemo(() => {
    const subjectById = new Map((subjects.data ?? []).map((s) => [s.id, s]));
    const teacherById = new Map((teachers.data ?? []).map((t) => [t.id, t]));
    return (classSubjects.data ?? [])
      .filter((cs) => cs.class_id === effectiveClass && (!own || cs.teacher_id === myTeacherId))
      .map((cs) => {
        const evals = (evaluations.data ?? []).filter(
          (e) => e.class_id === effectiveClass && e.subject_id === cs.subject_id && e.term_id === effectiveTerm,
        );
        const evalIds = new Set(evals.map((e) => e.id));
        return {
          id: cs.subject_id,
          name: subjectById.get(cs.subject_id)?.name ?? "Matière",
          coefficient: cs.coefficient,
          teacher: cs.teacher_id ? teacherById.get(cs.teacher_id) : undefined,
          evalCount: evals.length,
          gradeCount: (grades.data ?? []).filter((g) => evalIds.has(g.evaluation_id)).length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [classSubjects.data, subjects.data, teachers.data, evaluations.data, grades.data, effectiveClass, effectiveTerm, own, myTeacherId]);

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics || perms.scope === "primary") return <NoAccess />;
  if (classes.isPending || terms.isPending) return <LoadingBlock />;

  const className = collegeClasses.find((c) => c.id === effectiveClass)?.name ?? "";
  const termName = termList.find((t) => t.id === effectiveTerm)?.name ?? "";

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Notes"
        subtitle="Fiche de notes par classe, matière et trimestre : interrogations, devoirs et composition"
        right={
          <Link to="/primaire" className="text-[13px] text-primary hover:underline">
            Notes du Jardin et du primaire
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={effectiveClass}
          onChange={(e) => setClassId(e.target.value)}
          aria-label="Classe"
          className={selectClass}
        >
          {collegeClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={effectiveTerm}
          onChange={(e) => setTermId(e.target.value)}
          aria-label="Trimestre"
          className={selectClass}
        >
          {termList.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {collegeClasses.length === 0 ? (
        <Panel>
          <p className="text-[13px] text-muted-foreground">Aucune classe du collège n'est disponible.</p>
        </Panel>
      ) : (
        <TableWrap minWidth={560}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Matière</Th>
              <Th>Enseignant</Th>
              <Th className="text-right">Coefficient</Th>
              <Th className="text-right">Fiche</Th>
              {isFounder ? <Th className="print-hidden text-right">Supprimer</Th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <EmptyRow
                colSpan={isFounder ? 5 : 4}
                label="Aucune matière n'est rattachée à cette classe. Ajoutez-la dans la page Matières."
              />
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="text-muted-foreground">
                    {r.teacher ? `${r.teacher.last_name} ${r.teacher.first_name}` : "—"}
                  </Td>
                  <Td className="num-display text-right">{r.coefficient}</Td>
                  <Td className="text-right">
                    <Link
                      to="/notes/fiche/$classId/$subjectId/$termId"
                      params={{ classId: effectiveClass, subjectId: r.id, termId: effectiveTerm }}
                      className="font-medium text-primary hover:underline"
                    >
                      Ouvrir la fiche
                    </Link>
                  </Td>
                  {isFounder ? (
                    <Td className="print-hidden text-right">
                      <DeleteAction
                        label="Supprimer les notes"
                        message={
                          `Supprimer les notes de « ${r.name} » en ${className}, ${termName} ?\n\n` +
                          `${r.evalCount} évaluation(s) (interrogations, devoirs, composition) et ${r.gradeCount} note(s) saisie(s) seront effacées pour tous les élèves de cette classe.\n` +
                          "Les autres matières, les autres trimestres et les autres classes ne sont pas touchés."
                        }
                        typeToConfirm={r.name}
                        blockedReason={
                          r.evalCount === 0
                            ? "Aucune note n'a été saisie pour cette matière à ce trimestre."
                            : undefined
                        }
                        success={`Notes de « ${r.name} » supprimées`}
                        run={async () => {
                          ensureDeleted(
                            await supabase
                              .from("evaluations")
                              .delete()
                              .eq("class_id", effectiveClass)
                              .eq("subject_id", r.id)
                              .eq("term_id", effectiveTerm)
                              .select("id"),
                          );
                        }}
                      />
                    </Td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
