import { cn } from "@/ui/lib/cn";

/**
 * A record page with one thing to do next (a job, a shipment, a claim): the record on the left, the
 * next action in a panel on the right that stays in view while the record scrolls. On a phone and a
 * tablet the panel comes first — the person on the floor opens the page to do that one thing.
 */
export function DetailLayout({ aside, children }: { aside: React.ReactNode; children: React.ReactNode }) {
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
