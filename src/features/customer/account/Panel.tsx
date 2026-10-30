import { cn } from "@/ui/lib/cn";

/**
 * One block of an account detail page (Project B3): a bordered card with its heading and, at the heading's
 * end, its actions. `tint` puts the block that asks something of the customer on the pale primary tint.
 */
export function Panel({
  id,
  title,
  actions,
  tint = false,
  className,
  children,
}: {
  /** The heading's id, so the section is named by it. */
  id: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
  tint?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-card min-w-0 border p-4 sm:p-5",
        tint ? "bg-primary-subtle border-transparent" : "border-border bg-surface",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className={cn("text-lg font-semibold", tint && "text-primary-subtle-fg")}>
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
