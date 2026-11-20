import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { q, studentAverage, fullName } from "@/lib/data";
import { num } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { classSchema, parseOrThrow, optionalString } from "@/lib/validation";
import { DeleteAction, ensureDeleted } from "@/components/delete-actions";
import {
  PageHeader,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  Panel,
  Tag,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/classes/")({
  head: () => ({
    meta: [
      { title: "Classes — Complexe Scolaire Omarus Adodo" },
      {
        name: "description",
        content:
          "Classes de l'établissement : niveau, effectif, professeur titulaire et moyenne générale.",
      },
      { property: "og:title", content: "Classes — Complexe Scolaire Omarus Adodo" },
      {
        property: "og:description",
        content: "Niveaux, effectifs, titulaires et moyennes de chaque classe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClassesPage,
});

function ClassesPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const isFounder = user?.role === "admin";
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const [classes, levels, students, teachers, grades, evaluations] = useQueries({
    queries: [
      q.classes(),
      q.levels(),
      q.students(),
      { ...q.teachers(), enabled: Boolean(perms?.manageStructure || perms?.viewFamilies) },
      { ...q.grades(), enabled: Boolean(perms?.viewAcademics) },
      { ...q.evaluations(), enabled: Boolean(perms?.viewAcademics) },
    ],
  });

  const rows = useMemo(() => {
    return (classes.data ?? [])
      .map((c) => {
        const enrolled = (students.data ?? []).filter(
          (s) => s.class_id === c.id && s.status === "actif",
        );
        const averages = perms?.viewAcademics
          ? enrolled
              .map((s) => studentAverage(s.id, grades.data ?? [], evaluations.data ?? []))
              .filter((v): v is number => v !== null)
          : [];
        return {
          ...c,
          levelName: levels.data?.find((l) => l.id === c.level_id)?.name ?? "—",
          cycle: levels.data?.find((l) => l.id === c.level_id)?.cycle ?? "",
          count: enrolled.length,
          allStudents: (students.data ?? []).filter((s) => s.class_id === c.id).length,
          evalCount: (evaluations.data ?? []).filter((e) => e.class_id === c.id).length,
          average: averages.length ? averages.reduce((a, b) => a + b, 0) / averages.length : null,
          teacher: teachers.data?.find((t) => t.id === c.main_teacher_id) ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    classes.data,
    students.data,
    levels.data,
    teachers.data,
    grades.data,
    evaluations.data,
    perms?.viewAcademics,
  ]);

  const createClass = useMutation({
    mutationFn: async (form: FormData) => {
      const rawCapacity = optionalString(form.get("capacity"));
      const values = parseOrThrow(classSchema, {
        name: String(form.get("name") ?? ""),
        level_id: String(form.get("level_id") ?? ""),
        capacity: rawCapacity !== undefined ? Number(rawCapacity) : null,
        main_teacher_id: optionalString(form.get("main_teacher_id")),
      });

      const yearId = (classes.data ?? [])[0]?.academic_year_id;
      if (!yearId) throw new Error("Aucune année scolaire disponible.");

      const duplicate = (classes.data ?? []).some(
        (c) => c.name.trim().toLowerCase() === values.name.toLowerCase(),
      );
      if (duplicate) throw new Error(`Une classe nommée "${values.name}" existe déjà.`);

      const { error } = await supabase.from("classes").insert({
        name: values.name,
        level_id: values.level_id,
        academic_year_id: yearId,
        capacity: values.capacity ?? null,
        main_teacher_id: values.main_teacher_id ?? null,
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Classe créée");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e: Error) => toast.error("Création impossible", { description: e.message }),
  });

  if (classes.isPending) return <LoadingBlock />;

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Classes"
        subtitle={`${rows.length} classes réparties sur ${(levels.data ?? []).length} niveaux`}
        right={
          perms?.manageStructure ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              {showForm ? "Annuler" : "Créer une classe"}
            </button>
          ) : null
        }
      />

      {showForm && perms?.manageStructure ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">Nouvelle classe</h2>
          <form
            className="mt-4 grid gap-4 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              createClass.mutate(new FormData(e.currentTarget));
            }}
          >
            <div>
              <label htmlFor="name" className="label-caps">
                Nom
              </label>
              <input id="name" name="name" required placeholder="6e A" className={inputClass} />
            </div>
            <div>
              <label htmlFor="level_id" className="label-caps">
                Niveau
              </label>
              <select id="level_id" name="level_id" required className={inputClass}>
                {(levels.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="capacity" className="label-caps">
                Capacité
              </label>
              <input id="capacity" name="capacity" type="number" min="1" className={inputClass} />
            </div>
            <div>
              <label htmlFor="main_teacher_id" className="label-caps">
                Titulaire
              </label>
              <select id="main_teacher_id" name="main_teacher_id" className={inputClass}>
                <option value="">Aucun</option>
                {(teachers.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {fullName(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <button
                type="submit"
                disabled={createClass.isPending}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {createClass.isPending ? "Création…" : "Créer la classe"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <TableWrap
        minWidth={720}
        footer={<span>{rows.reduce((s, r) => s + r.count, 0)} élèves au total</span>}
      >
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <Th>Classe</Th>
            <Th>Niveau</Th>
            <Th>Cycle</Th>
            <Th>Titulaire</Th>
            <Th className="text-right">Effectif</Th>
            <Th className="text-right">Capacité</Th>
            {perms?.viewAcademics ? <Th className="text-right">Moyenne</Th> : null}
            {isFounder ? <Th className="print-hidden text-right">Action</Th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <EmptyRow colSpan={isFounder ? 8 : 7} label="Aucune classe enregistrée." />
          ) : (
            rows.map((c) => (
              <tr key={c.id} className="hover:bg-muted/40">
                <Td>
                  <Link
                    to="/classes/$classId"
                    params={{ classId: c.id }}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                </Td>
                <Td className="text-muted-foreground">{c.levelName}</Td>
                <Td>
                  <Tag>{c.cycle}</Tag>
                </Td>
                <Td className="text-muted-foreground">{c.teacher ? fullName(c.teacher) : "—"}</Td>
                <Td className="num-display text-right">{c.count}</Td>
                <Td className="num-display text-right text-muted-foreground">
                  {c.capacity ?? "—"}
                </Td>
                {perms?.viewAcademics ? (
                  <Td className="num-display text-right">{num(c.average)}</Td>
                ) : null}
                {isFounder ? (
                  <Td className="print-hidden text-right">
                    <DeleteAction
                      message={
                        `Supprimer définitivement la classe « ${c.name} » ?\n\n` +
                        `• ses ${c.evalCount} évaluation(s) et TOUTES les notes saisies dans cette classe seront effacées ;\n` +
                        "• ses matières, coefficients et enseignants rattachés seront retirés ;\n" +
                        `• ses ${c.allStudents} élève(s) ne sont PAS supprimés : ils passent en « Non affecté » et il faudra les replacer dans une classe.`
                      }
                      typeToConfirm={c.name}
                      success={`Classe « ${c.name} » supprimée`}
                      run={async () => {
                        ensureDeleted(await supabase.from("classes").delete().eq("id", c.id).select("id"));
                      }}
                    />
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

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
