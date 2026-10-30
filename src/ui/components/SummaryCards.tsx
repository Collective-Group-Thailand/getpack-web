import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface SummaryItem {
  key: string;
  label: React.ReactNode;
  /** Already formatted: an amount the API sent, a count, a tier name. Nothing here adds or subtracts. */
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: IconName;
  /** The one figure the page is about (the balance, what to pay next): on the pale primary tint, wider on a phone. */
  highlight?: boolean;
  /** Tints the hint and icon only — never the figure. */
  tone?: "neutral" | "warning" | "danger";
  /** One way on from the card (a link or a button). */
  action?: React.ReactNode;
  /** The whole card opens this list (a count that is also a filter). Needs `linkAs` for client-side routing. */
  href?: string;
}

/** The link element a zone routes with (`next/link` in partner/admin, the locale-aware `Link` in the storefront). */
type LinkLike = React.ElementType<{ href: string; className?: string; children?: React.ReactNode }>;

/**
 * The row of figures on top of an account money page (Project B2): the balance, what is due, the counts by
 * status — each a card with its label, the figure and one line under it. A `<dl>`, so a screen reader hears
 * each label with its figure.
 */
export function SummaryCards({
  items,
  columns = 4,
  wideHighlight = true,
  className,
  linkAs,
}: {
  items: readonly SummaryItem[];
  /** 5: three to a row on a tablet (3 + 2), all five in one row from 1200 px. */
  columns?: 2 | 3 | 4 | 5;
  /** On a phone the highlighted card takes the whole row; off for a pair of cards that should sit side by side. */
  wideHighlight?: boolean;
  className?: string;
  /** What renders `item.href` — a plain `<a>` when not given. */
  linkAs?: LinkLike;
}) {
  if (items.length === 0) return null;
  const LinkTag: LinkLike = linkAs ?? "a";
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-3",
        columns === 2 && "md:grid-cols-2",
        columns === 3 && "md:grid-cols-3",
        columns === 4 && "md:grid-cols-2 lg:grid-cols-4",
        columns === 5 && "md:grid-cols-3 min-[75rem]:grid-cols-5",
        className,
      )}
    >
      {items.map((item) => {
        const tone = item.highlight
          ? "text-primary-subtle-fg"
          : { neutral: "text-muted", warning: "text-warning-subtle-fg", danger: "text-danger" }[item.tone ?? "neutral"];
        return (
          <div
            key={item.key}
            className={cn(
              "rounded-card relative flex min-w-0 flex-col gap-1 border p-4",
              item.href &&
                "hover:border-border-strong focus-within:ring-focus-ring transition-colors focus-within:ring-2",
              item.highlight
                ? cn(
                    "bg-primary-subtle text-primary-subtle-fg border-transparent",
                    wideHighlight && "col-span-2 md:col-span-1",
                  )
                : "border-border bg-surface",
            )}
          >
            <dt
              className={cn(
                "flex items-center gap-2 text-sm leading-snug",
                item.highlight ? "font-medium" : "text-muted",
              )}
            >
              {item.icon ? (
                <Icon name={item.icon} size={16} aria-hidden="true" className={cn("shrink-0", tone)} />
              ) : null}
              {item.href ? (
                // One tab stop per card: the label is the link, stretched over the whole card.
                <LinkTag href={item.href} className="outline-none after:absolute after:inset-0">
                  {item.label}
                </LinkTag>
              ) : (
                item.label
              )}
            </dt>
            <dd className="text-[1.625rem] leading-tight font-semibold tracking-tight tabular-nums">{item.value}</dd>
            {item.hint ? <dd className={cn("text-xs text-pretty", tone)}>{item.hint}</dd> : null}
            {item.action ? <dd className="mt-auto pt-2">{item.action}</dd> : null}
          </div>
        );
      })}
    </dl>
  );
}
