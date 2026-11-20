/** Modes de paiement utilisés par l'établissement. « tontine » est créé automatiquement par la page Tontine. */
export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "espèces", label: "Espèces" },
  { value: "tmoney", label: "Tmoney" },
  { value: "flooz", label: "Flooz" },
];

const LABELS: Record<string, string> = {
  espèces: "Espèces",
  especes: "Espèces",
  tmoney: "Tmoney",
  flooz: "Flooz",
  tontine: "Tontine",
  "mobile money": "Mobile money",
  virement: "Virement",
  chèque: "Chèque",
};

export function methodLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return LABELS[value.toLowerCase()] ?? value;
}
