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
  /** A quieter way on, under the action (a text link): "sign in to see a saved cart". */
  secondary?: React.ReactNode;
  /** Slot for an original illustration; keep the icon when there is none. */
  illustration?: React.ReactNode;
  /** The title's element — `h1` when the empty state is the whole page (a 404), so it is not said twice. */
  titleAs?: "p" | "h1" | "h2" | "h3";
}

/**
 * "Nothing here yet" done properly: explain the value, then offer one action —
 * never a bare "No data". Project A: a calm centred card — the icon on a small neutral plate, the title,
 * one sentence, the primary next step and, when there is one, a secondary link.
 */
export function EmptyState({
  title,
  description,
  icon = "box",
  action,
  secondary,
  illustration,
  titleAs: Title = "p",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-surface rounded-card flex flex-col items-center justify-center gap-3 border px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {illustration ?? (
        <span
          aria-hidden="true"
          className="border-border bg-surface-subtle text-muted mb-1 grid size-14 place-items-center rounded-xl border"
        >
          <Icon name={icon} size={26} />
        </span>
      )}
      <Title className="text-lg font-semibold text-balance">{title}</Title>
      {description ? <p className="text-muted max-w-[46ch] text-sm text-pretty">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
      {secondary ? <div className="text-sm">{secondary}</div> : null}
    </div>
  );
}
