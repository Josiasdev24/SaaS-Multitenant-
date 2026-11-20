import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { q, fullName } from "@/lib/data";
import type { Permissions } from "@/lib/roles";

type Hit = { kind: string; label: string; sub: string; to: string; params?: Record<string, string> };

export function GlobalSearch({ permissions }: { permissions: Permissions }) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const students = useQuery(q.students());
  const classes = useQuery(q.classes());
  const teachers = useQuery({ ...q.teachers(), enabled: permissions.manageStructure || permissions.viewFamilies });
  const parents = useQuery({ ...q.parents(), enabled: permissions.viewFamilies });

  const hits = useMemo<Hit[]>(() => {
    const t = term.trim().toLowerCase();
    if (t.length < 2) return [];
    const out: Hit[] = [];
    for (const s of students.data ?? []) {
      if (
        fullName(s).toLowerCase().includes(t) ||
        s.matricule.toLowerCase().includes(t)
      ) {
        out.push({
          kind: "Élève",
          label: fullName(s),
          sub: s.matricule,
          to: "/eleves/$studentId",
          params: { studentId: s.id },
        });
      }
    }
    for (const c of classes.data ?? []) {
      if (c.name.toLowerCase().includes(t)) {
        out.push({ kind: "Classe", label: c.name, sub: "Classe", to: "/classes/$classId", params: { classId: c.id } });
      }
    }
    for (const tt of teachers.data ?? []) {
      if (fullName(tt).toLowerCase().includes(t)) {
        out.push({ kind: "Enseignant", label: fullName(tt), sub: tt.email ?? "—", to: "/enseignants" });
      }
    }
    for (const p of parents.data ?? []) {
      if (fullName(p).toLowerCase().includes(t) || (p.phone ?? "").includes(t)) {
        out.push({ kind: "Parent", label: fullName(p), sub: p.phone ?? "—", to: "/parents" });
      }
    }
    return out.slice(0, 8);
  }, [term, students.data, classes.data, teachers.data, parents.data]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
      <input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder="Rechercher un élève, une classe, un parent…"
        aria-label="Recherche globale"
        className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-primary/50 focus:ring-2 focus:ring-ring/20"
      />
      {open && hits.length > 0 ? (
        <ul className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.label}-${i}`}>
              <button
                type="button"
                onMouseDown={() => {
                  setTerm("");
                  setOpen(false);
                  navigate({ to: h.to, params: h.params } as never);
                }}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-muted"
              >
                <span className="truncate">
                  {h.label} <span className="text-faint">· {h.sub}</span>
                </span>
                <span className="shrink-0 text-[11px] uppercase tracking-wider text-faint">{h.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
