/**
 * École active de la session. Elle est envoyée à la base à chaque requête
 * (voir client.ts) ; la base vérifie que le compte en est bien membre.
 */
const KEY = "active-school-id";
let current: string | null = null;

const UUID = /^[0-9a-fA-F-]{36}$/;

export function getActiveSchoolId(): string | null {
  if (current) return current;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && UUID.test(stored)) current = stored;
  } catch {
    /* stockage indisponible : on reste en mémoire */
  }
  return current;
}

export function setActiveSchoolId(id: string | null): void {
  current = id && UUID.test(id) ? id : null;
  try {
    if (current) localStorage.setItem(KEY, current);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignoré */
  }
}
