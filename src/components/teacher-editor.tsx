import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  deleteTeacher,
  saveTeacher,
  transferTeacher,
  type ClassRow,
  type ClassSubjectRow,
  type SubjectRow,
  type TeacherRow,
  type TeacherStatus,
  type TeacherSubjectRow,
} from "@/lib/staff";
import { Panel } from "@/components/kit";

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
const buttonPrimary =
  "h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const buttonPlain =
  "h-9 rounded-md border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted disabled:opacity-60";

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "fr", { numeric: true });

const toggle = (set: Set<string>, id: string): Set<string> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

const teacherName = (t: { first_name: string; last_name: string }) => `${t.first_name} ${t.last_name}`;

/**
 * Création et modification d'un enseignant : identité, classes dont il est titulaire,
 * cours donnés (matière dans une classe) et matières enseignées. Suppression et remplacement inclus.
 */
export function TeacherEditor({
  teacher,
  teachers,
  subjects,
  classes,
  classSubjects,
  teacherSubjects,
  onClose,
}: {
  teacher: TeacherRow | null;
  teachers: TeacherRow[];
  subjects: SubjectRow[];
  classes: ClassRow[];
  classSubjects: ClassSubjectRow[];
  teacherSubjects: TeacherSubjectRow[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const id = teacher?.id ?? null;

  const classList = useMemo(() => classes.filter((c) => !c.is_archived).sort(byName), [classes]);
  const subjectName = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const className = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const teacherById = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  // Ce que l'enseignant a aujourd'hui (point de départ, pour calculer les changements)
  const before = useMemo(() => {
    const titular = id ? classes.filter((c) => c.main_teacher_id === id).map((c) => c.id) : [];
    const courses = id ? classSubjects.filter((cs) => cs.teacher_id === id).map((cs) => cs.id) : [];
    const own = id ? teacherSubjects.filter((ts) => ts.teacher_id === id).map((ts) => ts.subject_id) : [];
    return { titularClassIds: titular, courseIds: courses, subjectIds: own };
  }, [id, classes, classSubjects, teacherSubjects]);

  const [form, setForm] = useState({
    first_name: teacher?.first_name ?? "",
    last_name: teacher?.last_name ?? "",
    phone: teacher?.phone ?? "",
    email: teacher?.email ?? "",
    status: (teacher?.status ?? "actif") as TeacherStatus,
    hire_date: teacher?.hire_date ?? "",
  });
  const [titular, setTitular] = useState(() => new Set(before.titularClassIds));
  const [courses, setCourses] = useState(() => new Set(before.courseIds));
  const [own, setOwn] = useState(() => new Set(before.subjectIds));
  const [replaceBy, setReplaceBy] = useState("");

  const courseSubject = useMemo(
    () => new Map(classSubjects.map((cs) => [cs.id, cs.subject_id])),
    [classSubjects],
  );

  // Cours regroupés par classe
  const coursesByClass = useMemo(() => {
    const groups = new Map<string, ClassSubjectRow[]>();
    for (const cs of classSubjects) {
      const list = groups.get(cs.class_id) ?? [];
      list.push(cs);
      groups.set(cs.class_id, list);
    }
    return classList
      .filter((c) => groups.has(c.id))
      .map((c) => ({
        klass: c,
        rows: (groups.get(c.id) ?? []).sort((a, b) =>
          (subjectName.get(a.subject_id) ?? "").localeCompare(subjectName.get(b.subject_id) ?? "", "fr"),
        ),
      }));
  }, [classSubjects, classList, subjectName]);

  const impliedSubjects = useMemo(() => {
    const s = new Set<string>();
    for (const c of courses) {
      const sid = courseSubject.get(c);
      if (sid) s.add(sid);
    }
    return s;
  }, [courses, courseSubject]);

  function refreshAll() {
    void queryClient.invalidateQueries();
  }

  const save = useMutation({
    mutationFn: () =>
      saveTeacher({
        id,
        input: form,
        before,
        after: { titularClassIds: [...titular], courseIds: [...courses], subjectIds: [...own] },
        courseSubject,
      }),
    onSuccess: () => {
      toast.success(id ? "Enseignant mis à jour" : "Enseignant ajouté");
      refreshAll();
      onClose();
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: () => deleteTeacher(id as string),
    onSuccess: () => {
      toast.success("Enseignant supprimé");
      refreshAll();
      onClose();
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  const transfer = useMutation({
    mutationFn: () => transferTeacher(id as string, replaceBy),
    onSuccess: () => {
      toast.success("Classes et matières transférées", {
        description: "Vous pouvez maintenant supprimer l'ancien enseignant.",
      });
      refreshAll();
      onClose();
    },
    onError: (e: Error) => toast.error("Transfert impossible", { description: e.message }),
  });

  const field = (key: keyof typeof form, label: string, type = "text", required = false) => (
    <div>
      <label htmlFor={`t-${key}`} className="label-caps">
        {label}
      </label>
      <input
        id={`t-${key}`}
        type={type}
        required={required}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={inputClass}
      />
    </div>
  );

  const busy = save.isPending || remove.isPending || transfer.isPending;
  const others = teachers.filter((t) => t.id !== id).sort((a, b) => a.last_name.localeCompare(b.last_name, "fr"));

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[15px] font-semibold">
          {teacher ? `Modifier ${teacherName(teacher)}` : "Nouvel enseignant"}
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
          {field("last_name", "Nom", "text", true)}
          {field("first_name", "Prénom", "text", true)}
          {field("phone", "Téléphone")}
          {field("email", "Email", "email")}
          {field("hire_date", "Date d'embauche", "date")}
          <div>
            <label htmlFor="t-status" className="label-caps">
              Statut
            </label>
            <select
              id="t-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TeacherStatus }))}
              className={inputClass}
            >
              <option value="actif">Actif</option>
              <option value="conge">En congé</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="label-caps">Titulaire de la classe</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {classList.map((c) => {
              const checked = titular.has(c.id);
              const holder = c.main_teacher_id && c.main_teacher_id !== id ? teacherById.get(c.main_teacher_id) : null;
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] ${
                    checked ? "border-primary bg-secondary" : "border-border bg-card"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setTitular((s) => toggle(s, c.id))}
                  />
                  <span className="font-medium">{c.name}</span>
                  {holder && !checked ? (
                    <span className="text-[11px] text-muted-foreground">(actuel : {teacherName(holder)})</span>
                  ) : null}
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Cocher une classe déjà confiée à un autre enseignant la lui retire.
          </p>
        </fieldset>

        {coursesByClass.length > 0 ? (
          <fieldset>
            <legend className="label-caps">Cours donnés (matière dans une classe)</legend>
            <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {coursesByClass.map(({ klass, rows }) => (
                <div key={klass.id} className="rounded-md border border-border bg-card p-2.5">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-primary">{klass.name}</div>
                  <ul className="mt-1.5 space-y-1">
                    {rows.map((cs) => {
                      const checked = courses.has(cs.id);
                      const holder = cs.teacher_id && cs.teacher_id !== id ? teacherById.get(cs.teacher_id) : null;
                      return (
                        <li key={cs.id}>
                          <label className="flex cursor-pointer items-start gap-2 text-[13px]">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              onChange={() => setCourses((s) => toggle(s, cs.id))}
                            />
                            <span>
                              {subjectName.get(cs.subject_id) ?? "Matière"}
                              {holder && !checked ? (
                                <span className="block text-[11px] text-muted-foreground">
                                  actuel : {teacherName(holder)}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset>
          <legend className="label-caps">Matières enseignées</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...subjects].sort(byName).map((s) => {
              const implied = impliedSubjects.has(s.id);
              const checked = implied || own.has(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] ${
                    checked ? "border-primary bg-secondary" : "border-border bg-card"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={implied}
                    onChange={() => setOwn((o) => toggle(o, s.id))}
                  />
                  {s.name}
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Les matières des cours cochés ci-dessus sont ajoutées automatiquement.
          </p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={buttonPrimary}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" onClick={onClose} className={buttonPlain}>
            Annuler
          </button>
        </div>
      </form>

      {teacher ? (
        <div className="mt-6 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
          <div>
            <div className="label-caps">Remplacer cet enseignant</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Transfère toutes ses classes, ses cours et ses matières à un autre enseignant (déjà enregistré).
            </p>
            <div className="mt-2 flex gap-2">
              <select value={replaceBy} onChange={(e) => setReplaceBy(e.target.value)} className={inputClass + " mt-0"}>
                <option value="">Choisir le remplaçant…</option>
                {others.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teacherName(t)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || replaceBy === ""}
                onClick={() => {
                  const to = teacherById.get(replaceBy);
                  if (to && window.confirm(`Transférer toutes les classes et matières de ${teacherName(teacher)} à ${teacherName(to)} ?`)) {
                    transfer.mutate();
                  }
                }}
                className={buttonPlain}
              >
                Transférer
              </button>
            </div>
          </div>
          <div>
            <div className="label-caps">Supprimer cet enseignant</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Ses classes et ses cours restent, mais sans enseignant. Les notes déjà saisies sont conservées.
              {before.titularClassIds.length > 0
                ? ` Il est titulaire de : ${before.titularClassIds.map((c) => className.get(c) ?? "").join(", ")}.`
                : ""}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Supprimer définitivement ${teacherName(teacher)} ?`)) remove.mutate();
              }}
              className="mt-2 h-9 rounded-md border border-destructive px-3.5 text-[13px] font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-60"
            >
              Supprimer
            </button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
