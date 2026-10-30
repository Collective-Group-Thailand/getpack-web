import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * Every account page's head (Project B): an optional way back, the title (with a status beside it when the page
 * is about one thing), one line on what the page is for, and the page's actions at the end — the primary one
 * filled, the rest outlined. One size and rhythm for every account page.
 */
export function AccountHeader({
  back,
  title,
  status,
  lede,
  actions,
  children,
  className,
}: {
  back?: { href: string; label: React.ReactNode };
  title: React.ReactNode;
  /** A status chip beside the title. */
  status?: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  /** More lines under the lede (a code, a meta line). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {back ? (
        <Link
          href={back.href}
          className="text-muted hover:text-fg focus-visible:ring-focus-ring inline-flex items-center gap-1 self-start rounded-sm text-sm outline-none focus-visible:ring-2"
        >
          <Icon name="chevron-left" size={16} aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-[1.625rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2rem]">
              {title}
            </h1>
            {status}
          </div>
          {lede ? <p className="text-muted mt-1.5 max-w-[62ch] text-pretty">{lede}</p> : null}
          {children}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
    </header>
  );
}
