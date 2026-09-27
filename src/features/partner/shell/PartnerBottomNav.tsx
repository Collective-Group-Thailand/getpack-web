"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { isCurrent, type PartnerNavItem } from "./nav";

/**
 * Shop-floor navigation (design-system.md §5 Partner).
 *
 * 64 px targets, not the 48 px minimum: this is used standing up, one-handed, sometimes in
 * gloves, on a phone that may be dusty. The extra height costs nothing on a screen with at most
 * five destinations and is the difference between a tap and three taps.
 *
 * `variant="side"` is the same list for tablets and office screens, where the bottom bar is
 * hidden: a column beside the page instead of a row under the thumb. Only one of the two is
 * ever displayed, so a screen reader meets one navigation landmark.
 */
export function PartnerBottomNav({
  items,
  variant = "bottom",
}: {
  items: PartnerNavItem[];
  variant?: "bottom" | "side";
}) {
  const t = useTranslations("partner.nav");
  const pathname = usePathname();
  const bottom = variant === "bottom";

  const list = (
    <ul className={bottom ? "flex" : "flex flex-col gap-1 px-2"}>
      {items.map((item) => {
        const current = isCurrent(item.href, pathname);
        return (
          <li key={item.key} className={bottom ? "flex-1" : undefined}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                bottom
                  ? "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium"
                  : "flex h-12 items-center gap-3 rounded-md px-3 font-medium",
                bottom && (current ? "text-primary" : "text-muted"),
                !bottom && (current ? "bg-primary/10 text-primary" : "text-fg hover:bg-surface-subtle"),
              )}
            >
              <Icon name={item.icon} size={24} />
              {t(item.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
  // The side list sits inside AppShell's own `<nav>`; the bottom bar is its own landmark.
  return bottom ? <nav aria-label={t("label")}>{list}</nav> : list;
}
