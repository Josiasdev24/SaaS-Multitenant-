import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Cadre pour les grandes grilles de saisie :
 * - une barre de défilement horizontale EN HAUT, synchronisée avec celle du bas, pour ne plus
 *   avoir à descendre tout en bas de la liste pour voir les colonnes de droite ;
 * - une hauteur limitée à l'écran : le défilement vertical se fait dans le cadre, la barre du bas
 *   reste donc toujours visible, et l'en-tête (position: sticky) reste affiché.
 */
export function TopScroll({
  children,
  maxHeight = "max(360px, calc(100vh - 300px))",
}: {
  children: ReactNode;
  maxHeight?: string;
}) {
  const top = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setWidth(el.scrollWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const content = el.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Régler scrollLeft à la valeur qu'il a déjà ne déclenche aucun événement : pas de boucle.
  function syncFromTop() {
    const t = top.current;
    const b = body.current;
    if (t && b && b.scrollLeft !== t.scrollLeft) b.scrollLeft = t.scrollLeft;
  }
  function syncFromBody() {
    const t = top.current;
    const b = body.current;
    if (t && b && t.scrollLeft !== b.scrollLeft) t.scrollLeft = b.scrollLeft;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div
        ref={top}
        onScroll={syncFromTop}
        aria-hidden="true"
        className="top-scroll-bar overflow-x-auto overflow-y-hidden border-b border-border bg-muted/50"
      >
        <div style={{ width, height: 1 }} />
      </div>
      <div ref={body} onScroll={syncFromBody} className="top-scroll-body overflow-auto" style={{ maxHeight }}>
        {children}
      </div>
    </div>
  );
}
