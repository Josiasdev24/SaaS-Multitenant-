import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion" },
      {
        name: "description",
        content:
          "Espace réservé au personnel des établissements : fondateurs, direction, secrétariat et enseignants.",
      },
      { property: "og:title", content: "Connexion" },
      {
        property: "og:description",
        content: "Espace réservé au personnel de l'établissement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Connexion impossible", { description: error.message });
      return;
    }
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Panneau bleu : identité de l'établissement */}
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Logo className="mx-auto h-[132px] w-[132px] border-4 border-primary-foreground/25" initialsClassName="text-2xl" />
        <div className="max-w-md">
          <div className="h-1 w-14 bg-brand-red" />
          <h1 className="mt-5 font-serif text-[38px] leading-[1.08] tracking-tight">
            Gestion scolaire
            <br />
            en ligne
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-primary-foreground/80">
            Élèves, notes, bulletins et écolage, pour chaque établissement.
          </p>
        </div>
        <p className="font-serif text-[15px] italic text-primary-foreground/80">
          Connectez-vous : vous serez dirigé vers votre établissement.
        </p>
      </div>

      <div className="flex items-center justify-center bg-card px-5 py-12">
        <div className="w-full max-w-sm">
          <Logo className="mx-auto mb-6 h-24 w-24 border-2 border-border lg:hidden" initialsClassName="text-base" />
          <h2 className="font-serif text-[26px] tracking-tight text-brand-blue">Connexion</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Les comptes sont créés par l'administration. Aucun nom d'école à saisir.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="email" className="label-caps">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-[14px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div>
              <label htmlFor="password" className="label-caps">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-[14px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="h-10 w-full rounded-md bg-primary text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
