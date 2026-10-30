import { cn } from "../lib/cn";

/**
 * A phone's bottom action bar (Project A): the page's one primary action, fixed above the storefront's tab bar
 * (`--mobile-tab-h`) below `md` — the same place and paper as the product page's buy bar. The page leaves room for
 * it (`body:has([data-mobile-bar])` in base.css) and the LINE button lifts over it, so it covers nothing.
 */
export function MobileActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      data-mobile-bar=""
      className={cn(
        "border-border bg-surface z-sticky shadow-overlay fixed inset-x-0 bottom-(--mobile-tab-h) border-t px-4 py-2.5 md:hidden print:hidden",
        "[&_a]:w-full [&_button]:w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}
