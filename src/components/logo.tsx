import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  imageClassName?: string;
  initialsClassName?: string;
  /** Nom de l'école (pour les initiales de secours). */
  name?: string | null;
  /** Chemin du logo dans le bucket school-logos (« <school_id>/… »). */
  logoPath?: string | null;
};

function initialsOf(name?: string | null): string {
  const words = (name ?? "").split(/\s+/).filter((w) => w.length > 2 || /^[A-Z]/.test(w));
  const letters = words
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "É";
}

export function Logo({ className, imageClassName, initialsClassName, name, logoPath }: LogoProps) {
  const { data: url } = useQuery({
    queryKey: ["school-logo", logoPath],
    enabled: Boolean(logoPath),
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("school-logos").createSignedUrl(logoPath as string, 3600);
      return data?.signedUrl ?? null;
    },
  });

  return (
    <span
      className={cn(
        "inline-flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={name ?? "Logo de l'école"} className={cn("h-full w-full object-cover", imageClassName)} />
      ) : (
        <span
          role="img"
          aria-label={name ?? "École"}
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
            initialsClassName,
          )}
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
