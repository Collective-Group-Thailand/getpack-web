import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface DisclosureItem {
  /** A stable anchor, so a question can be linked to (`/faq#minimum-order`). */
  id?: string;
  summary: React.ReactNode;
  content: React.ReactNode;
}

export interface DisclosureListProps {
  items: readonly DisclosureItem[];
  /** The summary's heading level, when the questions belong in the page outline. */
  headingLevel?: "h3" | "h4";
  className?: string;
}

/**
 * Questions and answers, each one opens in place — native `<details>`/`<summary>`: keyboard
 * and screen-reader behaviour for free, no JavaScript, and the answers are in the HTML for a
 * crawler (and for the page's `FAQPage` markup to be honest about).
 */
export function DisclosureList({ items, headingLevel: Heading, className }: DisclosureListProps) {
  return (
    <div className={cn("divide-border border-border divide-y rounded-xl border", className)}>
      {items.map((item, index) => (
        <details key={item.id ?? index} id={item.id} className="group">
          <summary className="focus-visible:ring-focus-ring flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3 font-medium outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
            {Heading ? (
              <Heading className="text-base font-medium">{item.summary}</Heading>
            ) : (
              <span>{item.summary}</span>
            )}
            <Icon
              name="chevron-down"
              size={18}
              aria-hidden="true"
              className="text-muted mt-1 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="text-muted px-4 pb-4 leading-relaxed">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
