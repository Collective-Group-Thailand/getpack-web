import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  /** A `<time>` or formatted text; the caller decides relative vs absolute. */
  time: React.ReactNode;
  actor?: React.ReactNode;
  description?: React.ReactNode;
  icon?: IconName;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "info";
}

export interface TimelineProps {
  items: readonly TimelineItem[];
  /** Accessible name of the list, e.g. "ประวัติการดำเนินการ". */
  label: string;
  className?: string;
}

/**
 * Events in order, with who and when (design-system.md §3 "Timeline", "ActivityFeed"). An
 * ordered list, because order is the information; the rail and dots are decoration.
 */
export function Timeline({ items, label, className }: TimelineProps) {
  return (
    <ol aria-label={label} className={cn("relative space-y-4", className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3">
          {index < items.length - 1 ? (
            <span aria-hidden className="bg-border absolute start-[0.875rem] top-8 -bottom-4 w-px" />
          ) : null}
          <span
            aria-hidden
            className={cn(
              "bg-surface-subtle text-muted flex size-7 shrink-0 items-center justify-center rounded-full border",
              item.tone === "success" && "bg-success-subtle text-success-subtle-fg border-transparent",
              item.tone === "danger" && "bg-danger-subtle text-danger-subtle-fg border-transparent",
              item.tone === "warning" && "bg-warning-subtle text-warning-subtle-fg border-transparent",
              item.tone === "primary" && "bg-primary-subtle text-primary-subtle-fg border-transparent",
              item.tone === "info" && "bg-info-subtle text-info-subtle-fg border-transparent",
            )}
          >
            <Icon name={item.icon ?? "circle"} size={14} />
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-muted text-xs">
              {item.actor ? (
                <>
                  {item.actor}
                  {" · "}
                </>
              ) : null}
              {item.time}
            </p>
            {item.description ? <div className="text-muted mt-1 text-sm">{item.description}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
