import { useMemo, useState } from "react";

import { fullName, type SchoolClass, type Student } from "@/lib/data";
import { searchStudents } from "@/lib/student-search";

const inputClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50";

/**
 * Recherche d'un élève par nom ou matricule, avec liste de choix.
 * Au clavier : flèches haut/bas pour choisir, Entrée pour valider, Échap pour fermer.
 */
export function StudentPicker({
  students,
  classes,
  search,
  onSearchChange,
  picked,
  onPick,
  disabledIds,
  disabledLabel = "déjà dans la liste",
  autoFocus = false,
}: {
  students: Student[];
  classes: SchoolClass[];
  search: string;
  onSearchChange: (value: string) => void;
  picked: Student | null;
  onPick: (student: Student | null) => void;
  disabledIds?: ReadonlySet<string> | undefined;
  disabledLabel?: string;
  autoFocus?: boolean;
}) {
  const [active, setActive] = useState(0);

  const className = (classId: string | null) =>
    classes.find((c) => c.id === classId)?.name ?? "—";

  const matches = useMemo(() => searchStudents(students, search, 8), [students, search]);
  const isDisabled = (s: Student) => Boolean(disabledIds?.has(s.id));

  function choose(s: Student) {
    if (isDisabled(s)) return;
    onPick(s);
    onSearchChange(fullName(s));
  }

  return (
    <div className="max-w-md">
      <label htmlFor="student-search" className="label-caps">
        Élève (nom ou matricule)
      </label>
      <input
        id="student-search"
        value={search}
        onChange={(e) => {
          onSearchChange(e.target.value);
          onPick(null);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (picked || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const s = matches[Math.min(active, matches.length - 1)];
            if (s) choose(s);
          } else if (e.key === "Escape") {
            onSearchChange("");
          }
        }}
        placeholder="Tapez le nom ou le matricule (2 lettres suffisent)"
        className={inputClass}
        autoComplete="off"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
      />
      {!picked && matches.length > 0 ? (
        <ul
          role="listbox"
          className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border bg-card text-[13px] shadow-sm"
        >
          {matches.map((s, i) => {
            const disabled = isDisabled(s);
            return (
              <li key={s.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => choose(s)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left disabled:opacity-50 ${
                    i === active ? "bg-secondary" : "hover:bg-muted"
                  }`}
                >
                  <span className="font-medium">{fullName(s)}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {className(s.class_id)} · {s.matricule}
                    {disabled ? ` · ${disabledLabel}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {!picked && search.trim().length >= 2 && matches.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted-foreground">Aucun élève trouvé.</p>
      ) : null}
      {picked ? (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Élève choisi : <span className="font-medium">{fullName(picked)}</span> (
          {className(picked.class_id)}) ·{" "}
          <button
            type="button"
            onClick={() => {
              onPick(null);
              onSearchChange("");
            }}
            className="text-primary hover:underline"
          >
            changer
          </button>
        </p>
      ) : null}
    </div>
  );
}
