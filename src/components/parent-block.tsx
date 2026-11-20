import { useMemo, useState } from "react";

import { RELATIONSHIPS, fromRow, searchParents, type ParentForm, type ParentRow } from "@/lib/families";

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50 disabled:bg-muted/50";

/**
 * Bloc de saisie d'un parent ou tuteur (modèle de la fiche d'inscription).
 * On peut aussi retrouver un parent déjà enregistré (frère ou sœur déjà inscrit) pour le lier sans le ressaisir.
 */
export function ParentBlock({
  title,
  hint,
  required,
  value,
  onChange,
  directory,
  idPrefix,
}: {
  title: string;
  hint?: string | undefined;
  required: boolean;
  value: ParentForm;
  onChange: (next: ParentForm) => void;
  directory: ParentRow[];
  idPrefix: string;
}) {
  const [search, setSearch] = useState("");
  const matches = useMemo(() => searchParents(directory, search), [directory, search]);
  const locked = value.existingId !== null;

  const set = (key: keyof ParentForm, v: string) => onChange({ ...value, [key]: v });

  const field = (key: keyof ParentForm, label: string, opts: { required?: boolean; type?: string; wide?: boolean } = {}) => (
    <div className={opts.wide ? "md:col-span-2" : ""}>
      <label htmlFor={`${idPrefix}-${key}`} className="label-caps">
        {label}
        {opts.required ? <span className="text-late"> *</span> : null}
      </label>
      <input
        id={`${idPrefix}-${key}`}
        type={opts.type ?? "text"}
        value={String(value[key] ?? "")}
        disabled={locked}
        onChange={(e) => set(key, e.target.value)}
        className={inputClass}
      />
    </div>
  );

  return (
    <fieldset className="rounded-lg border border-border bg-card p-4">
      <legend className="px-1 text-[13px] font-semibold text-primary">
        {title}
        {required ? <span className="text-late"> *</span> : <span className="font-normal text-muted-foreground"> (facultatif)</span>}
      </legend>
      {hint ? <p className="mb-3 text-[12px] text-muted-foreground">{hint}</p> : null}

      {locked ? (
        <p className="mb-3 rounded-md bg-secondary px-3 py-2 text-[12px]">
          Parent déjà enregistré : il sera simplement lié à cet élève, sans être modifié.{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => onChange({ ...value, existingId: null })}
          >
            Saisir un autre parent
          </button>
        </p>
      ) : directory.length > 0 ? (
        <div className="mb-3">
          <label htmlFor={`${idPrefix}-search`} className="label-caps">
            Déjà enregistré ? Chercher par nom ou téléphone
          </label>
          <input
            id={`${idPrefix}-search`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Utile quand un frère ou une sœur est déjà inscrit"
            className={inputClass}
            autoComplete="off"
          />
          {matches.length > 0 ? (
            <ul className="mt-1.5 divide-y divide-border overflow-hidden rounded-md border border-border bg-card text-[13px] shadow-sm">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      onChange(fromRow(p, value.relationship));
                      setSearch("");
                    }}
                  >
                    <span className="font-medium">
                      {p.last_name} {p.first_name}
                    </span>
                    <span className="text-[12px] text-muted-foreground">{p.phone ?? "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {field("last_name", "Nom", { required })}
        {field("first_name", "Prénoms", { required })}
        <div>
          <label htmlFor={`${idPrefix}-relationship`} className="label-caps">
            Lien avec l'enfant{required ? <span className="text-late"> *</span> : null}
          </label>
          <input
            id={`${idPrefix}-relationship`}
            list={`${idPrefix}-relations`}
            value={value.relationship}
            onChange={(e) => set("relationship", e.target.value)}
            className={inputClass}
            placeholder="Père, mère, tuteur…"
          />
          <datalist id={`${idPrefix}-relations`}>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        {field("profession", "Profession")}
        {field("phone", "Téléphone", { required })}
        {field("email", "Email", { type: "email" })}
        {field("address", "Adresse", { wide: true })}
      </div>
    </fieldset>
  );
}
