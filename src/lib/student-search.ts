import type { Student } from "@/lib/data";

/** Minuscules, sans accents ni ponctuation : « Kossi-Ablavi » et « kossi ablavi » se valent. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Recherche d'élèves actifs par nom, prénom ou matricule, dans n'importe quel ordre
 * (« sofia sogan » trouve SOGAN Sofia). Les mots qui commencent par ce qu'on tape passent en premier.
 */
export function searchStudents(students: Student[], query: string, limit = 8): Student[] {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ").filter(Boolean);

  const found: { student: Student; score: number }[] = [];
  for (const s of students) {
    if (s.status !== "actif") continue;
    const haystack = normalizeText(`${s.last_name} ${s.first_name} ${s.matricule}`);
    if (!tokens.every((t) => haystack.includes(t))) continue;
    const words = haystack.split(" ");
    const starts = tokens.filter((t) => words.some((w) => w.startsWith(t))).length;
    found.push({ student: s, score: starts * 100 - haystack.length });
  }
  found.sort(
    (a, b) =>
      b.score - a.score ||
      a.student.last_name.localeCompare(b.student.last_name, "fr") ||
      a.student.first_name.localeCompare(b.student.first_name, "fr"),
  );
  return found.slice(0, limit).map((f) => f.student);
}
