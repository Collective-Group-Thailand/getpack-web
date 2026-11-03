import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Icon } from "@/ui/icons";
import { LinkPagination } from "@/ui/components/LinkPagination";
import { cn } from "@/ui/lib/cn";

/**
 * Every getpack Agent page's head (D-467): an optional way back, the title (with a status beside it when the page is
 * about one thing), one line on what the page is for, and the page's actions — under the title on a phone, at its
 * end from a tablet up. Then the page.
 */
export function AgentPage({
  title,
  intro,
  actions,
  back,
  status,
  children,
  className,
}: {
  title: React.ReactNode;
  intro?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: React.ReactNode };
  status?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <header className="flex flex-col gap-2">
        {back ? (
          <Link
            href={back.href}
            className="text-muted hover:text-fg focus-visible:ring-focus-ring -ms-1 inline-flex min-h-11 items-center gap-1 self-start rounded-sm px-1 text-sm outline-none focus-visible:ring-2"
          >
            <Icon name="chevron-left" size={16} aria-hidden="true" />
            {back.label}
          </Link>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-[1.75rem]">
                {title}
              </h1>
              {status}
            </div>
            {intro ? <p className="text-muted mt-1.5 max-w-[62ch] text-pretty">{intro}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
        </div>
      </header>
      {children}
    </div>
  );
}

/** A section card: a heading and its content on white, the way every agent page groups things. */
export function Panel({
  title,
  id,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  id: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("border-border bg-surface rounded-card border p-4 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Page links for the agent lists (`?page=`). */
export async function AgentPager({
  page,
  total,
  perPage,
  path,
}: {
  page: number;
  total: number;
  perPage: number;
  path: string;
}) {
  const t = await getTranslations("agent.pagination");
  const pages = Math.max(1, Math.ceil(total / perPage));
  return (
    <LinkPagination
      page={page}
      pages={pages}
      hrefFor={(target) => (target === 1 ? path : `${path}${path.includes("?") ? "&" : "?"}page=${target}`)}
      linkAs={Link}
      labels={{ nav: t("nav"), previous: t("previous"), next: t("next"), page: (n) => t("page", { page: n }) }}
    />
  );
}

export const pageOf = (raw: string | undefined) => Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
