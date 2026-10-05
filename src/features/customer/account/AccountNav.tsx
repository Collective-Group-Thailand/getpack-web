"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

const ITEMS: { key: string; href: string; icon: IconName }[] = [
  { key: "overview", href: "/account", icon: "dashboard" },
  { key: "orders", href: "/account/orders", icon: "package" },
  { key: "instalments", href: "/account/instalments", icon: "wallet" },
  { key: "quotes", href: "/account/quotes", icon: "receipt" },
  { key: "rfqs", href: "/account/rfqs", icon: "inbox" },
  { key: "samples", href: "/account/samples", icon: "package-check" },
  { key: "replenishment", href: "/account/replenishment", icon: "refresh" },
  { key: "callOffs", href: "/account/call-offs", icon: "calendar" },
  { key: "designs", href: "/account/designs", icon: "palette" },
  { key: "points", href: "/account/points", icon: "star" },
  { key: "referral", href: "/account/referral", icon: "gift" },
  { key: "wallet", href: "/account/wallet", icon: "ticket" },
  { key: "addresses", href: "/account/addresses", icon: "map-pin" },
  { key: "notifications", href: "/account/notifications", icon: "bell" },
  { key: "privacy", href: "/account/privacy", icon: "shield" },
];

/**
 * The account's sections: a column on wide screens, a row that scrolls sideways on a phone —
 * the same links, in the same order, so a customer finds each one in the same place (WCAG 3.2.3).
 */
export function AccountNav() {
  const t = useTranslations("account.nav");
  const pathname = usePathname().replace(/^\/en(?=\/|$)/, "") || "/";

  return (
    <nav aria-label={t("label")} className="lg:sticky lg:top-20 lg:self-start">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {ITEMS.map((item) => {
          const current = item.href === "/account" ? pathname === "/account" : pathname.startsWith(item.href);
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap",
                  current
                    ? "bg-primary-subtle text-primary-subtle-fg font-medium"
                    : "text-muted hover:bg-bg-subtle hover:text-fg",
                )}
              >
                <Icon name={item.icon} size={16} aria-hidden="true" />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
