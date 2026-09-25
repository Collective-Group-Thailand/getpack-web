import { cn } from "../lib/cn";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Breadcrumbs, above the title. */
  breadcrumbs?: React.ReactNode;
  /** Status badges and codes beside the title. */
  meta?: React.ReactNode;
  /** The page's actions. One primary action per view (design-system.md §1). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The top of a back-office page: where am I, what is this, what can I do. The one `<h1>` on the
 * page lives here (design-system.md §6).
 */
export function PageHeader({ title, description, breadcrumbs, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {breadcrumbs}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {meta}
          </div>
          {description ? <p className="text-muted mt-1 max-w-3xl text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** A row of filters and list actions above a table. */
export function Toolbar({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div role="toolbar" aria-label={label} className={cn("flex flex-wrap items-end gap-2", className)}>
      {children}
    </div>
  );
}
