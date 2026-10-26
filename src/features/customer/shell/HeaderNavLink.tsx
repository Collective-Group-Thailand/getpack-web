"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/ui/lib/cn";

/** Whether `pathname` (locale prefix already removed) is `href` or sits under it. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * A primary-nav link that knows whether it is the current section: `aria-current="page"` and the
 * prototype's tinted pill. The only client part of the bar's links — the bar itself stays a
 * server component.
 */
export function HeaderNavLink({ href, className, children }: { href: string; className?: string; children: string }) {
  const active = isActivePath(usePathname(), href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(className, active && "bg-bg-subtle text-fg")}
    >
      {children}
    </Link>
  );
}
