import { useEffect, useMemo, useState } from "react";

/**
 * Pagination cliente simple pour des listes déjà chargées en mémoire.
 * Revenir à la page 1 automatiquement si la liste change de taille
 * (nouveau filtre, recherche, etc.) et que la page courante devient invalide.
 */
export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    totalPages,
    totalItems,
    pageSize,
    pageItems,
  };
}
