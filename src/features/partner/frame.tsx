import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { isApiError } from "@/lib/api/problem";
import { EmptyState } from "@/ui/components/EmptyState";
import { ErrorState } from "@/ui/components/ErrorState";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";
import { SummaryCards, type SummaryItem } from "@/ui/components/SummaryCards";

export type { SummaryItem };

/**
 * The frame of every partner screen: one `h1`, an optional way back, and a single column that
 * reads on a 6" phone and widens to two on a tablet (design-system.md §5). Server-only markup.
 *
 * The head is the product family's page header (the account pages' `AccountHeader`): a small way
 * back, the title with its status beside it, one line on what the page is for, and the page's
 * actions at the end — the primary one filled, the rest outlined.
 */
export function PartnerPage({
  title,
  status,
  description,
  back,
  meta,
  actions,
  wide = false,
  full = false,
  children,
}: {
  title: React.ReactNode;
  /** A status chip beside the title, when the page is about one thing. */
  status?: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  wide?: boolean;
  /** Tables wider than prose (price lists): up to 80rem. */
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("mx-auto w-full px-4 py-5 md:px-6 md:py-8", full ? "max-w-7xl" : wide ? "max-w-6xl" : "max-w-3xl")}
    >
      <header className="flex flex-col gap-1.5">
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
          {/* At least 16rem before the actions: on a phone they wrap under the title instead of squeezing it. */}
          <div className="min-w-[min(100%,16rem)] flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-[1.5rem] leading-[1.2] font-semibold tracking-tight text-balance [overflow-wrap:anywhere] break-keep md:text-[1.75rem]">
                {title}
              </h1>
              {status}
            </div>
            {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
            {description ? <p className="text-muted mt-1.5 max-w-[62ch] text-pretty">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
        </div>
      </header>
      <div className="mt-6 flex flex-col gap-6 md:gap-7">{children}</div>
    </div>
  );
}

/**
 * The figures on top of a partner page — the same cards as the account pages (`SummaryCards`), each
 * a count the API sent, the one asking something of the factory on the pale tint. A card with
 * `href` opens the list it counts.
 */
export function PartnerStats({
  label,
  items,
  columns,
  className,
}: {
  label: string;
  items: readonly SummaryItem[];
  /** Left out, the count decides: every card in one row on a desk, no card alone in a row (6 → 3 + 3, 7 → 4 + 3). */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  if (!items.length) return null;
  const cols = columns ?? fit(items.length);
  return (
    <section aria-label={label} className={className}>
      <SummaryCards
        items={items}
        columns={cols}
        linkAs={Link}
        wideHighlight={false}
        // Two to a row on a phone (and on a tablet for 2 or 4 columns): an odd last card takes the whole row
        // instead of standing alone.
        className={
          cols === 3 || cols === 5
            ? "max-md:[&>div:last-child:nth-child(odd)]:col-span-2"
            : "max-lg:[&>div:last-child:nth-child(odd)]:col-span-2"
        }
      />
    </section>
  );
}

const fit = (count: number): 2 | 3 | 4 | 5 =>
  count <= 2 ? 2 : count === 3 ? 3 : count === 4 ? 4 : count === 5 ? 5 : count === 6 ? 3 : 4;

/**
 * A record page with one thing to do next (a job, a shipment, a claim): the record on the left, the
 * next action in a panel on the right that stays in view while the record scrolls. On a phone and a
 * tablet the panel comes first — the person on the floor opens the page to do that one thing.
 */
export function PartnerDetail({ aside, children }: { aside: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6 md:gap-7">{children}</div>
      <aside className="order-first flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:order-none">{aside}</aside>
    </div>
  );
}

/**
 * The next-action panel of a record page: its heading, one line on why, and the action(s). `tone`
 * "primary" (the default) puts it on the pale tint — what the page asks of the factory — and
 * "neutral" on paper, for a record with nothing to do but read.
 */
export function ActionPanel({
  id,
  title,
  description,
  tone = "primary",
  children,
}: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: "primary" | "neutral";
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-card flex flex-col gap-3 border p-4 sm:p-5",
        tone === "primary" ? "bg-primary-subtle border-transparent" : "border-border bg-surface",
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className={cn("text-lg font-semibold", tone === "primary" && "text-primary-subtle-fg")}>
          {title}
        </h2>
        {description ? (
          <div className={cn("text-sm text-pretty", tone === "primary" ? "text-primary-subtle-fg" : "text-muted")}>
            {description}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A titled block of a partner screen. */
export function PartnerSection({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="flex scroll-mt-20 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold">
            {title}
          </h2>
          {description ? <p className="text-muted text-sm">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * Why a server-rendered read failed. A `403` and a `404` are answers (another factory's id is a
 * 404 — D-044), not failures, so they get their own words; anything else names the request id.
 */
export async function PageError({ error }: { error: unknown }) {
  const t = await getTranslations("common.errors");
  const api = isApiError(error) ? error : null;
  // Not an alarm: a record that is not there (or not this factory's) is said calmly, in grey, not red.
  if (api?.status === 403)
    return <EmptyState icon="lock" title={t("forbiddenTitle")} description={t("forbiddenBody")} />;
  if (api?.status === 404)
    return <EmptyState icon="search" title={t("itemNotFoundTitle")} description={t("itemNotFoundBody")} />;
  return (
    <ErrorState
      title={t("loadFailedTitle")}
      description={api?.detail || t("loadFailedBody")}
      code={api?.requestId || undefined}
      codeLabels={{ label: t("reference"), copy: t("copyReference"), copied: t("referenceCopied") }}
    />
  );
}
