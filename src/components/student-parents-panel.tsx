import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  checkParent,
  emptyParent,
  fromRow,
  linkParent,
  unlinkParent,
  updateParent,
  type LinkRow,
  type ParentForm,
  type ParentRow,
} from "@/lib/families";
import { ParentBlock } from "@/components/parent-block";
import { Panel, Tag } from "@/components/kit";

type Extras = {
  nationality?: string | null;
  previous_school?: string | null;
  previous_class?: string | null;
  siblings?: string | null;
  health_notes?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
};

const row = (label: string, value: string | null | undefined) =>
  value && value.trim() !== "" ? (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-[13px]">{value}</dd>
    </div>
  ) : null;

/**
 * Parents et tuteurs d'un élève : consulter, ajouter, modifier, retirer.
 * Reprend aussi le reste du dossier d'inscription (fratrie, santé, urgence).
 */
export function StudentParentsPanel({
  studentId,
  links,
  parents,
  canEdit,
  extras,
}: {
  studentId: string;
  links: LinkRow[];
  parents: ParentRow[];
  canEdit: boolean;
  extras: Extras;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<ParentForm>(emptyParent());

  const byId = useMemo(() => new Map(parents.map((p) => [p.id, p])), [parents]);
  const mine = useMemo(
    () => [...links].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
    [links],
  );
  const linkedIds = useMemo(() => new Set(links.map((l) => l.parent_id)), [links]);

  function refresh() {
    void queryClient.invalidateQueries({ predicate: (query) => /parent|student/i.test(String(query.queryKey[0])) });
  }
  function close() {
    setEditing(null);
    setForm(emptyParent());
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editing === "new") {
        checkParent(form, "Parent", true);
        if (form.existingId !== null && linkedIds.has(form.existingId)) {
          throw new Error("Ce parent est déjà rattaché à cet élève.");
        }
        await linkParent(studentId, form, links.length === 0);
        return;
      }
      const link = links.find((l) => l.id === editing);
      if (!link) throw new Error("Lien introuvable.");
      checkParent(form, "Parent", false);
      await updateParent(link.parent_id, link.id, form);
    },
    onSuccess: () => {
      toast.success(editing === "new" ? "Parent ajouté" : "Parent mis à jour");
      refresh();
      close();
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (linkId: string) => unlinkParent(linkId),
    onSuccess: () => {
      toast.success("Parent retiré de cet élève");
      refresh();
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  return (
    <Panel className="lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[15px] font-semibold">Parents et tuteurs</h2>
        {canEdit && editing === null ? (
          <button
            type="button"
            onClick={() => {
              setForm(emptyParent());
              setEditing("new");
            }}
            className="h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 print-hidden"
          >
            Ajouter un parent
          </button>
        ) : null}
      </div>

      {mine.length === 0 && editing === null ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Aucun parent rattaché à cet élève.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {mine.map((l) => {
            const p = byId.get(l.parent_id);
            if (editing === l.id) return null;
            return (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-[13px]">
                <div>
                  <div>
                    <span className="font-medium">{p ? `${p.last_name} ${p.first_name}` : "Parent"}</span>{" "}
                    <Tag>{l.relationship}</Tag>
                    {l.is_primary ? <span className="ml-1.5 text-[11px] text-muted-foreground">1er contact</span> : null}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {[p?.phone, p?.email, p?.profession, p?.address].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                {canEdit ? (
                  <div className="flex gap-3 print-hidden">
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => {
                        if (p) setForm(fromRow(p, l.relationship));
                        setForm((f) => ({ ...f, existingId: null }));
                        setEditing(l.id);
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      disabled={remove.isPending}
                      className="font-medium text-destructive hover:underline"
                      onClick={() => {
                        if (window.confirm(`Retirer ${p ? `${p.last_name} ${p.first_name}` : "ce parent"} de cet élève ?`)) {
                          remove.mutate(l.id);
                        }
                      }}
                    >
                      Retirer
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null ? (
        <div className="mt-4 space-y-3 print-hidden">
          <ParentBlock
            idPrefix="edit"
            title={editing === "new" ? "Nouveau parent ou tuteur" : "Modifier le parent ou tuteur"}
            hint={
              editing === "new"
                ? undefined
                : "Les coordonnées modifiées valent aussi pour les autres enfants de ce parent."
            }
            required={editing === "new"}
            value={form}
            onChange={setForm}
            directory={editing === "new" ? parents.filter((p) => !linkedIds.has(p.id)) : []}
          />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={close}
              className="h-9 rounded-md border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      <dl className="mt-5 grid gap-3 border-t border-border pt-4 md:grid-cols-2">
        {row("Nationalité", extras.nationality)}
        {row("École de provenance", extras.previous_school)}
        {row("Classe faite", extras.previous_class)}
        {row("Fratrie dans l'établissement", extras.siblings)}
        {row("Renseignements sanitaires", extras.health_notes)}
        {row(
          "Personne à prévenir en cas d'urgence",
          [extras.emergency_contact, extras.emergency_phone].filter(Boolean).join(" · "),
        )}
      </dl>
    </Panel>
  );
}
