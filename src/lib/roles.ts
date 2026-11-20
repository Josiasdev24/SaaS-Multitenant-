export type AppRole = "admin" | "direction" | "comptabilite" | "enseignant" | "primaire";

/** Noms affichés dans l'application pour les accès. */
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Fondateur",
  direction: "Directeur",
  comptabilite: "Secrétaire",
  enseignant: "Professeur",
  primaire: "Professeur du primaire",
};

/**
 * Périmètre des données visibles :
 * - all : toute l'école ;
 * - college : tout le collège, mais ni le Jardin ni le primaire (le Directeur, directeur du collège) ;
 * - primary : uniquement le Jardin et le primaire (compte partagé par les enseignants du primaire) ;
 * - own : uniquement les matières (et les classes) que l'enseignant du collège enseigne.
 */
export type Scope = "all" | "college" | "primary" | "own";

/** Permissions dérivées du rôle. Point unique d'extension (parent, élève…). */
export type Permissions = {
  viewAcademics: boolean; // notes, évaluations, bulletins
  editAcademics: boolean;
  viewAttendance: boolean;
  editAttendance: boolean;
  viewFinance: boolean; // écolage, paiements
  editFinance: boolean;
  viewFamilies: boolean; // coordonnées parents/tuteurs
  manageStructure: boolean; // classes, matières, enseignants, paramètres
  ownClassesOnly: boolean;
  scope: Scope;
};

export type PermissionOptions = {
  /** Réglage du fondateur : la secrétaire peut-elle encaisser les paiements ? */
  secretaryCanCollect?: boolean;
};

export function permissionsFor(role: AppRole | null, options: PermissionOptions = {}): Permissions {
  switch (role) {
    // Fondateur : accès à tout.
    case "admin":
      return {
        viewAcademics: true,
        editAcademics: true,
        viewAttendance: true,
        editAttendance: true,
        viewFinance: true,
        editFinance: true,
        viewFamilies: true,
        manageStructure: true,
        ownClassesOnly: false,
        scope: "all",
      };
    // Directeur : son(ses) cycle(s) seulement ; l'étendue exacte est imposée par la base (RLS).
    // Il voit l'écolage de son cycle (lecture), sans encaisser.
    case "direction":
      return {
        viewAcademics: true,
        editAcademics: true,
        viewAttendance: true,
        editAttendance: true,
        viewFinance: true,
        editFinance: false,
        viewFamilies: true,
        manageStructure: true,
        ownClassesOnly: false,
        scope: "all",
      };
    // Secrétaire : accès à tout (toute l'école) SAUF aux finances, tant que le fondateur
    // ne l'autorise pas à encaisser (réglage « La secrétaire peut encaisser les paiements »).
    case "comptabilite": {
      const collect = Boolean(options.secretaryCanCollect);
      return {
        viewAcademics: true,
        editAcademics: true,
        viewAttendance: true,
        editAttendance: true,
        viewFinance: collect,
        editFinance: collect,
        viewFamilies: true,
        manageStructure: true,
        ownClassesOnly: false,
        scope: "all",
      };
    }
    // Professeur du collège : compte personnel, limité à ses matières et à ses classes.
    case "enseignant":
      return {
        viewAcademics: true,
        editAcademics: true,
        viewAttendance: true,
        editAttendance: true,
        viewFinance: false,
        editFinance: false,
        viewFamilies: false,
        manageStructure: false,
        ownClassesOnly: false,
        scope: "own",
      };
    // Professeur du primaire : un compte partagé, limité au Jardin et au primaire.
    case "primaire":
      return {
        viewAcademics: true,
        editAcademics: true,
        viewAttendance: true,
        editAttendance: true,
        viewFinance: false,
        editFinance: false,
        viewFamilies: false,
        manageStructure: false,
        ownClassesOnly: false,
        scope: "primary",
      };
    default:
      return {
        viewAcademics: false,
        editAcademics: false,
        viewAttendance: false,
        editAttendance: false,
        viewFinance: false,
        editFinance: false,
        viewFamilies: false,
        manageStructure: false,
        ownClassesOnly: true,
        scope: "own",
      };
  }
}
