/** Mois de l'année scolaire (septembre à août) pour les filtres. */
export type MonthOption = { key: string; label: string };

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthLabel(key: string): string {
  const [y = 1970, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d),
  );
}

/** Les 12 mois de l'année scolaire en cours (de septembre à août). */
export function academicMonths(todayIso: string): MonthOption[] {
  const [year = 0, month = 0] = todayIso.split("-").map(Number);
  const startYear = month >= 9 ? year : year - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((8 + i) % 12) + 1;
    const y = startYear + Math.floor((8 + i) / 12);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    return { key, label: monthLabel(key) };
  });
}

export function monthOf(dateIso: string): string {
  return dateIso.slice(0, 7);
}
