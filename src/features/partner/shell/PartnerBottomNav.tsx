"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

const ITEMS: { key: string; href: string; icon: IconName }[] = [
  { key: "today", href: "/", icon: "home" },
  { key: "jobs", href: "/jobs", icon: "factory" },
  { key: "ship", href: "/ship", icon: "truck" },
  { key: "billing", href: "/billing", icon: "wallet" },
];

/**
 * Shop-floor navigation (design-system.md §5 Partner).
 *
 * 64 px targets, not the 48 px minimum: this is used standing up, one-handed, sometimes in
 * gloves, on a phone that may be dusty. The extra height costs nothing on a screen with four
 * destinations and is the difference between a tap and three taps.
 *
 * F5 builds the screens behind these; F1 owes the frame, the targets and the a11y.
 */
export function PartnerBottomNav() {
  const t = useTranslations("partner.nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")}>
      <ul className="flex">
        {ITEMS.map((item) => {
          const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  current ? "text-primary" : "text-muted",
                )}
              >
                <Icon name={item.icon} size={24} />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
