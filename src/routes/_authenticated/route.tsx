import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/lib/session";
import { LoadingBlock } from "@/components/kit";
import { ChangePasswordButton } from "@/components/change-password-button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) {
    return (
      <div className="p-8">
        <LoadingBlock label="Chargement de la session…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <LoadingBlock label="Session introuvable." />
      </div>
    );
  }

  if (!user.school) {
    return (
      <div className="p-8 text-[14px]">
        <p className="font-medium">Aucun établissement n'est associé à ce compte.</p>
        <p className="mt-2 text-muted-foreground">Contactez l'administration de la plateforme.</p>
        <ChangePasswordButton className="mt-4 mr-2 rounded-md border px-3 py-1.5" />
        <button
          className="mt-4 rounded-md border px-3 py-1.5"
          onClick={() => supabase.auth.signOut().then(() => window.location.assign("/auth"))}
        >
          Se déconnecter
        </button>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}
