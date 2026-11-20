import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FEE_STATUS_LABELS, type FeeStatus } from "@/lib/data";

/* ------------------------------------------------------------- structures */

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-[28px] leading-none tracking-tight md:text-[34px]">
          {title}
        </h1>
        {subtitle ? <p className="mt-2 text-[13px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>{children}</div>
  );
}

/* ------------------------------------------------------------------- KPIs */

export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 xl:grid-cols-4">
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  hint,
  span,
  children,
}: {
  label: string;
  value?: ReactNode;
  hint?: ReactNode;
  span?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("bg-card p-4", span)}>
      <div className="label-caps">{label}</div>
      {value !== undefined ? <div className="num-display mt-2 text-[28px]">{value}</div> : null}
      {hint ? <div className="mt-2 text-[12px] text-muted-foreground">{hint}</div> : null}
      {children}
    </div>
  );
}

export function Meter({ segments }: { segments: { value: number; className: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
      {segments.map((s, i) => (
        <span key={i} className={s.className} style={{ width: `${(s.value / total) * 100}%` }} />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- badges */

const STATUS_CLASS: Record<FeeStatus, string> = {
  ajour: "bg-ok/10 text-ok",
  partiel: "bg-partial/10 text-partial",
  retard: "bg-late/10 text-late",
  impaye: "bg-late/10 text-late",
};
const STATUS_DOT: Record<FeeStatus, string> = {
  ajour: "bg-ok",
  partiel: "bg-partial",
  retard: "bg-late",
  impaye: "bg-late",
};

export function FeeStatusBadge({ status }: { status: FeeStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium",
        STATUS_CLASS[status],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {status === "partiel" ? "Partiel" : FEE_STATUS_LABELS[status]}
    </span>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "late" | "partial" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-muted text-muted-foreground",
    ok: "bg-ok/10 text-ok",
    late: "bg-late/10 text-late",
    partial: "bg-partial/10 text-partial",
    accent: "bg-primary/10 text-primary",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- tables */

export function TableWrap({
  children,
  footer,
  minWidth = 640,
}: {
  children: ReactNode;
  footer?: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" style={{ minWidth }}>
          {children}
        </table>
      </div>
      {footer ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-faint">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-faint",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="h-7 rounded-md border border-border px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-40"
      >
        Précédent
      </button>
      <span>
        Page {page} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="h-7 rounded-md border border-border px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-40"
      >
        Suivant
      </button>
    </div>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
        {label}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ états */

export function LoadingBlock({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-[13px] text-muted-foreground">
      {label}
    </div>
  );
}

export function ErrorBlock({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-late/30 bg-late/5 px-4 py-6 text-[13px] text-late">
      Impossible de charger ces données.{" "}
      {message ? <span className="text-late/80">{message}</span> : null}
    </div>
  );
}

export function NoAccess() {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-10 text-center">
      <p className="text-[15px] font-medium">Accès non autorisé</p>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Votre rôle ne permet pas de consulter cette section.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- graphiques */

export function LineChartSimple({
  series,
  labels,
}: {
  series: { points: number[]; className: string; dashed?: boolean }[];
  labels?: string[];
}) {
  const all = series.flatMap((s) => s.points);
  const max = Math.max(1, ...all);
  const w = 320;
  const h = 150;
  const path = (points: number[]) =>
    points
      .map((v, i) => {
        const x = 20 + (i * (w - 40)) / Math.max(points.length - 1, 1);
        const y = 120 - (v / max) * 85;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-36 w-full">
        <line
          x1="10"
          y1="120"
          x2="310"
          y2="120"
          stroke="currentColor"
          className="text-border"
          strokeWidth="1"
        />
        <line
          x1="10"
          y1="80"
          x2="310"
          y2="80"
          stroke="currentColor"
          className="text-border/60"
          strokeWidth="1"
        />
        <line
          x1="10"
          y1="40"
          x2="310"
          y2="40"
          stroke="currentColor"
          className="text-border/60"
          strokeWidth="1"
        />
        {series.map((s, i) => (
          <path
            key={i}
            d={path(s.points)}
            fill="none"
            stroke="currentColor"
            className={s.className}
            strokeWidth={s.dashed ? 1.5 : 2}
            strokeDasharray={s.dashed ? "3 3" : undefined}
          />
        ))}
      </svg>
      {labels ? (
        <div className="flex justify-between px-3 text-[10px] text-faint">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BarChartStacked({
  bars,
  labels,
}: {
  bars: { top: number; bottom: number }[];
  labels?: string[];
}) {
  const max = Math.max(1, ...bars.map((b) => b.top + b.bottom));
  const barW = 26;
  const gap = 20;
  return (
    <div>
      <svg viewBox="0 0 320 150" className="mt-4 h-36 w-full">
        <line
          x1="10"
          y1="120"
          x2="310"
          y2="120"
          stroke="currentColor"
          className="text-border"
          strokeWidth="1"
        />
        {bars.map((b, i) => {
          const x = 24 + i * (barW + gap);
          const hTop = (b.top / max) * 80;
          const hBottom = (b.bottom / max) * 80;
          return (
            <g key={i}>
              <rect
                x={x}
                y={120 - hTop - hBottom}
                width={barW}
                height={Math.max(hTop, 0.5)}
                rx="2"
                fill="currentColor"
                className="text-primary"
              />
              <rect
                x={x}
                y={120 - hBottom}
                width={barW}
                height={Math.max(hBottom, 0.5)}
                rx="2"
                fill="currentColor"
                className="text-late"
              />
            </g>
          );
        })}
      </svg>
      {labels ? (
        <div className="flex justify-between px-3 text-[10px] text-faint">
          {labels.map((l, i) => (
            <span key={`${l}-${i}`}>{l}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; className: string; line?: boolean }[];
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={cn(i.line ? "h-[2px] w-3" : "h-2.5 w-2.5 rounded-sm", i.className)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
