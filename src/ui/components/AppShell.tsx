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
  className?: string;
}

/**
 * The page frame every zone shares: one skip link, one `<main id="main">`, landmarks in the
 * right order (design-system.md §6).
 *
 * Deliberately a server component with no state — the collapsible sidebar, command palette
 * and mobile nav behaviour arrive with the zone shells in F1. What is here is the structure
 * a11y depends on, so no screen has to remember it.
 */
export function AppShell({
  header,
  sidebar,
  bottomNav,
  footer,
  children,
  skipLabel,
  sidebarLabel,
  className,
}: AppShellProps) {
  return (
    <div className={cn("bg-bg flex min-h-dvh flex-col", className)}>
      <a href="#main" className="skip-link">
        {skipLabel}
      </a>

      {header}

      <div className="flex min-h-0 flex-1">
        {sidebar ? (
          <nav aria-label={sidebarLabel} className="border-border hidden w-60 shrink-0 border-e md:block">
            {sidebar}
          </nav>
        ) : null}

        {/*
          tabIndex={-1} so the skip link can move focus here; without it the link scrolls but
          keyboard focus stays in the header.
        */}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      {footer}

      {bottomNav ? (
        // 4rem of padding is reserved by the pages that use this, not added here, so a page
        // without a bottom nav keeps its full height.
        <div className="border-border bg-surface sticky bottom-0 border-t md:hidden">{bottomNav}</div>
      ) : null}
    </div>
  );
}
