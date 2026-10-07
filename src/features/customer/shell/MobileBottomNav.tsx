"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/** The five places a customer goes on a phone. Order is thumb-reach, not importance. */
const ITEMS: { key: string; href: string; icon: IconName }[] = [
  { key: "home", href: "/", icon: "home" },
  { key: "products", href: "/products", icon: "box" },
  { key: "design", href: "/studio", icon: "palette" },
  { key: "track", href: "/track", icon: "truck" },
  { key: "account", href: "/account", icon: "user" },
];

/**
 * The storefront's phone navigation (design-system.md §5: thumb-zone CTAs).
 *
 * Targets are 56 px tall — comfortably past the 24 px WCAG 2.5.8 floor and past the 44 px
 * most phones want — because this bar sits where the thumb naturally rests and a mis-tap here
 * costs someone their place in a checkout.
 */
export function MobileBottomNav() {
  const t = useTranslations("storefront.nav");
  const tTabs = useTranslations("storefront.tabs");
  const pathname = usePathname();

  return (
    <nav aria-label={t("mobile")}>
      <ul className="flex pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] whitespace-nowrap",
                  current ? "text-primary font-semibold" : "text-muted",
                )}
              >
                {/* One-line labels, the current tab on a sage-tinted control (the "Mobile — navbar" board). */}
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-control",
                    current && "bg-primary-subtle text-primary-subtle-fg",
                  )}
                >
                  <Icon name={item.icon} size={22} />
                </span>
                {tTabs(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
