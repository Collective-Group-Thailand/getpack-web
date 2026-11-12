"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export const LIFF_NAV_ITEMS: { key: string; href: string; icon: IconName }[] = [
  { key: "home", href: "/liff", icon: "home" },
  { key: "orders", href: "/liff/orders", icon: "package" },
  { key: "points", href: "/liff/points", icon: "star" },
  { key: "chat", href: "/liff/chat", icon: "chat" },
];

/** The tabs to show: every tab, or without points while that surface is closed. */
export const liffNavItems = (points: boolean) =>
  points ? LIFF_NAV_ITEMS : LIFF_NAV_ITEMS.filter((item) => item.key !== "points");

/**
 * LIFF's tabs (D-151): always at the bottom — LINE's in-app browser is the whole screen. Loyalty P4: without `points`
 * (`loyalty.surfaces.pointsLiff` closed for this customer) the points tab is not offered.
 */
export function LiffNav({ points = true }: { points?: boolean } = {}) {
  const t = useTranslations("liff.nav");
  const pathname = usePathname().replace(/^\/en(?=\/|$)/, "");
  return (
    <nav
      aria-label={t("label")}
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {liffNavItems(points).map((item) => {
          const current = item.href === "/liff" ? pathname === "/liff" : pathname.startsWith(item.href);
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-focus-ring flex h-14 flex-col items-center justify-center gap-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset",
                  current ? "text-primary-subtle-fg font-semibold" : "text-muted font-medium",
                )}
              >
                {/* Project D: the current tab's icon on a pale plate, as a phone's own tab bar marks it. */}
                <span
                  aria-hidden="true"
                  className={cn("rounded-control grid h-7 w-12 place-items-center", current && "bg-primary-subtle")}
                >
                  <Icon name={item.icon} size={20} />
                </span>
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
