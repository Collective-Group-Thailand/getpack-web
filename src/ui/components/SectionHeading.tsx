import { cn } from "../lib/cn";

export interface SectionHeadingProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** The `id` the section's `aria-labelledby` points at. */
  id?: string;
  title: React.ReactNode;
  /** A short label above the title ("How it works"). Decorative wayfinding, not the section's name. */
  kicker?: React.ReactNode;
  /** One line under the title. */
  description?: React.ReactNode;
  /** A link to more, pinned to the end on wide screens — the caller passes the locale-aware `Link`. */
  action?: React.ReactNode;
  /** Inverted colours for a section on a dark band. */
  inverse?: boolean;
  headingLevel?: "h2" | "h3";
}

/**
 * A marketing section's opening: kicker, title, an optional line of context and a "see all"
 * link. One component so every storefront section opens at the same rhythm and size.
 */
export function SectionHeading({
  id,
  title,
  kicker,
  description,
  action,
  inverse = false,
  headingLevel: Heading = "h2",
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-9", className)} {...props}>
      <div className="max-w-2xl">
        {kicker ? (
          <p
            className={cn(
              "text-xs font-bold tracking-[0.08em] uppercase",
              inverse ? "text-fg-inverse/80" : "text-primary",
            )}
          >
            {kicker}
          </p>
        ) : null}
        <Heading
          id={id}
          className={cn(
            "font-display mt-2 text-2xl leading-tight font-bold tracking-tight md:text-3xl",
            inverse && "text-fg-inverse",
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p className={cn("mt-3 text-lg", inverse ? "text-fg-inverse/75" : "text-muted")}>{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Classes for the arrow link a section heading carries ("ดูทั้งหมด →"), applied to the caller's own `Link`. */
export const sectionLinkClass =
  "text-primary hover:text-primary-hover focus-visible:ring-focus-ring group inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap outline-none focus-visible:ring-2 [&_svg]:transition-transform [&_svg]:duration-fast motion-safe:hover:[&_svg]:translate-x-0.5";
