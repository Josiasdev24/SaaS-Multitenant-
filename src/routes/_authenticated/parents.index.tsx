import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { q, fullName } from "@/lib/data";
import { useCurrentUser } from "@/lib/session";
import { parentSchema, parseOrThrow, optionalString } from "@/lib/validation";
import { DeleteAction, ensureDeleted } from "@/components/delete-actions";
import {
  PageHeader,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  Panel,
  NoAccess,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/parents/")({
  head: () => ({
    meta: [
      { title: "Parents & tuteurs — Complexe Scolaire Omarus Adodo" },
      {
        name: "description",
        content: "Répertoire des parents et tuteurs avec coordonnées et enfants rattachés.",
      },
      { property: "og:title", content: "Parents & tuteurs — Complexe Scolaire Omarus Adodo" },
      { property: "og:description", content: "Coordonnées des familles et enfants rattachés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParentsPage,
});

function ParentsPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const isFounder = user?.role === "admin";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [parents, links, students] = useQueries({
    queries: [q.parents(), q.studentParents(), q.students()],
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (parents.data ?? [])
      .map((p) => {
        const childIds = (links.data ?? []).filter((l) => l.parent_id === p.id);
        const children = childIds.flatMap((l) => {
          const s = (students.data ?? []).find((st) => st.id === l.student_id);
          return s
            ? [
                {
                  id: s.id,
                  first_name: s.first_name,
                  last_name: s.last_name,
                  relationship: l.relationship,
                },
              ]
            : [];
        });
        return { ...p, children };
      })
      .filter((p) => {
        if (!term) return true;
        return (
          fullName(p).toLowerCase().includes(term) ||
          (p.phone ?? "").toLowerCase().includes(term) ||
          (p.email ?? "").toLowerCase().includes(term) ||
          p.children.some((c) => fullName(c).toLowerCase().includes(term))
        );
      });
  }, [parents.data, links.data, students.data, search]);

  const createParent = useMutation({
    mutationFn: async (form: FormData) => {
      const values = parseOrThrow(parentSchema, {
        first_name: String(form.get("first_name") ?? ""),
        last_name: String(form.get("last_name") ?? ""),
        phone: optionalString(form.get("phone")),
        email: optionalString(form.get("email")),
        address: optionalString(form.get("address")),
        profession: optionalString(form.get("profession")),
      });
      const { error } = await supabase.from("parents").insert({
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone ?? null,
        email: values.email ?? null,
        address: values.address ?? null,
        profession: values.profession ?? null,
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Parent enregistré");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["parents"] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  if (!perms) return <LoadingBlock />;
  if (!perms.viewFamilies) return <NoAccess />;
  if (parents.isPending) return <LoadingBlock />;

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Parents & tuteurs"
        subtitle={`${rows.length} familles répertoriées`}
        right={
          perms.manageStructure ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              {showForm ? "Annuler" : "Ajouter un parent"}
            </button>
          ) : null
        }
      />

      {showForm && perms.manageStructure ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">Nouveau parent / tuteur</h2>
          <form
            className="mt-4 grid gap-4 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              createParent.mutate(new FormData(e.currentTarget));
            }}
          >
            {[
              { id: "first_name", label: "Prénom", required: true },
              { id: "last_name", label: "Nom", required: true },
              { id: "phone", label: "Téléphone" },
              { id: "email", label: "Email" },
              { id: "profession", label: "Profession" },
              { id: "address", label: "Adresse" },
            ].map((f) => (
              <div key={f.id}>
                <label htmlFor={f.id} className="label-caps">
                  {f.label}
                </label>
                <input id={f.id} name={f.id} required={f.required} className={inputClass} />
              </div>
            ))}
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={createParent.isPending}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {createParent.isPending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un parent, un téléphone, un enfant…"
        className="h-9 w-full max-w-md rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50"
      />

      <TableWrap minWidth={820}>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <Th>Parent / tuteur</Th>
            <Th>Téléphone</Th>
            <Th>Email</Th>
            <Th>Profession</Th>
            <Th>Enfants</Th>
            {isFounder ? <Th className="print-hidden text-right">Action</Th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <EmptyRow colSpan={isFounder ? 6 : 5} label="Aucun parent trouvé." />
          ) : (
            rows.map((p) => (
              <tr key={p.id} className="hover:bg-muted/40">
                <Td className="font-medium">{fullName(p)}</Td>
                <Td className="num-display text-muted-foreground">{p.phone ?? "—"}</Td>
                <Td className="text-muted-foreground">{p.email ?? "—"}</Td>
                <Td className="text-muted-foreground">{p.profession ?? "—"}</Td>
                <Td>
                  {p.children.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {p.children.map((c) => (
                        <Link
                          key={c.id}
                          to="/eleves/$studentId"
                          params={{ studentId: c.id }}
                          className="hover:underline"
                        >
                          {fullName(c)}
                          <span className="ml-1 text-[11px] text-faint">({c.relationship})</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </Td>
                {isFounder ? (
                  <Td className="print-hidden text-right">
                    <DeleteAction
                      message={
                        `Supprimer définitivement ${fullName(p)} du répertoire des parents ?\n\n` +
                        (p.children.length > 0
                          ? `Il ou elle sera retiré(e) de ${p.children.length} élève(s) : ${p.children
                              .map((c) => fullName(c))
                              .join(", ")}.\n`
                          : "Aucun élève n'est rattaché à ce parent.\n") +
                        "Les élèves eux-mêmes ne sont pas supprimés."
                      }
                      success={`${fullName(p)} supprimé(e)`}
                      run={async () => {
                        ensureDeleted(await supabase.from("parents").delete().eq("id", p.id).select("id"));
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
