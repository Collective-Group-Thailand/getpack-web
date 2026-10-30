import Link from "next/link";

import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Breadcrumbs, above the title. */
  breadcrumbs?: React.ReactNode;
  /** A small way back above the title (a record page back to its list). */
  back?: { href: string; label: string };
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
export function PageHeader({ title, description, breadcrumbs, back, meta, actions, className }: PageHeaderProps) {
  return (
    // The same head as `DeskPage`: the way back, the title with its status, one line on the page's job, the actions.
    <header className={cn("flex flex-col gap-1.5", className)}>
      {breadcrumbs}
      {back ? (
        <Link
          href={back.href}
          className="text-muted hover:text-fg focus-visible:ring-focus-ring -ms-1.5 inline-flex min-h-11 items-center gap-1 self-start rounded-md px-1.5 text-sm outline-none focus-visible:ring-2 md:min-h-8"
        >
          <Icon name="chevron-left" size={16} aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-[min(100%,16rem)] flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-[1.5rem] leading-[1.2] font-semibold tracking-tight text-balance [overflow-wrap:anywhere] break-keep md:text-[1.75rem]">
              {title}
            </h1>
            {meta}
          </div>
          {description ? <p className="text-muted mt-1.5 max-w-[62ch] text-pretty">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
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
