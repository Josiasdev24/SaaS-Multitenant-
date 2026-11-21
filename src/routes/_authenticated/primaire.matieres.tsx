import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { BLOCK_TITLES, GRPS, GRP_LABELS, fmtScore, subjectsFor, type PSubject } from "@/lib/primaire";
import { updateSubject, usePrimaryBase } from "@/lib/primaire-data";
import { useCurrentUser } from "@/lib/session";
import { LoadingBlock, NoAccess, PageHeader, Panel, TableWrap, Th, Td } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/primaire/matieres")({
  head: () => ({
    meta: [{ title: "Matières du primaire" }],
  }),
  component: MatieresPage,
});

type Draft = { max: string; coef: string; active: boolean };

const inputClass =
  "h-8 w-20 rounded-md border border-border bg-card px-2 text-center text-[13px] outline-none focus:border-primary/50";

function toNumber(raw: string, label: string): number {
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} : valeur invalide « ${raw} ».`);
  return n;
}

function MatieresPage() {
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const base = usePrimaryBase(Boolean(perms?.manageStructure));

  if (!perms) return <LoadingBlock />;
  if (!perms.manageStructure || perms.scope === "college") return <NoAccess />;
  if (base.pending) return <LoadingBlock />;
  return <Editor subjects={base.subjects} />;
}

function Editor({ subjects }: { subjects: PSubject[] }) {
  const queryClient = useQueryClient();

  const initial = useMemo(() => {
    const m: Record<string, Draft> = {};
    for (const s of subjects) m[s.id] = { max: fmtScore(s.max), coef: fmtScore(s.coef), active: s.active };
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(initial);
  const baseline = useRef<Record<string, Draft>>(initial);

  const save = useMutation({
    mutationFn: async () => {
      let n = 0;
      for (const s of subjects) {
        const d = drafts[s.id];
        const b = baseline.current[s.id];
        if (!d || !b) continue;
        if (d.max === b.max && d.coef === b.coef && d.active === b.active) continue;
        await updateSubject(s.id, {
          max_points: toNumber(d.max, `${s.name} (barème)`),
          coefficient: toNumber(d.coef, `${s.name} (coefficient)`),
          is_active: d.active,
        });
        n += 1;
      }
      return n;
    },
    onSuccess: (n) => {
      baseline.current = { ...drafts };
      toast.success(n === 0 ? "Aucune modification" : `${n} matière(s) mise(s) à jour`);
      void queryClient.invalidateQueries({ queryKey: ["primary-subjects"] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  function patch(id: string, change: Partial<Draft>) {
    setDrafts((prev) => {
      const current = prev[id];
      return current ? { ...prev, [id]: { ...current, ...change } } : prev;
    });
  }

  return (
    <div className="space-y-6 rise">
      <PageHeader
        title="Matières du primaire"
        subtitle="Barème et coefficient de chaque matière, par niveau"
        right={
          <Link to="/primaire" className="text-[13px] text-primary hover:underline">
            Retour aux bulletins du primaire
          </Link>
        }
      />
      <Panel>
        <p className="text-[13px] text-muted-foreground">
          Règle de l'école : barème 10 avec coefficient 1, barème 20 avec coefficient 2. « Je sais écrire les mots »
          et « Questions » valent 10 chacune, soit 20 au total. Un changement s'applique aussi aux mois déjà saisis.
          « Nombre de fautes » n'est pas une matière et n'apparaît pas.
        </p>
      </Panel>

      {GRPS.map((g) => {
        const list = subjectsFor(subjects, g);
        const inactive = subjects.filter((s) => s.grp === g && !s.active);
        const rows = [...list, ...inactive];
        return (
          <section key={g} className="space-y-2">
            <h2 className="label-caps">{GRP_LABELS[g]}</h2>
            <TableWrap minWidth={560}>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <Th>Matière</Th>
                  <Th>Bloc</Th>
                  <Th className="text-center">Barème</Th>
                  <Th className="text-center">Coefficient</Th>
                  <Th className="text-center">Actif</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((s) => {
                  const d = drafts[s.id];
                  if (!d) return null;
                  return (
                    <tr key={s.id} className="hover:bg-muted/40">
                      <Td className="font-medium">{s.name}</Td>
                      <Td className="text-muted-foreground">{BLOCK_TITLES[s.block]}</Td>
                      <Td className="text-center">
                        <input
                          inputMode="decimal"
                          value={d.max}
                          onChange={(e) => patch(s.id, { max: e.target.value })}
                          aria-label={`Barème de ${s.name}`}
                          className={inputClass}
                        />
                      </Td>
                      <Td className="text-center">
                        <input
                          inputMode="decimal"
                          value={d.coef}
                          onChange={(e) => patch(s.id, { coef: e.target.value })}
                          aria-label={`Coefficient de ${s.name}`}
                          className={inputClass}
                        />
                      </Td>
                      <Td className="text-center">
                        <input
                          type="checkbox"
                          checked={d.active}
                          onChange={(e) => patch(s.id, { active: e.target.checked })}
                          aria-label={`${s.name} actif`}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          </section>
        );
      })}

      <div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {save.isPending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </div>
    </div>
  );
}
