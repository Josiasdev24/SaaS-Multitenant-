import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { groupOf } from "@/lib/primaire";
import {
  deleteSubject,
  saveSubject,
  subjectUsage,
  type ClassRow,
  type ClassSubjectRow,
  type SubjectLink,
  type SubjectRow,
  type TeacherRow,
} from "@/lib/staff";
import { Panel } from "@/components/kit";

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
const smallInput =
  "h-8 rounded-md border border-border bg-card px-2 text-[13px] outline-none focus:border-primary/50";
const buttonPrimary =
  "h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const buttonPlain =
  "h-9 rounded-md border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted disabled:opacity-60";

type Link = { checked: boolean; coefficient: string; teacherId: string };

/**
 * Création et modification d'une matière : intitulé, code, coefficient par défaut,
 * puis les classes (collège) où elle est enseignée, avec leur coefficient et leur enseignant.
 */
export function SubjectEditor({
  subject,
  subjects,
  classes,
  classSubjects,
  teachers,
  onClose,
}: {
  subject: SubjectRow | null;
  subjects: SubjectRow[];
  classes: ClassRow[];
  classSubjects: ClassSubjectRow[];
  teachers: TeacherRow[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const id = subject?.id ?? null;

  // Les classes du Jardin et du primaire ont leurs propres matières (page « Bulletins primaire »).
  const collegeClasses = useMemo(
    () =>
      classes
        .filter((c) => !c.is_archived && groupOf(c.name) === null)
        .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })),
    [classes],
  );

  const existingLinks = useMemo(
    () => classSubjects.filter((cs) => id !== null && cs.subject_id === id),
    [classSubjects, id],
  );

  const [form, setForm] = useState({
    name: subject?.name ?? "",
    code: subject?.code ?? "",
    default_coefficient: String(subject?.default_coefficient ?? 1),
  });
  const [links, setLinks] = useState<Record<string, Link>>(() => {
    const out: Record<string, Link> = {};
    for (const c of collegeClasses) {
      const row = existingLinks.find((l) => l.class_id === c.id);
      out[c.id] = row
        ? { checked: true, coefficient: String(row.coefficient), teacherId: row.teacher_id ?? "" }
        : { checked: false, coefficient: String(subject?.default_coefficient ?? 1), teacherId: "" };
    }
    return out;
  });

  const patch = (classId: string, change: Partial<Link>) =>
    setLinks((prev) => {
      const current = prev[classId];
      return current ? { ...prev, [classId]: { ...current, ...change } } : prev;
    });

  const activeTeachers = useMemo(
    () =>
      [...teachers]
        .filter((t) => t.status !== "inactif")
        .sort((a, b) => a.last_name.localeCompare(b.last_name, "fr")),
    [teachers],
  );

  function refreshAll() {
    void queryClient.invalidateQueries();
  }

  const save = useMutation({
    mutationFn: () => {
      const chosen: SubjectLink[] = collegeClasses
        .filter((c) => links[c.id]?.checked)
        .map((c) => ({
          classId: c.id,
          coefficient: links[c.id]?.coefficient ?? "1",
          teacherId: links[c.id]?.teacherId ?? "",
        }));
      return saveSubject({
        id,
        input: form,
        links: chosen,
        existing: subjects,
        previousClassIds: existingLinks.map((l) => l.class_id),
      });
    },
    onSuccess: () => {
      toast.success(id ? "Matière mise à jour" : "Matière ajoutée");
      refreshAll();
      onClose();
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const usage = await subjectUsage(id as string);
      if (usage.evaluations === 0) {
        const extra =
          usage.bulletinNotes > 0
            ? `\n\nAttention : ${usage.bulletinNotes} note(s) de bulletin de cette matière seront aussi supprimées.`
            : "";
        if (!window.confirm(`Supprimer définitivement la matière « ${subject?.name} » ?${extra}`)) return false;
      }
      await deleteSubject(id as string);
      return true;
    },
    onSuccess: (done) => {
      if (!done) return;
      toast.success("Matière supprimée");
      refreshAll();
      onClose();
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  const busy = save.isPending || remove.isPending;

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[15px] font-semibold">
          {subject ? `Modifier la matière « ${subject.name} »` : "Nouvelle matière"}
        </h2>
        <button type="button" onClick={onClose} className="text-[13px] text-muted-foreground hover:underline">
          Fermer
        </button>
      </div>

      <form
        className="mt-4 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="s-name" className="label-caps">
              Intitulé
            </label>
            <input
              id="s-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
              placeholder="Mathématiques"
            />
          </div>
          <div>
            <label htmlFor="s-code" className="label-caps">
              Code
            </label>
            <input
              id="s-code"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className={inputClass}
              placeholder="MATH"
            />
          </div>
          <div>
            <label htmlFor="s-coef" className="label-caps">
              Coefficient par défaut
            </label>
            <input
              id="s-coef"
              inputMode="decimal"
              value={form.default_coefficient}
              onChange={(e) => setForm((f) => ({ ...f, default_coefficient: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        <fieldset>
          <legend className="label-caps">Classes où la matière est enseignée</legend>
          <div className="mt-2 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Classe</th>
                  <th className="px-3 py-2 text-center font-medium">Enseignée</th>
                  <th className="px-3 py-2 text-left font-medium">Coefficient</th>
                  <th className="px-3 py-2 text-left font-medium">Enseignant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {collegeClasses.map((c) => {
                  const l = links[c.id];
                  if (!l) return null;
                  return (
                    <tr key={c.id} className={l.checked ? "" : "text-muted-foreground"}>
                      <td className="px-3 py-1.5 font-medium">{c.name}</td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={l.checked}
                          onChange={(e) => patch(c.id, { checked: e.target.checked })}
                          aria-label={`Enseignée en ${c.name}`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          inputMode="decimal"
                          disabled={!l.checked}
                          value={l.coefficient}
                          onChange={(e) => patch(c.id, { coefficient: e.target.value })}
                          className={`${smallInput} w-20 text-center`}
                          aria-label={`Coefficient en ${c.name}`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          disabled={!l.checked}
                          value={l.teacherId}
                          onChange={(e) => patch(c.id, { teacherId: e.target.value })}
                          className={`${smallInput} w-full max-w-[260px]`}
                          aria-label={`Enseignant en ${c.name}`}
                        >
                          <option value="">— Aucun —</option>
                          {activeTeachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.first_name} {t.last_name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Décocher une classe retire la matière de cette classe. Les notes du Jardin et du primaire se règlent
            dans « Bulletins primaire ».
          </p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={buttonPrimary}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" onClick={onClose} className={buttonPlain}>
            Annuler
          </button>
          {subject ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => remove.mutate()}
              className="ml-auto h-9 rounded-md border border-destructive px-3.5 text-[13px] font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-60"
            >
              {remove.isPending ? "Suppression…" : "Supprimer la matière"}
            </button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}
