import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export function PrintHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "print-header mb-5 flex items-center gap-4 border-b-2 border-print-ink pb-3",
        className,
      )}
    >
      <Logo className="h-16 w-16 border border-print-ink" initialsClassName="text-sm" />
      <div className="text-print-ink">
        <div className="text-lg font-bold uppercase">Complexe Scolaire Omarus Adodo</div>
        <div className="mt-1 text-xs font-medium">Lomé - TOGO</div>
        <div className="text-xs">Tél. : 98 40 10 27 / 93 96 13 21</div>
      </div>
    </header>
  );
}