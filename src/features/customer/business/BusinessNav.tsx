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

const ITEMS: { key: string; href: string; icon: IconName; when?: keyof Can }[] = [
  { key: "overview", href: "/business", icon: "dashboard" },
  { key: "approvals", href: "/business/approvals", icon: "check" },
  { key: "reorder", href: "/business/reorder", icon: "refresh", when: "order" },
  { key: "credit", href: "/business/credit", icon: "wallet", when: "viewFinance" },
  { key: "members", href: "/business/members", icon: "users" },
  { key: "branches", href: "/business/branches", icon: "building" },
  { key: "assets", href: "/business/assets", icon: "image" },
  { key: "settings", href: "/business/settings", icon: "settings", when: "manageSettings" },
];

/** The company's sections (F3 3.7), only those the member's roles open. */
export function BusinessNav({ can }: { can: Can }) {
  const t = useTranslations("business.nav");
  const pathname = usePathname().replace(/^\/en(?=\/|$)/, "") || "/";
  return (
    <nav aria-label={t("label")} className="lg:sticky lg:top-20 lg:self-start">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {ITEMS.filter((item) => !item.when || can[item.when]).map((item) => {
          const current = item.href === "/business" ? pathname === "/business" : pathname.startsWith(item.href);
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
