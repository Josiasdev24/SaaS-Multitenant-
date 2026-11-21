import { useEffect } from "react";

import type { SchoolInfo } from "@/lib/session";

/** Luminance relative approximative (0 = noir, 1 = blanc) d'une couleur #rrggbb. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const VARS = [
  "--primary",
  "--primary-foreground",
  "--brand-blue",
  "--brand-blue-foreground",
  "--brand-sky",
  "--ring",
  "--brand-red",
  "--accent",
] as const;

/** Applique les couleurs de l'école active (si elle en a défini) à toute l'application. */
export function SchoolTheme({ school }: { school: SchoolInfo | null }) {
  const primary = school?.primary_color ?? null;
  const accent = school?.accent_color ?? null;

  useEffect(() => {
    const style = document.documentElement.style;
    if (primary) {
      const fg = luminance(primary) > 0.45 ? "#111111" : "#ffffff";
      style.setProperty("--primary", primary);
      style.setProperty("--primary-foreground", fg);
      style.setProperty("--brand-blue", primary);
      style.setProperty("--brand-blue-foreground", fg);
      style.setProperty("--brand-sky", `color-mix(in oklab, ${primary} 55%, white)`);
      style.setProperty("--ring", `color-mix(in oklab, ${primary} 55%, white)`);
    }
    if (accent) {
      style.setProperty("--brand-red", accent);
      style.setProperty("--accent", accent);
    }
    return () => {
      for (const v of VARS) style.removeProperty(v);
    };
  }, [primary, accent]);

  return null;
}
