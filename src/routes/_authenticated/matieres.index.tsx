import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { q, fullName, averageOn20 } from "@/lib/data";
import { num } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { SubjectEditor } from "@/components/subject-editor";
import { DeleteAction, ensureDeleted } from "@/components/delete-actions";
import {
  PageHeader,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  Tag,
  NoAccess,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/matieres/")({
  head: () => ({
    meta: [
      { title: "Matières" },
      {
        name: "description",
        content: "Matières enseignées, coefficients, enseignants rattachés et moyennes.",
      },
      { property: "og:title", content: "Matières" },
      { property: "og:description", content: "Coefficients, enseignants et moyennes par matière." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const isFounder = user?.role === "admin";
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const [subjects, classSubjects, teachers, evaluations, grades, classes] = useQueries({
    queries: [q.subjects(), q.classSubjects(), q.teachers(), q.evaluations(), q.grades(), q.classes()],
  });

  const rows = useMemo(() => {
    return (subjects.data ?? []).map((s) => {
      const links = (classSubjects.data ?? []).filter((cs) => cs.subject_id === s.id);
      const teacherIds = new Set(links.map((l) => l.teacher_id).filter(Boolean) as string[]);
      const classNames = (classes.data ?? [])
        .filter((c) => links.some((l) => l.class_id === c.id))
        .map((c) => c.name)
        .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
      const evals = (evaluations.data ?? []).filter((e) => e.subject_id === s.id);
      const evalIds = new Set(evals.map((e) => e.id));
      const avg = averageOn20(
        (grades.data ?? []).filter((g) => evalIds.has(g.evaluation_id)),
        evals,
      );
      return {
        ...s,
        classCount: links.length,
        classNames,
        teachers: (teachers.data ?? []).filter((t) => teacherIds.has(t.id)),
        evalCount: evals.length,
        avg,
      };
    });
  }, [subjects.data, classSubjects.data, teachers.data, evaluations.data, grades.data, classes.data]);

  function openEditor(target: string | "new") {
    setEditing(target);
    window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  if (!perms) return <LoadingBlock />;
  if (!perms.viewAcademics) return <NoAccess />;
  if (subjects.isPending) return <LoadingBlock />;

  const current = editing && editing !== "new" ? (subjects.data ?? []).find((s) => s.id === editing) : undefined;

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Matières"
        subtitle={`${rows.length} matières au programme`}
        right={
          perms.manageStructure ? (
            <button
              type="button"
              onClick={() => (editing === "new" ? setEditing(null) : openEditor("new"))}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              {editing === "new" ? "Annuler" : "Ajouter une matière"}
            </button>
          ) : null
        }
      />

      <div ref={editorRef}>
        {perms.manageStructure && editing !== null && (editing === "new" || current) ? (
          <SubjectEditor
            key={editing}
            subject={current ?? null}
            subjects={subjects.data ?? []}
            classes={classes.data ?? []}
            classSubjects={classSubjects.data ?? []}
            teachers={teachers.data ?? []}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </div>

      <TableWrap minWidth={900}>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <Th>Matière</Th>
            <Th>Code</Th>
            <Th>Classes</Th>
            <Th>Enseignants</Th>
            <Th className="text-right">Évaluations</Th>
            <Th className="text-right">Moyenne /20</Th>
            {perms.manageStructure ? <Th className="print-hidden text-right">Action</Th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <EmptyRow colSpan={perms.manageStructure ? 7 : 6} label="Aucune matière enregistrée." />
          ) : (
            rows.map((s) => (
              <tr key={s.id} className="hover:bg-muted/40">
                <Td className="font-medium">{s.name}</Td>
                <Td>
                  <Tag>{s.code}</Tag>
                </Td>
                <Td className="text-muted-foreground">{s.classNames.length ? s.classNames.join(", ") : "—"}</Td>
                <Td className="text-muted-foreground">
                  {s.teachers.length ? s.teachers.map((t) => fullName(t)).join(", ") : "—"}
                </Td>
                <Td className="num-display text-right text-muted-foreground">{s.evalCount}</Td>
                <Td className="num-display text-right">{num(s.avg)}</Td>
                {perms.manageStructure ? (
                  <Td className="print-hidden text-right">
                    <div className="flex items-center justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => openEditor(s.id)}
                        className="text-[13px] font-medium text-primary hover:underline"
                      >
                        Modifier
                      </button>
                      {isFounder ? (
                        <DeleteAction
                          message={
                            `Supprimer définitivement la matière « ${s.name} » ?\n\n` +
                            `Elle sera retirée de ${s.classCount} classe(s)` +
                            (s.classNames.length ? ` (${s.classNames.join(", ")})` : "") +
                            ", avec ses coefficients, ses enseignants rattachés et ses notes de bulletin."
                          }
                          typeToConfirm={s.name}
                          blockedReason={
                            s.evalCount > 0
                              ? `La matière « ${s.name} » a ${s.evalCount} évaluation(s) avec des notes. Supprimez d'abord ses fiches de notes (page Notes), puis recommencez.`
                              : undefined
                          }
                          success={`Matière « ${s.name} » supprimée`}
                          run={async () => {
                            ensureDeleted(await supabase.from("subjects").delete().eq("id", s.id).select("id"));
                          }}
                        />
                      ) : null}
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}
