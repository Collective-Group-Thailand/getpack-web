import Link from "next/link";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Tone = "neutral" | "warning" | "danger" | "success";

const HINT: Record<Tone, string> = {
  neutral: "text-muted",
  warning: "text-warning-subtle-fg",
  danger: "text-danger",
  success: "text-success",
};

export interface Figure {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  /** The list behind the figure; the whole cell opens it (one tab stop, the label). */
  href?: string;
}

/**
 * Figures inside a report panel (the dashboard's money, its production): cells on hairlines rather than a card
 * each — label, the figure in tabular numerals, one line under it tinted only when it asks for attention. Two to
 * a row on a phone, `columns` from a tablet.
 */
export function FigureGrid({
  label,
  items,
  columns = 3,
  className,
}: {
  label: string;
  items: readonly Figure[];
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  return (
    <dl
      aria-label={label}
      className={cn(
        "border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border",
        columns === 2 && "md:grid-cols-2",
        columns === 3 && "md:grid-cols-3",
        columns === 4 && "md:grid-cols-4",
        columns === 5 && "md:grid-cols-3 xl:grid-cols-5",
        // An odd last cell takes the row on a phone instead of leaving a hole.
        "max-md:[&>div:last-child:nth-child(odd)]:col-span-2",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            "bg-surface relative flex min-w-0 flex-col gap-0.5 px-4 py-3.5",
            item.href &&
              "hover:bg-surface-subtle focus-within:ring-focus-ring transition-colors focus-within:ring-2 focus-within:ring-inset",
          )}
        >
          <dt className="text-muted text-sm leading-snug">
            {item.href ? (
              <Link href={item.href} className="outline-none after:absolute after:inset-0">
                {item.label}
              </Link>
            ) : (
              item.label
            )}
          </dt>
          <dd className="text-xl leading-tight font-semibold tracking-tight tabular-nums">{item.value}</dd>
          {item.hint ? <dd className={cn("text-xs text-pretty", HINT[item.tone ?? "neutral"])}>{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** The one figure a report panel leads with: its label, the amount large, and what it is measured against. */
export function Headline({
  label,
  value,
  children,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-muted text-sm">{label}</p>
      <p className="text-[1.75rem] leading-tight font-semibold tracking-tight tabular-nums">{value}</p>
      {children}
    </div>
  );
}

/** The way on from a report panel, at its heading's end: a quiet text link with a chevron, never a second button. */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-primary focus-visible:ring-focus-ring -me-1.5 inline-flex min-h-11 items-center gap-0.5 rounded-md px-1.5 text-sm font-medium outline-none hover:underline focus-visible:ring-2 md:min-h-8"
    >
      {children}
      <Icon name="chevron-right" size={16} aria-hidden="true" />
    </Link>
  );
}
