import { cn } from "../lib/cn";

export interface AppShellProps {
  /** Sticky top bar: brand, primary nav, account. */
  header: React.ReactNode;
  /** Collapsible side navigation — admin and partner workspaces. */
  sidebar?: React.ReactNode;
  /** Bottom nav on phones (partner zone, customer account). */
  bottomNav?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Text of the skip link, from `src/i18n` (WCAG 2.4.1). */
  skipLabel: string;
  /** Accessible name for the sidebar's `<nav>`. */
  sidebarLabel?: string;
  /**
   * Whether the sidebar is showing icons only. The state lives with the zone shell, which is
   * the client component that owns the toggle and persists the choice; this component stays a
   * server component that only reacts to it.
   */
  sidebarCollapsed?: boolean;
  /**
   * Reserve room at the bottom for the mobile nav. Off by default so a page without one keeps
   * its full height — the old comment asked each page to do this itself, which every page
   * then had to remember.
   */
  reserveBottomNavSpace?: boolean;
  className?: string;
  /** The sidebar column's own surface (a zone that sets it apart from the page, e.g. white on paper). */
  sidebarClassName?: string;
}

/**
 * The page frame every zone shares: one skip link, one `<main id="main">`, landmarks in the
 * right order (design-system.md §6).
 *
 * Still a server component with no state of its own. The collapse *toggle* and the ⌘K palette
 * are client components the zone shells own and pass in — keeping this one on the server is
 * what stops every page in all three zones from becoming a client tree.
 */
export function AppShell({
  header,
  sidebar,
  bottomNav,
  footer,
  children,
  skipLabel,
  sidebarLabel,
  sidebarCollapsed = false,
  reserveBottomNavSpace = false,
  className,
  sidebarClassName,
}: AppShellProps) {
  return (
    <div className={cn("bg-bg flex min-h-dvh flex-col", className)}>
      <a href="#main" className="skip-link">
        {skipLabel}
      </a>

      {header}

      <div className="flex min-h-0 flex-1">
        {sidebar ? (
          <nav
            aria-label={sidebarLabel}
            className={cn(
              "border-border hidden shrink-0 border-e md:block",
              sidebarClassName,
              // A width transition rather than a display swap, so the collapse reads as one
              // movement and nothing below it jumps.
              "motion-safe:duration-slow motion-safe:transition-[width]",
              sidebarCollapsed ? "w-16" : "w-60",
            )}
          >
            {/* Sticky under the topbar, so a long queue scrolls without taking the nav away. */}
            <div className="sticky top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto py-3">{sidebar}</div>
          </nav>
        ) : null}

        {/*
          tabIndex={-1} so the skip link can move focus here; without it the link scrolls but
          keyboard focus stays in the header.
        */}
        <main id="main" tabIndex={-1} className={cn("min-w-0 flex-1", reserveBottomNavSpace && "pb-16 md:pb-0")}>
          {children}
        </main>
      </div>

      {footer}

      {bottomNav ? (
        <div className="border-border bg-surface z-sticky fixed inset-x-0 bottom-0 border-t md:hidden">{bottomNav}</div>
      ) : null}
    </div>
  );
}
