import { Logo } from "@/components/logo";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export function PrintHeader({ className }: { className?: string }) {
  const { data: user } = useCurrentUser();
  const school = user?.school;
  return (
    <header
      className={cn(
        "print-header mb-5 flex items-center gap-4 border-b-2 border-print-ink pb-3",
        className,
      )}
    >
      <Logo
        className="h-16 w-16 border border-print-ink"
        initialsClassName="text-sm"
        name={school?.name ?? null}
        logoPath={school?.logo_path ?? null}
      />
      <div className="text-print-ink">
        <div className="text-lg font-bold uppercase">{school?.name ?? ""}</div>
        {school?.address || school?.city ? (
          <div className="mt-1 text-xs font-medium">{[school?.address, school?.city].filter(Boolean).join(" – ")}</div>
        ) : null}
        {school?.phone ? <div className="text-xs">Tél. : {school.phone}</div> : null}
      </div>
    </header>
  );
}
