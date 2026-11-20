import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { createAccounts, type AccountResult } from "@/lib/platform.functions";
import { ChangePasswordButton } from "@/components/change-password-button";

export const Route = createFileRoute("/plateforme")({
  ssr: false,
  head: () => ({ meta: [{ title: "Plateforme" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: PlatformPage,
});

// Appels aux fonctions de la base non encore présentes dans les types générés.
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

type SchoolRow = { id: string; slug: string; name: string; city: string | null; status: string; members: number };
type MemberRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  status: string;
  cycles: string[];
};

const ROLE_FR: Record<string, string> = {
  founder: "Fondateur",
  director: "Directeur",
  secretary: "Secrétaire",
  teacher: "Enseignant",
  primary: "Primaire",
};

const ROLE_INPUT: Record<string, string> = {
  fondateur: "founder",
  directeur: "director",
  directrice: "director",
  secretaire: "secretary",
  secrétaire: "secretary",
  enseignant: "teacher",
  professeur: "teacher",
  primaire: "primary",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const input =
  "h-10 w-full rounded-md border border-border bg-card px-3 text-[14px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20";
const btn =
  "h-10 rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const btnGhost = "h-9 rounded-md border border-border px-3 text-[13px] hover:bg-muted";

function PlatformPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const superQ = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data } = await rpc("is_super_admin");
      return data === true;
    },
  });

  const schoolsQ = useQuery({
    queryKey: ["platform-schools"],
    enabled: superQ.data === true,
    queryFn: async () => {
      const { data, error } = await rpc("admin_list_schools");
      if (error) throw new Error(error.message);
      return (data ?? []) as SchoolRow[];
    },
  });

  if (superQ.isPending) return <div className="p-8 text-[14px]">Chargement…</div>;
  if (!superQ.data) {
    return (
      <div className="p-8 text-[14px]">
        <p className="font-medium">Accès refusé.</p>
        <p className="mt-2 text-muted-foreground">Cet espace est réservé au super-administrateur de la plateforme.</p>
      </div>
    );
  }

  const schools = schoolsQ.data ?? [];
  const current = schools.find((s) => s.id === selected) ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-[26px] tracking-tight text-brand-blue">Plateforme — écoles</h1>
        <div className="flex gap-2">
          <ChangePasswordButton className={btnGhost} />
          <button
            className={btnGhost}
            onClick={() => supabase.auth.signOut().then(() => window.location.assign("/auth"))}
          >
            Se déconnecter
          </button>
        </div>
      </header>

      <CreateSchool
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["platform-schools"] });
          setSelected(id);
        }}
      />

      <section>
        <h2 className="mb-3 text-[16px] font-medium">Écoles ({schools.length})</h2>
        {schools.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Aucune école pour l'instant. Créez la première ci-dessus.</p>
        ) : (
          <ul className="divide-y rounded-md border border-border">
            {schools.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[14px]">
                <div>
                  <span className="font-medium">{s.name}</span>{" "}
                  <span className="text-muted-foreground">
                    · {s.slug} · {s.members} compte(s) · {s.status === "active" ? "active" : "suspendue"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className={btnGhost} onClick={() => setSelected(s.id === selected ? null : s.id)}>
                    {s.id === selected ? "Fermer" : "Gérer"}
                  </button>
                  <StatusButton school={s} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {current ? <SchoolPanel school={current} /> : null}
    </div>
  );
}

function StatusButton({ school }: { school: SchoolRow }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async () => {
      const next = school.status === "active" ? "suspended" : "active";
      if (next === "suspended" && !window.confirm(`Suspendre « ${school.name} » ? Plus personne de cette école ne pourra se connecter.`)) return;
      const { error } = await rpc("admin_set_school_status", { p_school: school.id, p_status: next });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-schools"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <button className={btnGhost} onClick={() => m.mutate()} disabled={m.isPending}>
      {school.status === "active" ? "Suspendre" : "Réactiver"}
    </button>
  );
}

function CreateSchool({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const effectiveSlug = touched ? slug : slugify(name);

  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await rpc("create_school", { p_name: name, p_slug: effectiveSlug });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: (id) => {
      toast.success("École créée (cycles : Jardin, Primaire, Collège, Lycée).");
      setName("");
      setSlug("");
      setTouched(false);
      onCreated(id);
    },
    onError: (e: Error) => toast.error("Création impossible", { description: e.message }),
  });

  return (
    <section className="rounded-md border border-border p-4">
      <h2 className="mb-3 text-[16px] font-medium">Nouvelle école</h2>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <input className={input} placeholder="Nom de l'école" required value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className={input}
          placeholder="Identifiant court (ex. csoa)"
          required
          pattern="[a-z0-9][a-z0-9\-]{1,62}"
          value={effectiveSlug}
          onChange={(e) => {
            setTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
        />
        <button className={btn} disabled={m.isPending}>
          {m.isPending ? "Création…" : "Créer"}
        </button>
      </form>
    </section>
  );
}

function parseLines(text: string): { accounts: { email: string; fullName: string; role: string; cycleCodes: string[] }[]; errors: string[] } {
  const accounts: { email: string; fullName: string; role: string; cycleCodes: string[] }[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const parts = line.split(/[;\t]/).map((p) => p.trim());
      const [email, fullName, roleRaw, cyclesRaw] = parts;
      const role = ROLE_INPUT[(roleRaw ?? "").toLowerCase()];
      if (!email || !fullName || !role) {
        errors.push(`Ligne ${i + 1} : « ${line} » — format attendu : e-mail ; NOM Prénom ; rôle ; cycles`);
        return;
      }
      const cycleCodes = (cyclesRaw ?? "")
        .split(/[,+/ ]+/)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      accounts.push({ email, fullName, role, cycleCodes });
    });
  return { accounts, errors };
}

function SchoolPanel({ school }: { school: SchoolRow }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [results, setResults] = useState<AccountResult[] | null>(null);

  const membersQ = useQuery({
    queryKey: ["platform-members", school.id],
    queryFn: async () => {
      const { data, error } = await rpc("admin_list_members", { p_school: school.id });
      if (error) throw new Error(error.message);
      return (data ?? []) as MemberRow[];
    },
  });

  const parsed = useMemo(() => parseLines(text), [text]);

  const create = useMutation({
    mutationFn: async () => createAccounts({ data: { schoolId: school.id, accounts: parsed.accounts } }),
    onSuccess: (r) => {
      setResults(r);
      setText("");
      qc.invalidateQueries({ queryKey: ["platform-members", school.id] });
      qc.invalidateQueries({ queryKey: ["platform-schools"] });
    },
    onError: (e: Error) => toast.error("Création impossible", { description: e.message }),
  });

  const toggle = useMutation({
    mutationFn: async (m: MemberRow) => {
      const { error } = await rpc("admin_set_member_status", {
        p_school: school.id,
        p_user: m.user_id,
        p_status: m.status === "active" ? "disabled" : "active",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-members", school.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function downloadCsv() {
    if (!results) return;
    const rows = ["e-mail;nom;rôle;mot de passe provisoire;résultat"].concat(
      results.map((r) => [r.email, r.fullName, ROLE_FR[r.role] ?? r.role, r.password ?? "", r.message].join(";")),
    );
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `comptes-${school.slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="space-y-5 rounded-md border border-border p-4">
      <h2 className="text-[18px] font-medium">{school.name}</h2>

      <div>
        <h3 className="mb-2 text-[14px] font-medium">Comptes de l'école</h3>
        {membersQ.data && membersQ.data.length > 0 ? (
          <ul className="divide-y rounded-md border border-border text-[13px]">
            {membersQ.data.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-medium">{m.full_name || m.email}</span>{" "}
                  <span className="text-muted-foreground">
                    · {m.email} · {ROLE_FR[m.role] ?? m.role}
                    {m.cycles.length ? ` · ${m.cycles.join(", ")}` : ""}
                    {m.status === "disabled" ? " · désactivé" : ""}
                  </span>
                </span>
                <button className={btnGhost} onClick={() => toggle.mutate(m)}>
                  {m.status === "active" ? "Désactiver" : "Réactiver"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Aucun compte pour l'instant.</p>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-[14px] font-medium">Ajouter des comptes</h3>
        <p className="mb-2 text-[12px] text-muted-foreground">
          Une ligne par personne : <code>e-mail ; NOM Prénom ; rôle ; cycles</code>. Rôles : fondateur, directeur,
          secrétaire, enseignant, primaire. Cycles (directeur, primaire) : jardin, primaire, college, lycee, séparés par
          « + ». Sans cycle, un directeur voit tous les cycles. Vous pouvez coller des lignes depuis Excel.
        </p>
        <textarea
          className={input + " h-36 py-2 font-mono text-[12px]"}
          placeholder={"fondateur@ecole.tg ; ADJOVI Kossi ; fondateur\ndirecteur.college@ecole.tg ; AGBO Ama ; directeur ; college"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {parsed.errors.map((er) => (
          <p key={er} className="mt-1 text-[12px] text-red-600">
            {er}
          </p>
        ))}
        <button
          className={btn + " mt-3"}
          disabled={create.isPending || parsed.accounts.length === 0 || parsed.errors.length > 0}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Création…" : `Créer ${parsed.accounts.length} compte(s)`}
        </button>
      </div>

      {results ? (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-[13px] text-foreground">
          <p className="font-medium">Mots de passe provisoires — notez-les maintenant, ils ne seront plus affichés.</p>
          <ul className="mt-2 space-y-1">
            {results.map((r) => (
              <li key={r.email} className={r.ok ? "" : "text-red-700"}>
                {r.email} — {ROLE_FR[r.role] ?? r.role} —{" "}
                {r.ok ? (r.password ? <code className="font-mono font-semibold">{r.password}</code> : r.message) : r.message}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button className={btnGhost} onClick={downloadCsv}>
              Télécharger la liste (CSV)
            </button>
            <button className={btnGhost} onClick={() => setResults(null)}>
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
