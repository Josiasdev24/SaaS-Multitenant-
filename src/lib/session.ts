import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { getActiveSchoolId, setActiveSchoolId } from "./active-school";
import { permissionsFor, type AppRole, type Permissions } from "./roles";

/** Fiche de l'école (renvoyée par my_memberships). */
export type SchoolInfo = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  logo_path: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  country: string;
  currency: string;
  primary_color: string | null;
  accent_color: string | null;
  header_lines: string[];
  absence_threshold: number;
  secretary_can_collect: boolean;
  current_academic_year_id: string | null;
};

export type Membership = {
  school_id: string;
  role: "founder" | "director" | "secretary" | "teacher" | "primary";
  is_supervisor: boolean;
  teacher_id: string | null;
  cycle_ids: string[];
  school: SchoolInfo;
};

export type CurrentUser = {
  userId: string;
  email: string;
  fullName: string;
  teacherId: string | null;
  role: AppRole | null;
  permissions: Permissions;
  school: SchoolInfo | null;
  cycleIds: string[];
  isSupervisor: boolean;
  /** Toutes les écoles du compte (sélecteur si plus d'une). */
  memberships: Membership[];
};

/** Rôles de la base -> rôles de l'application. */
const ROLE_MAP: Record<Membership["role"], AppRole> = {
  founder: "admin",
  director: "direction",
  secretary: "comptabilite",
  teacher: "enseignant",
  primary: "primaire",
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Déconnexion : on oublie l'école active (elle sera redécouverte à la prochaine connexion).
      if (event === "SIGNED_OUT") setActiveSchoolId(null);
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, ready };
}

/** Liste des écoles du compte. Appelée SANS école active : la base renvoie toutes les écoles. */
async function loadMemberships(): Promise<Membership[]> {
  const previous = getActiveSchoolId();
  setActiveSchoolId(null);
  try {
    const { data, error } = await (supabase as unknown as {
      rpc: (fn: string) => Promise<{ data: Membership[] | null; error: { message: string } | null }>;
    }).rpc("my_memberships");
    if (error) throw new Error(error.message);
    return data ?? [];
  } finally {
    setActiveSchoolId(previous);
  }
}

/** Change d'école active (sélecteur) puis recharge l'application. */
export function switchSchool(schoolId: string) {
  setActiveSchoolId(schoolId);
  window.location.assign("/");
}

/** Charge le profil, l'école et le rôle de l'utilisateur connecté. */
export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["current-user"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;

      const memberships = await loadMemberships();

      // École active : celle mémorisée si le compte en est encore membre, sinon la première.
      const stored = getActiveSchoolId();
      const current = memberships.find((m) => m.school_id === stored) ?? memberships[0] ?? null;
      setActiveSchoolId(current?.school_id ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      const role = current ? ROLE_MAP[current.role] : null;
      return {
        userId: user.id,
        email: profile?.email ?? user.email ?? "",
        fullName: profile?.full_name || user.email || "Utilisateur",
        teacherId: current?.teacher_id ?? null,
        role,
        permissions: permissionsFor(role, { secretaryCanCollect: current?.school.secretary_can_collect ?? false }),
        school: current?.school ?? null,
        cycleIds: current?.cycle_ids ?? [],
        isSupervisor: current?.is_supervisor ?? false,
        memberships,
      };
    },
  });
}
