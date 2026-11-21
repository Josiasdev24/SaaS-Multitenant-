import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, X, LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { navFor } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/roles";
import { initials } from "@/lib/format";
import { GlobalSearch } from "@/components/global-search";
import { Logo } from "@/components/logo";
import { BackupReminder } from "@/components/backup-reminder";
import { ChangePasswordButton } from "@/components/change-password-button";
import { PrintButton, PrintLetterhead, PrintStyles } from "@/components/print-chrome";
import { switchSchool, type CurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const items = navFor(user.role, user.permissions);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="h-1.5 bg-brand-red" />
      <div className="h-0.5 bg-brand-sky" />
      <div className="flex items-center gap-3 border-b border-primary-foreground/20 px-4 py-4">
        <Logo
          className="h-11 w-11 border border-primary-foreground/30"
          initialsClassName="text-[11px]"
          name={user.school?.name ?? null}
          logoPath={user.school?.logo_path ?? null}
        />
        <div className="min-w-0">
          <div className="font-serif text-[17px] leading-tight text-primary-foreground">
            {user.school?.short_name || user.school?.name || "Établissement"}
          </div>
          {user.memberships.length > 1 ? (
            <select
              aria-label="Changer d'école"
              value={user.school?.id ?? ""}
              onChange={(e) => switchSchool(e.target.value)}
              className="mt-1 max-w-full rounded bg-primary-foreground/10 px-1 py-0.5 text-[11px] text-primary-foreground"
            >
              {user.memberships.map((m) => (
                <option key={m.school_id} value={m.school_id} className="text-foreground">
                  {m.school.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {items.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center rounded-md border-l-4 px-3 py-2 text-[13px] transition-colors",
                active
                  ? "border-brand-red bg-primary-foreground font-medium text-primary"
                  : "border-transparent text-primary-foreground/80 hover:bg-brand-sky/25 hover:text-primary-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-primary-foreground/20 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-sky text-[11px] font-semibold text-brand-sky-foreground">
            {initials(user.fullName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-primary-foreground">{user.fullName}</span>
            <span className="block truncate text-[11px] text-primary-foreground/65">
              {user.role ? ROLE_LABELS[user.role] : "Sans rôle"}
            </span>
          </span>
          <button
            type="button"
            onClick={signOut}
            aria-label="Se déconnecter"
            className="rounded-md p-2 text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <ChangePasswordButton className="mt-1 w-full px-4 pb-3 text-left text-[11px] text-primary-foreground/60 underline" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PrintStyles />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-primary bg-primary lg:block print:hidden">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-primary bg-primary">
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-3 rounded-md p-2 text-primary-foreground/80 hover:bg-primary-foreground/10"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-60 print:pl-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b-[3px] border-brand-red bg-background/90 px-4 py-3 backdrop-blur md:px-6 print:hidden">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            onClick={() => setOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <GlobalSearch permissions={user.permissions} />
          <PrintButton />
        </header>
        <main className="mx-auto max-w-[1240px] space-y-8 px-4 py-6 md:px-6 md:py-8">
          <PrintLetterhead userName={user.fullName} />
          {user.role === "admin" ? <BackupReminder /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
