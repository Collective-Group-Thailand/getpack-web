import { cn } from "@/ui/lib/cn";

/**
 * How a record page's next-steps panel orders its actions: the first constructive action leads (the one filled
 * button of the panel), the other constructive ones follow outlined, anything destructive comes last. Pure, so the
 * partner documents' `ActionBar` and the admin `NextActionBar` order a panel the same way.
 */
export function panelOrder<T>(
  actions: readonly T[],
  { isPrimary, isDestructive }: { isPrimary: (action: T) => boolean; isDestructive: (action: T) => boolean },
): { lead: T | undefined; rest: T[]; destructive: T[] } {
  const lead = actions.find((action) => isPrimary(action) && !isDestructive(action));
  return {
    lead,
    rest: actions.filter((action) => action !== lead && !isDestructive(action)),
    destructive: actions.filter((action) => isDestructive(action)),
  };
}

/**
 * The stack of a next-steps panel: full-width buttons one under the other (`data-fill="row"` lets the desk density
 * rules widen them), the lead first.
 */
export function ActionStack({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-fill="row" className={cn("flex flex-col gap-2", className)}>
      {children}
    </div>
  );
}
