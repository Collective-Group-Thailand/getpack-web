import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Retry, or anything else that gets the user out of here. */
  action?: React.ReactNode;
  /**
   * Support code, shown small (design-system.md §4). Monospace and selectable so it can be
   * read out or pasted into a chat with CS.
   */
  code?: string;
}

/**
 * A failed region — specific and recoverable, never a dead end. `role="alert"` so a screen
 * reader hears it when it replaces the content that was loading.
 */
export function ErrorState({ title, description, action, code, className, ...props }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "border-danger/25 bg-danger-subtle flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      <Icon name="danger" size={28} className="text-danger-subtle-fg" />
      <p className="text-danger-subtle-fg text-lg font-medium">{title}</p>
      {description ? <p className="text-danger-subtle-fg/90 max-w-prose text-sm">{description}</p> : null}
      {action ? <div className="mt-2 flex items-center gap-2">{action}</div> : null}
      {code ? <p className="text-muted mt-1 font-mono text-xs select-all">{code}</p> : null}
    </div>
  );
}
