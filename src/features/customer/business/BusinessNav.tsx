"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Can = {
  manageMembers: boolean;
  manageSettings: boolean;
  approveOrders: boolean;
  viewFinance: boolean;
  order: boolean;
};

const ITEMS: { key: string; href: string; icon: IconName; when?: keyof Can | (keyof Can)[] }[] = [
  { key: "overview", href: "/business", icon: "dashboard" },
  { key: "approvals", href: "/business/approvals", icon: "check" },
  { key: "reorder", href: "/business/reorder", icon: "refresh", when: "order" },
  // D-462: a member who may order sees the available credit; the full credit stays with finance roles.
  { key: "credit", href: "/business/credit", icon: "wallet", when: ["viewFinance", "order"] },
  { key: "members", href: "/business/members", icon: "users" },
  { key: "branches", href: "/business/branches", icon: "building" },
  { key: "assets", href: "/business/assets", icon: "image" },
  { key: "settings", href: "/business/settings", icon: "settings", when: "manageSettings" },
  { key: "api", href: "/business/api", icon: "key", when: "manageSettings" },
];

/**
 * The company's sections (F3 3.7), only those the member's roles open. A column on a wide screen;
 * on a phone one closed fold naming this page, like the account's menu (`AccountNav`), instead
 * of a chip strip that cut off at the third item (customer walkthrough 2026-10-16).
 */
export function BusinessNav({ can }: { can: Can }) {
  const t = useTranslations("business.nav");
  const pathname = usePathname().replace(/^\/en(?=\/|$)/, "") || "/";
  const items = ITEMS.filter(
    (item) => !item.when || (Array.isArray(item.when) ? item.when.some((key) => can[key]) : can[item.when]),
  );
  const isCurrent = (item: (typeof ITEMS)[number]) =>
    item.href === "/business" ? pathname === "/business" : pathname.startsWith(item.href);
  const currentItem = items.find(isCurrent);
  const link = (item: (typeof ITEMS)[number]) => {
    const current = isCurrent(item);
    return (
      <li key={item.key}>
        <Link
          href={item.href}
          aria-current={current ? "page" : undefined}
          className={cn(
            "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm",
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
  };
  return (
    <nav
      aria-label={t("label")}
      className="lg:border-border lg:bg-surface lg:rounded-card lg:sticky lg:top-20 lg:self-start lg:border lg:p-3"
    >
      <details className="bg-surface border-border rounded-xl border lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm [&::-webkit-details-marker]:hidden">
          <Icon name="menu" size={18} aria-hidden="true" className="text-muted" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{t("menuOpen")}</span>
            {currentItem ? (
              <span className="text-muted"> · {t("menuCurrent", { page: t(currentItem.key) })}</span>
            ) : null}
          </span>
          <Icon name="chevron-down" size={16} aria-hidden="true" className="text-muted" />
        </summary>
        <ul className="border-border flex flex-col gap-0.5 border-t px-2 pt-2 pb-3">{items.map(link)}</ul>
      </details>
      <ul className="hidden flex-col gap-1 lg:flex">{items.map(link)}</ul>
    </nav>
  );
}
