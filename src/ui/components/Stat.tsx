import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface StatProps {
  label: React.ReactNode;
  /** Already formatted — a count, `formatTHB(...)`, a percentage. */
  value: React.ReactNode;
  /** One line under the value: "3 เกินกำหนด", "ถัดไปครบใน 2 ชม.". */
  hint?: React.ReactNode;
  icon?: IconName;
  /** Tints the hint and the icon, never the value — information hierarchy by type, not colour. */
  tone?: "neutral" | "success" | "warning" | "danger";
  /** Makes the whole card the link, e.g. to the queue it counts. Pass an `<a>`/`<Link>` wrapper. */
  as?: React.ElementType;
  href?: string;
  className?: string;
}

/**
 * A KPI or queue card (design-system.md §3 "Stat/KPI card", the dashboard's queues). When it
 * links somewhere the whole card is the target — one tab stop, 24 px+ tall (WCAG 2.5.8).
 */
export function Stat({ label, value, hint, icon, tone = "neutral", as = "div", href, className }: StatProps) {
  const toneClass = {
    neutral: "text-muted",
    success: "text-success",
    warning: "text-warning-subtle-fg",
    danger: "text-danger",
  }[tone];

  // Narrowed to the props passed below: with three.js elements in the JSX namespace (the designer's
  // 3D preview), the union of every intrinsic element no longer accepts children.
  const Component = as as React.ElementType<{ href?: string; className?: string; children?: React.ReactNode }>;

  return (
    <Component
      href={href}
      className={cn(
        "border-border bg-surface flex flex-col gap-1 rounded-lg border p-3 sm:p-4",
        href && "hover:border-border-strong hover:bg-surface-subtle transition-colors",
        className,
      )}
    >
      <span className="text-muted flex items-start gap-2 text-sm leading-snug">
        {icon ? <Icon name={icon} size={16} className={cn("mt-0.5 shrink-0", toneClass)} /> : null}
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className={cn("text-xs", toneClass)}>{hint}</span> : null}
    </Component>
  );
}
