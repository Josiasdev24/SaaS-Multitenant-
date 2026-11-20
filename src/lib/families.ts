import { supabase } from "@/integrations/supabase/client";

/**
 * Parents et tuteurs d'un élève, comme sur la fiche d'inscription de l'école :
 * nom, prénoms, lien avec l'enfant, profession, adresse, téléphone.
 */

export type ParentRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  profession: string | null;
};

export type LinkRow = {
  id: string;
  student_id: string;
  parent_id: string;
  relationship: string;
  is_primary: boolean;
};

/** Contenu d'un bloc « parent » du formulaire. existingId : parent déjà enregistré, simplement lié. */
export type ParentForm = {
  existingId: string | null;
  last_name: string;
  first_name: string;
  relationship: string;
  profession: string;
  phone: string;
  email: string;
  address: string;
};

export const RELATIONSHIPS = [
  "Père",
  "Mère",
  "Tuteur",
  "Tutrice",
  "Oncle",
  "Tante",
  "Grand-père",
  "Grand-mère",
  "Frère",
  "Sœur",
  "Autre",
];

export const emptyParent = (relationship = ""): ParentForm => ({
  existingId: null,
  last_name: "",
  first_name: "",
  relationship,
  profession: "",
  phone: "",
  email: "",
  address: "",
});

export const fromRow = (p: ParentRow, relationship: string): ParentForm => ({
  existingId: p.id,
  last_name: p.last_name,
  first_name: p.first_name,
  relationship,
  profession: p.profession ?? "",
  phone: p.phone ?? "",
  email: p.email ?? "",
  address: p.address ?? "",
});

/** Vrai si l'utilisateur a commencé à remplir ce bloc (hors lien avec l'enfant). */
export function hasContent(p: ParentForm): boolean {
  return (
    p.existingId !== null ||
    [p.last_name, p.first_name, p.profession, p.phone, p.email, p.address].some((v) => v.trim() !== "")
  );
}

const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Contrôle un bloc. Un parent déjà enregistré n'est pas revérifié.
 * required : le 1er parent doit avoir nom, prénoms, lien et téléphone.
 */
export function checkParent(p: ParentForm, label: string, required: boolean): void {
  if (p.existingId !== null) {
    if (p.relationship.trim() === "") throw new Error(`${label} : indiquez le lien avec l'enfant.`);
    return;
  }
  if (!required && !hasContent(p)) return;
  if (p.last_name.trim() === "") throw new Error(`${label} : le nom est obligatoire.`);
  if (p.first_name.trim() === "") throw new Error(`${label} : les prénoms sont obligatoires.`);
  if (p.relationship.trim() === "") throw new Error(`${label} : indiquez le lien avec l'enfant (père, mère, tuteur…).`);
  if (required && digits(p.phone).length < 8) {
    throw new Error(`${label} : un numéro de téléphone valide est obligatoire.`);
  }
  if (p.phone.trim() !== "" && digits(p.phone).length < 8) throw new Error(`${label} : numéro de téléphone invalide.`);
  const email = p.email.trim();
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${label} : adresse email invalide.`);
}

const nullable = (v: string): string | null => (v.trim() === "" ? null : v.trim());

const parentValues = (p: ParentForm) => ({
  last_name: p.last_name.trim().toUpperCase(),
  first_name: p.first_name.trim(),
  profession: nullable(p.profession),
  phone: nullable(p.phone),
  email: nullable(p.email),
  address: nullable(p.address),
});

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Enregistre le parent (s'il est nouveau) et le lie à l'élève. Renvoie l'identifiant du parent. */
export async function linkParent(studentId: string, p: ParentForm, isPrimary: boolean): Promise<string> {
  let parentId = p.existingId;
  if (parentId === null) {
    const { data, error } = await supabase.from("parents").insert(parentValues(p) as never).select("id").single();
    fail(error);
    parentId = String((data as { id: string }).id);
  }
  const { error } = await supabase
    .from("student_parents")
    .upsert(
      { student_id: studentId, parent_id: parentId, relationship: p.relationship.trim(), is_primary: isPrimary } as never,
      { onConflict: "student_id,parent_id" },
    );
  fail(error);
  return parentId;
}

/** Modifie les coordonnées du parent et son lien avec cet élève. */
export async function updateParent(parentId: string, linkId: string, p: ParentForm): Promise<void> {
  const up = await supabase.from("parents").update(parentValues(p) as never).eq("id", parentId);
  fail(up.error);
  const rel = await supabase
    .from("student_parents")
    .update({ relationship: p.relationship.trim() } as never)
    .eq("id", linkId);
  fail(rel.error);
}

/** Retire le lien avec l'élève. Le parent reste dans le répertoire (il peut avoir d'autres enfants). */
export async function unlinkParent(linkId: string): Promise<void> {
  const { error } = await supabase.from("student_parents").delete().eq("id", linkId);
  fail(error);
}

/** Recherche dans le répertoire : nom, prénom ou téléphone, sans accents ni majuscules. */
export function searchParents(parents: ParentRow[], query: string, limit = 5): ParentRow[] {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const q = norm(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ").filter(Boolean);
  return parents
    .filter((p) => {
      const hay = `${norm(`${p.last_name} ${p.first_name} ${p.phone ?? ""}`)} ${digits(p.phone ?? "")}`;
      return tokens.every((t) => hay.includes(t));
    })
    .slice(0, limit);
}
