import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { money, moneyShort, dateFr, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/session";
import { academicMonths, monthOf } from "@/lib/months";
import { ledgerQuery, addLedgerItem, removeLedgerItem, type LedgerKind } from "@/lib/ledger";
import {
  PageHeader,
  Panel,
  Section,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  LoadingBlock,
  NoAccess,
  KpiGrid,
  Kpi,
} from "@/components/kit";

const CONFIG: Record<
  LedgerKind,
  {
    title: string;
    subtitle: string;
    addTitle: string;
    totalLabel: string;
    empty: string;
    categories: string[];
    labelPlaceholder: string;
    removeConfirm: string;
  }
> = {
  incomes: {
    title: "Recettes",
    subtitle: "Ventes et autres entrées d'argent (tricot, tissu, fournitures…). L'écolage encaissé est compté à part.",
    addTitle: "Enregistrer une recette",
    totalLabel: "Total des recettes",
    empty: "Aucune recette enregistrée pour cette période.",
    categories: ["Tricot", "Tissu", "Fournitures", "Cantine", "Autre"],
    labelPlaceholder: "Ex. vente de 5 tricots",
    removeConfirm: "Supprimer cette recette ?",
  },
  expenses: {
    title: "Dépenses",
    subtitle: "Sorties d'argent de l'établissement.",
    addTitle: "Enregistrer une dépense",
    totalLabel: "Total des dépenses",
    empty: "Aucune dépense enregistrée pour cette période.",
    categories: ["Salaires", "Fournitures", "Entretien", "Eau et électricité", "Transport", "Autre"],
    labelPlaceholder: "Ex. achat de craies",
    removeConfirm: "Supprimer cette dépense ?",
  },
};

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";
const filterClass =
  "h-9 rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";

export function LedgerPage({ kind }: { kind: LedgerKind }) {
  const cfg = CONFIG[kind];
  const { data: user } = useCurrentUser();
  const perms = user?.permissions;
  const queryClient = useQueryClient();
  const today = todayISO();
  const months = useMemo(() => academicMonths(today), [today]);

  const [month, setMonth] = useState("all");
  const [category, setCategory] = useState("all");
  const formRef = useRef<HTMLFormElement>(null);

  const items = useQuery({ ...ledgerQuery(kind), enabled: Boolean(perms?.viewFinance) });

  const rows = useMemo(
    () =>
      (items.data ?? [])
        .filter((i) => (month === "all" ? true : monthOf(i.date) === month))
        .filter((i) => (category === "all" ? true : i.category === category)),
    [items.data, month, category],
  );
  const total = rows.reduce((s, i) => s + i.amount, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items.data ?? []) {
      if (month !== "all" && monthOf(i.date) !== month) continue;
      map.set(i.category, (map.get(i.category) ?? 0) + i.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items.data, month]);

  const allCategories = useMemo(() => {
    const set = new Set<string>(cfg.categories);
    for (const i of items.data ?? []) set.add(i.category);
    return [...set];
  }, [items.data, cfg.categories]);

  const add = useMutation({
    mutationFn: async (form: FormData) => {
      const amount = Number(
        String(form.get("amount") ?? "")
          .replace(/\s/g, "")
          .replace(",", "."),
      );
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Le montant doit être supérieur à 0.");
      }
      const category = String(form.get("category") ?? "").trim();
      if (!category) throw new Error("Indiquez une catégorie.");
      const label = String(form.get("label") ?? "").trim();
      await addLedgerItem(kind, {
        date: String(form.get("date") || todayISO()),
        category,
        label: label === "" ? null : label,
        amount,
      });
    },
    onSuccess: () => {
      toast.success("Enregistré");
      formRef.current?.reset();
      queryClient.invalidateQueries({ queryKey: ["ledger", kind] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => removeLedgerItem(kind, id),
    onSuccess: () => {
      toast.success("Supprimé");
      queryClient.invalidateQueries({ queryKey: ["ledger", kind] });
    },
    onError: (e: Error) => toast.error("Suppression impossible", { description: e.message }),
  });

  if (!perms) return <LoadingBlock />;
  if (!perms.viewFinance) return <NoAccess />;
  if (items.isPending) return <LoadingBlock />;

  return (
    <div className="space-y-6 rise">
      <PageHeader title={cfg.title} subtitle={cfg.subtitle} />

      <KpiGrid>
        <Kpi
          label={cfg.totalLabel}
          value={money(total)}
          hint={month === "all" ? "toute l'année" : (months.find((m) => m.key === month)?.label ?? "")}
        />
        <Kpi label="Opérations" value={String(rows.length)} hint="selon les filtres" />
      </KpiGrid>

      {perms.editFinance ? (
        <Panel>
          <h2 className="text-[15px] font-semibold">{cfg.addTitle}</h2>
          <form
            ref={formRef}
            className="mt-4 grid gap-4 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate(new FormData(e.currentTarget));
            }}
          >
            <div>
              <label htmlFor="date" className="label-caps">
                Date
              </label>
              <input id="date" name="date" type="date" defaultValue={today} className={inputClass} />
            </div>
            <div>
              <label htmlFor="category" className="label-caps">
                Catégorie
              </label>
              <input
                id="category"
                name="category"
                list="ledger-categories"
                required
                className={inputClass}
              />
              <datalist id="ledger-categories">
                {allCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="amount" className="label-caps">
                Montant (FCFA)
              </label>
              <input id="amount" name="amount" inputMode="numeric" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="label" className="label-caps">
                Description
              </label>
              <input id="label" name="label" placeholder={cfg.labelPlaceholder} className={inputClass} />
            </div>
            <div className="md:col-span-4">
              <button
                type="submit"
                disabled={add.isPending}
                className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {add.isPending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mois" className={filterClass}>
          <option value="all">Toute l'année</option>
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Catégorie"
          className={filterClass}
        >
          <option value="all">Toutes les catégories</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <TableWrap minWidth={620}>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <Th>Date</Th>
            <Th>Catégorie</Th>
            <Th>Description</Th>
            <Th className="text-right">Montant</Th>
            {perms.editFinance ? <Th className="text-right">Action</Th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <EmptyRow colSpan={perms.editFinance ? 5 : 4} label={cfg.empty} />
          ) : (
            rows.map((i) => (
              <tr key={i.id} className="hover:bg-muted/40">
                <Td className="text-muted-foreground">{dateFr(i.date)}</Td>
                <Td className="font-medium">{i.category}</Td>
                <Td className="text-muted-foreground">{i.label ?? "—"}</Td>
                <Td className="num-display text-right">
                  <span title={money(i.amount)}>{moneyShort(i.amount)}</span>
                </Td>
                {perms.editFinance ? (
                  <Td className="text-right">
                    <button
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(cfg.removeConfirm)) remove.mutate(i.id);
                      }}
                      className="text-[12px] font-medium text-destructive hover:underline disabled:opacity-60"
                    >
                      Supprimer
                    </button>
                  </Td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>

      <Section title="Par catégorie">
        <TableWrap minWidth={360}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>Catégorie</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {byCategory.length === 0 ? (
              <EmptyRow colSpan={2} label="Rien à afficher." />
            ) : (
              byCategory.map(([name, amount]) => (
                <tr key={name} className="hover:bg-muted/40">
                  <Td className="font-medium">{name}</Td>
                  <Td className="num-display text-right">{money(amount)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      </Section>
    </div>
  );
}
