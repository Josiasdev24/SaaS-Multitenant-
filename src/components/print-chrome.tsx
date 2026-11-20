import { useState } from "react";
import { Printer } from "lucide-react";

import { Logo } from "@/components/logo";
import { dateFr, todayISO } from "@/lib/format";

/**
 * Impression de toutes les pages de l'application.
 *
 * - Sur une page « ordinaire » (liste, tableau, rapport…), l'impression reprend le contenu de la page
 *   en pleine largeur A4, sans menu, sans boutons ni champs, avec l'en-tête de l'école.
 * - Les pages qui ont leur propre document à imprimer (bulletins, reçu, fiches de notes…)
 *   marquent leur zone avec l'identifiant #print-area : seule cette zone s'imprime, comme avant.
 */

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  html, body { background: #fff !important; }

  /* Pages ordinaires : tout ce qui n'a pas sa propre zone #print-area */
  body:not(:has(#print-area)) main { padding: 0 !important; max-width: none !important; margin: 0 !important; }
  body:not(:has(#print-area)) main > * + * { margin-top: 10px !important; }
  body:not(:has(#print-area)) main :is(button, select, input, textarea, [role="listbox"], .print-hidden, .no-print) {
    display: none !important;
  }
  body:not(:has(#print-area)) main a { color: #000 !important; text-decoration: none !important; }
  body:not(:has(#print-area)) main [class*="overflow-"] { overflow: visible !important; max-height: none !important; }
  body:not(:has(#print-area)) main * { box-shadow: none !important; animation: none !important; }
  body:not(:has(#print-area)) main h1 { font-size: 18px !important; color: #000 !important; }
  body:not(:has(#print-area)) main h1::after { background: #000 !important; }

  body:not(:has(#print-area)) main table {
    width: 100% !important; min-width: 0 !important; border-collapse: collapse !important; font-size: 10.5px !important;
  }
  body:not(:has(#print-area)) main :is(th, td) {
    border: 1px solid #000 !important; padding: 2px 5px !important; line-height: 1.2 !important;
    position: static !important; background: transparent !important; color: #000 !important;
  }
  body:not(:has(#print-area)) main thead { display: table-header-group; background: none !important; }
  body:not(:has(#print-area)) main thead th { background: #d9d9d9 !important; text-transform: uppercase; font-size: 9.5px !important; }
  body:not(:has(#print-area)) main tr { break-inside: avoid; page-break-inside: avoid; }
  body:not(:has(#print-area)) main .bg-card, body:not(:has(#print-area)) main [class*="rounded"] { border-radius: 0 !important; }
  body:not(:has(#print-area)) main .num-display { color: #000 !important; }
}
`;

export function PrintStyles() {
  return <style>{PRINT_CSS}</style>;
}

/** En-tête de l'école, visible uniquement à l'impression des pages ordinaires. */
export function PrintLetterhead({ userName }: { userName: string }) {
  return (
    <div className="hidden items-center gap-4 border-b-2 border-black pb-2 print:flex">
      <Logo className="h-14 w-14 shrink-0" initialsClassName="text-[14px]" />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold uppercase tracking-wide">Complexe Scolaire « Omarus Adodo »</div>
        <div className="text-[11px]">Crèche – Maternelle – Primaire – Collège</div>
        <div className="text-[11px]">Bè-Kpota, 06 BP 61986 Lomé – Togo · Tél. : (+228) 93 96 13 21 / 98 40 10 27 / 93 21 15 59</div>
      </div>
      <div className="text-right text-[10px]">
        <div>Imprimé le {dateFr(todayISO())}</div>
        <div>par {userName}</div>
      </div>
    </div>
  );
}

/** Bouton « Imprimer » de la barre du haut, avec le choix portrait ou paysage (utile pour les grands tableaux). */
export function PrintButton() {
  const [landscape, setLandscape] = useState(false);

  function print() {
    const style = document.createElement("style");
    style.id = "print-orientation";
    style.textContent = `@media print { @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 8mm; } }`;
    document.head.appendChild(style);
    const done = () => {
      style.remove();
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }

  return (
    <div className="ml-auto flex items-center gap-3 print:hidden">
      <label className="hidden cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground md:flex">
        <input type="checkbox" checked={landscape} onChange={(e) => setLandscape(e.target.checked)} />
        Paysage
      </label>
      <button
        type="button"
        onClick={print}
        className="flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Printer className="h-4 w-4" />
        Imprimer
      </button>
    </div>
  );
}
