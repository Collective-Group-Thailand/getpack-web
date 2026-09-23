import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** What is missing, in the user's words. */
  title: React.ReactNode;
  /** Why it matters and what to do about it (design-system.md §4). */
  description?: React.ReactNode;
  icon?: IconName;
  /** The single next best action. */
  action?: React.ReactNode;
  /** Slot for an original illustration; keep the icon when there is none. */
  illustration?: React.ReactNode;
}

/**
 * "Nothing here yet" done properly: explain the value, then offer one action —
 * never a bare "No data".
 */
export function EmptyState({
  title,
  description,
  icon = "box",
  action,
  illustration,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {illustration ?? <Icon name={icon} size={32} className="text-subtle" />}
      <p className="text-lg font-medium">{title}</p>
      {description ? <p className="text-muted max-w-prose text-sm">{description}</p> : null}
      {action ? <div className="mt-2 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
