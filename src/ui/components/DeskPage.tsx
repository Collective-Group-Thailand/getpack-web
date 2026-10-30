import Link from "next/link";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { SummaryCards, type SummaryItem } from "./SummaryCards";

export type { SummaryItem };

/**
 * The frame of a desk screen (partner portal, admin console): one `h1`, an optional way back, and a single column that
 * reads on a 6" phone and widens to two on a tablet (design-system.md §5). Server-only markup.
 *
 * The head is the product family's page header (the account pages' `AccountHeader`): a small way
 * back, the title with its status beside it, one line on what the page is for, and the page's
 * actions at the end — the primary one filled, the rest outlined.
 */
export function DeskPage({
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
 * The figures on top of a desk page — the same cards as the account pages (`SummaryCards`), each
 * a count the API sent, the one asking something of the factory on the pale tint. A card with
 * `href` opens the list it counts.
 */
export function StatsRow({
  label,
  items,
  columns,
  className,
}: {
  label: string;
  items: readonly SummaryItem[];
  /** Left out, the count decides: every card in one row on a desk, no card alone in a row (6 → 3 + 3, 7 → 4 + 3). */
  columns?: 2 | 3 | 4 | 5 | 6;
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

/** A titled block of a desk screen. */
export function DeskSection({
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
