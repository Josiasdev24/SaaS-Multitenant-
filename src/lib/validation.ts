import { z } from "zod";

/**
 * Schémas de validation centralisés pour les formulaires de saisie.
 * Chaque schéma reçoit un objet simple (déjà extrait d'un FormData) et
 * renvoie soit les données normalisées, soit lève une erreur avec un
 * message français lisible (premier message d'erreur Zod), à afficher
 * tel quel dans un toast.
 */

function firstIssueMessage(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(firstIssueMessage(result.error));
  return result.data;
}

/** Convertit une valeur de FormData en chaîne "nettoyée", ou undefined si vide. */
export function optionalString(value: FormDataEntryValue | null): string | undefined {
  const s = String(value ?? "").trim();
  return s === "" ? undefined : s;
}

const requiredMsg = (field: string) => `${field} est obligatoire.`;

/* ------------------------------------------------------------- élèves */

export const studentSchema = z.object({
  matricule: z
    .string({ required_error: requiredMsg("Le matricule") })
    .trim()
    .min(1, requiredMsg("Le matricule")),
  first_name: z
    .string({ required_error: requiredMsg("Le prénom") })
    .trim()
    .min(1, requiredMsg("Le prénom")),
  last_name: z
    .string({ required_error: requiredMsg("Le nom") })
    .trim()
    .min(1, requiredMsg("Le nom")),
  gender: z.enum(["M", "F"], { errorMap: () => ({ message: "Sexe invalide." }) }),
  birth_date: z.string().optional(),
  birth_place: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  class_id: z.string().min(1, "Sélectionnez une classe."),
});

/* ------------------------------------------------------------- classes */

export const classSchema = z.object({
  name: z
    .string({ required_error: requiredMsg("Le nom de la classe") })
    .trim()
    .min(1, requiredMsg("Le nom de la classe")),
  level_id: z.string().min(1, "Sélectionnez un niveau."),
  capacity: z
    .number({ invalid_type_error: "Capacité invalide." })
    .int("Capacité invalide.")
    .positive("La capacité doit être supérieure à 0.")
    .nullable()
    .optional(),
  main_teacher_id: z.string().optional(),
});

/* --------------------------------------------------------- enseignants */

export const teacherSchema = z.object({
  first_name: z
    .string({ required_error: requiredMsg("Le prénom") })
    .trim()
    .min(1, requiredMsg("Le prénom")),
  last_name: z
    .string({ required_error: requiredMsg("Le nom") })
    .trim()
    .min(1, requiredMsg("Le nom")),
  phone: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Adresse email invalide."),
  status: z.enum(["actif", "conge", "inactif"]).default("actif"),
  hire_date: z.string().optional(),
});

/* ------------------------------------------------------------ matières */

export const subjectSchema = z.object({
  name: z
    .string({ required_error: requiredMsg("L'intitulé") })
    .trim()
    .min(1, requiredMsg("L'intitulé")),
  code: z
    .string({ required_error: requiredMsg("Le code") })
    .trim()
    .min(1, requiredMsg("Le code"))
    .transform((v) => v.toUpperCase()),
  default_coefficient: z
    .number({ invalid_type_error: "Coefficient invalide." })
    .positive("Le coefficient doit être supérieur à 0."),
});

/* -------------------------------------------------------------- notes */

export const gradeEntrySchema = z.object({
  student_id: z.string().min(1),
  score: z.number({ invalid_type_error: "Note invalide." }),
});

export function gradeInRangeSchema(maxScore: number) {
  return gradeEntrySchema.extend({
    score: z
      .number({ invalid_type_error: "Note invalide." })
      .min(0, `Note hors barème (0 à ${maxScore}).`)
      .max(maxScore, `Note hors barème (0 à ${maxScore}).`),
  });
}

export const evaluationSchema = z.object({
  title: z
    .string({ required_error: requiredMsg("L'intitulé") })
    .trim()
    .min(1, requiredMsg("L'intitulé")),
  eval_date: z.string().min(1, requiredMsg("La date")),
  max_score: z
    .number({ invalid_type_error: "Barème invalide." })
    .positive("Le barème doit être supérieur à 0."),
});

/* ------------------------------------------------------------- parents */

export const parentSchema = z.object({
  first_name: z
    .string({ required_error: requiredMsg("Le prénom") })
    .trim()
    .min(1, requiredMsg("Le prénom")),
  last_name: z
    .string({ required_error: requiredMsg("Le nom") })
    .trim()
    .min(1, requiredMsg("Le nom")),
  phone: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Adresse email invalide."),
  address: z.string().optional(),
  profession: z.string().optional(),
});

/* ------------------------------------------------------------- écolage */

export const paymentSchema = z.object({
  student_id: z.string().min(1, "Sélectionnez un élève."),
  student_fee_id: z.string().optional(),
  amount: z
    .number({ invalid_type_error: "Montant invalide." })
    .positive("Le montant doit être supérieur à 0."),
  paid_at: z.string().min(1, requiredMsg("La date")),
  method: z.string().min(1),
  receipt_number: z.string().optional(),
  note: z.string().optional(),
});

/**
 * Premier numéro de reçu utilisé quand aucun reçu numérique n'existe encore.
 * Le reçu papier du client est numéroté en continu (ex. 0001001) : pour reprendre
 * exactement la suite du carnet papier, saisir manuellement le premier numéro dans
 * le champ « N° reçu » du formulaire de paiement — les suivants s'incrémentent seuls.
 */
export const RECEIPT_START_NUMBER = 1001;

/** Génère le prochain numéro de reçu : numérique, sur 7 chiffres, en continu (ex. 0001001). */
export function generateReceiptNumber(existingReceipts: string[]): string {
  const numbers = existingReceipts.filter((r) => /^\d+$/.test(r)).map(Number);
  const next = numbers.length ? Math.max(...numbers) + 1 : RECEIPT_START_NUMBER;
  return String(next).padStart(7, "0");
}

/* ------------------------------------------------------- import en masse */

/** Normalise une valeur de sexe libre (M, F, Masculin, Garçon, Fille...) vers "M" | "F". */
export function normalizeGender(raw: string): "M" | "F" | null {
  const v = raw.trim().toLowerCase();
  if (["m", "masculin", "garcon", "garçon", "homme", "h"].includes(v)) return "M";
  if (["f", "feminin", "féminin", "fille", "femme"].includes(v)) return "F";
  return null;
}

/**
 * Sépare un nom complet "NOM Prénom(s)" (convention des listes scolaires togolaises,
 * nom de famille en premier) en { last_name, first_name }. À défaut de convention
 * claire (un seul mot), tout part dans last_name.
 */
export function splitFullName(raw: string): { last_name: string; first_name: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { last_name: parts[0] ?? "", first_name: "" };
  return { last_name: parts[0] ?? "", first_name: parts.slice(1).join(" ") };
}

/** Génère un matricule unique séquentiel "ELV-{année}-{séquence sur 4 chiffres}". */
export function generateImportMatricule(
  year: string,
  index: number,
  existing: Set<string>,
): string {
  const prefix = `ELV-${year}-`;
  let seq = index;
  let candidate = `${prefix}${String(seq).padStart(4, "0")}`;
  while (existing.has(candidate)) {
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(4, "0")}`;
  }
  existing.add(candidate);
  return candidate;
}
