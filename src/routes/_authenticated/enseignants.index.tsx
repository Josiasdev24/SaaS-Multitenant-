import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { q, fullName } from "@/lib/data";
import { dateFr } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { TeacherEditor } from "@/components/teacher-editor";
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

export const Route = createFileRoute("/_authenticated/enseignants/")({
  head: () => ({
    meta: [
      { title: "Enseignants — Complexe Scolaire Omarus Adodo" },
      {
        name: "description",
        content: "Corps enseignant : coordonnées, matières enseignées et classes attribuées.",
      },
      { property: "og:title", content: "Enseignants — Complexe Scolaire Omarus Adodo" },
      {
        property: "og:description",
        content: "Coordonnées, matières et classes de chaque enseignant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeachersPage,
});

const STATUS_LABELS: Record<string, string> = {
  actif: "Actif",
  conge: "En congé",
  inactif: "Inactif",
};

function TeachersPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const isFounder = user?.role === "admin";
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const [teachers, subjects, teacherSubjects, classes, classSubjects] = useQueries({
    queries: [q.teachers(), q.subjects(), q.teacherSubjects(), q.classes(), q.classSubjects()],
  });

  const rows = useMemo(() => {
    return (teachers.data ?? [])
      .map((t) => {
        const subjectIds = new Set(
          (teacherSubjects.data ?? [])
            .filter((ts) => ts.teacher_id === t.id)
            .map((ts) => ts.subject_id),
        );
        const taught = (subjects.data ?? []).filter((s) => subjectIds.has(s.id));
        const assigned = (classes.data ?? []).filter(
          (c) =>
            c.main_teacher_id === t.id ||
            (classSubjects.data ?? []).some((cs) => cs.class_id === c.id && cs.teacher_id === t.id),
        );
        return { ...t, taught, assigned };
      })
      .sort((a, b) => a.last_name.localeCompare(b.last_name, "fr") || a.first_name.localeCompare(b.first_name, "fr"));
  }, [teachers.data, teacherSubjects.data, subjects.data, classes.data, classSubjects.data]);

  function openEditor(target: string | "new") {
    setEditing(target);
    window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  if (!perms) return <LoadingBlock />;
  if (!perms.viewFamilies && !perms.manageStructure && !perms.viewAcademics) return <NoAccess />;
  if (teachers.isPending) return <LoadingBlock />;

  const current = editing && editing !== "new" ? (teachers.data ?? []).find((t) => t.id === editing) : undefined;

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Enseignants"
        subtitle={`${rows.length} enseignants — ${rows.filter((r) => r.status === "actif").length} en activité`}
        right={
          perms.manageStructure ? (
            <button
              type="button"
              onClick={() => (editing === "new" ? setEditing(null) : openEditor("new"))}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              {editing === "new" ? "Annuler" : "Ajouter un enseignant"}
            </button>
          ) : null
        }
      />

      <div ref={editorRef}>
        {perms.manageStructure && editing !== null && (editing === "new" || current) ? (
          <TeacherEditor
            key={editing}
            teacher={current ?? null}
            teachers={teachers.data ?? []}
            subjects={subjects.data ?? []}
            classes={classes.data ?? []}
            classSubjects={classSubjects.data ?? []}
            teacherSubjects={teacherSubjects.data ?? []}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </div>

      <TableWrap minWidth={920}>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <Th>Enseignant</Th>
            <Th>Statut</Th>
            <Th>Matières</Th>
            <Th>Classes</Th>
            <Th>Contact</Th>
            <Th>Embauche</Th>
            {perms.manageStructure ? <Th className="print-hidden text-right">Action</Th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <EmptyRow colSpan={perms.manageStructure ? 7 : 6} label="Aucun enseignant enregistré." />
          ) : (
            rows.map((t) => (
              <tr key={t.id} className="hover:bg-muted/40">
                <Td className="font-medium">{fullName(t)}</Td>
                <Td>
                  <Tag
                    tone={
                      t.status === "actif" ? "ok" : t.status === "conge" ? "partial" : "neutral"
                    }
                  >
                    {STATUS_LABELS[t.status] ?? t.status}
                  </Tag>
                </Td>
                <Td className="text-muted-foreground">
                  {t.taught.length ? t.taught.map((s) => s.name).join(", ") : "—"}
                </Td>
                <Td className="text-muted-foreground">
                  {t.assigned.length ? t.assigned.map((c) => c.name).join(", ") : "—"}
                </Td>
                <Td className="text-muted-foreground">
                  <div>{t.phone ?? "—"}</div>
                  <div className="text-[12px] text-faint">{t.email ?? ""}</div>
                </Td>
                <Td className="text-muted-foreground">{dateFr(t.hire_date)}</Td>
                {perms.manageStructure ? (
                  <Td className="print-hidden text-right">
                    <div className="flex items-center justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => openEditor(t.id)}
                        className="text-[13px] font-medium text-primary hover:underline"
                      >
                        Modifier
                      </button>
                      {isFounder ? (
                        <DeleteAction
                          message={
                            `Supprimer définitivement l'enseignant ${fullName(t)} ?\n\n` +
                            (t.assigned.length > 0
                              ? `Il ne sera plus rattaché à ses classes (${t.assigned
                                  .map((c) => c.name)
                                  .join(", ")}) : ces matières ou titulariats resteront sans enseignant.\n`
                              : "Il n'est rattaché à aucune classe.\n") +
                            "Ses notes déjà saisies ne sont pas supprimées. Son compte de connexion n'est pas supprimé."
                          }
                          success={`${fullName(t)} supprimé(e)`}
                          run={async () => {
                            ensureDeleted(await supabase.from("teachers").delete().eq("id", t.id).select("id"));
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
