import type { AppRole, Permissions } from "./roles";

export type NavItem = {
  label: string;
  to: string;
  roles: AppRole[];
  /** Permission requise en plus du rôle (ex. la secrétaire n'a la finance que si le fondateur l'autorise). */
  needs?: keyof Permissions;
};

const FINANCE_ROLES: AppRole[] = ["admin", "comptabilite"];

export const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", to: "/", roles: ["admin", "direction", "comptabilite", "enseignant", "primaire"] },
  { label: "Élèves", to: "/eleves", roles: ["admin", "direction", "comptabilite", "enseignant", "primaire"] },
  { label: "Classes", to: "/classes", roles: ["admin", "direction", "comptabilite", "enseignant", "primaire"] },
  { label: "Enseignants", to: "/enseignants", roles: ["admin", "direction", "comptabilite"] },
  { label: "Matières", to: "/matieres", roles: ["admin", "direction", "comptabilite"] },
  { label: "Notes", to: "/notes", roles: ["admin", "direction", "comptabilite", "enseignant"] },
  {
    label: "Bulletins",
    to: "/bulletins",
    roles: ["admin", "direction", "comptabilite"],
    needs: "viewAcademics",
  },
  {
    label: "Bulletins primaire",
    to: "/primaire",
    roles: ["admin", "comptabilite", "primaire"],
    needs: "viewAcademics",
  },
  { label: "Absences", to: "/absences", roles: ["admin", "direction", "comptabilite", "enseignant", "primaire"] },
  { label: "Tableau financier", to: "/finances", roles: FINANCE_ROLES, needs: "viewFinance" },
  { label: "Écolage", to: "/ecolage", roles: FINANCE_ROLES, needs: "viewFinance" },
  { label: "Tontine", to: "/tontine", roles: FINANCE_ROLES, needs: "viewFinance" },
  {
    label: "Réductions familiales",
    to: "/ajustements/reductions",
    roles: FINANCE_ROLES,
    needs: "viewFinance",
  },
  { label: "Bourses", to: "/ajustements/bourses", roles: FINANCE_ROLES, needs: "viewFinance" },
  { label: "Arriérés", to: "/ajustements/arrieres", roles: FINANCE_ROLES, needs: "viewFinance" },
  { label: "Recettes", to: "/recettes", roles: FINANCE_ROLES, needs: "viewFinance" },
  { label: "Dépenses", to: "/depenses", roles: FINANCE_ROLES, needs: "viewFinance" },
  { label: "Parents", to: "/parents", roles: ["admin", "direction", "comptabilite"] },
  { label: "Rapports", to: "/rapports", roles: ["admin", "direction", "comptabilite"] },
  { label: "Alertes", to: "/alertes", roles: ["admin", "direction", "comptabilite", "enseignant", "primaire"] },
  { label: "Sauvegarde", to: "/sauvegarde", roles: ["admin"] },
  { label: "Paramètres", to: "/parametres", roles: ["admin", "direction", "comptabilite"] },
];

export function navFor(role: AppRole | null, permissions?: Permissions): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter(
    (item) =>
      item.roles.includes(role) && (!item.needs || !permissions || permissions[item.needs]),
  );
}
