/**
 * Conversion d'un montant entier en lettres (français), pour les reçus.
 * Gère les accords : "quatre-vingts" / "deux cents" prennent un « s » seulement
 * quand rien ne les suit ("quatre-vingt mille", "deux cent mille").
 */
const UNITS = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function below100(n: number, final: boolean): string {
  if (n < 20) return UNITS[n] ?? "";
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[t] ?? "";
    if (u === 1) return `${TENS[t]} et un`;
    return `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) {
    if (n === 71) return "soixante et onze";
    return `soixante-${UNITS[n - 60]}`;
  }
  if (n === 80) return final ? "quatre-vingts" : "quatre-vingt";
  return `quatre-vingt-${UNITS[n - 80]}`;
}

function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return below100(r, final);
  let out = h === 1 ? "cent" : `${UNITS[h]} cent`;
  if (r === 0) return h > 1 && final ? `${out}s` : out;
  out += ` ${below100(r, final)}`;
  return out;
}

export function numberToFrench(value: number): string {
  const n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return "zéro";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) {
    parts.push(millions === 1 ? "un million" : `${below1000(millions, true)} millions`);
  }
  if (thousands) {
    parts.push(thousands === 1 ? "mille" : `${below1000(thousands, false)} mille`);
  }
  if (rest) parts.push(below1000(rest, true));
  return parts.join(" ");
}

/** "Vingt-cinq mille francs CFA" */
export function amountInWords(value: number): string {
  const words = numberToFrench(value);
  const cap = words.charAt(0).toUpperCase() + words.slice(1);
  return `${cap} francs CFA`;
}
