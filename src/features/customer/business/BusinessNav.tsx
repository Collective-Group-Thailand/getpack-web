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
  { key: "api", href: "/business/api", icon: "key", when: "manageSettings" },
];

/**
 * The company's sections (F3 3.7), only those the member's roles open. Project C: the same frame as the account
 * menu (`AccountNav`) so the two read as one product — on a wide screen a sticky column headed by the company (its
 * name and the member's roles) with what waits for approval as a count; on a phone and tablet one scrolling bar
 * under the site header, the current section scrolled into view.
 */
export function BusinessNav({
  can,
  company,
  pending = 0,
}: {
  can: Can;
  company?: { name: string; roles: string };
  /** Approvals waiting, shown beside รออนุมัติ. */
  pending?: number;
}) {
  const t = useTranslations("business.nav");
  const pathname = usePathname().replace(/^\/en(?=\/|$)/, "") || "/";
  const items = ITEMS.filter((item) => !item.when || can[item.when]);
  const isCurrent = (item: (typeof ITEMS)[number]) =>
    item.href === "/business" ? pathname === "/business" : pathname.startsWith(item.href);
  const link = (item: (typeof ITEMS)[number], bar: boolean) => {
    const current = isCurrent(item);
    const badge = item.key === "approvals" ? pending : 0;
    return (
      <li key={item.key} className={bar ? "shrink-0" : undefined}>
        <Link
          href={item.href}
          aria-current={current ? "page" : undefined}
          ref={
            bar && current
              ? (node: HTMLAnchorElement | null) => node?.scrollIntoView({ block: "nearest", inline: "center" })
              : undefined
          }
          className={cn(
            "rounded-control flex min-h-10 items-center gap-2.5 text-sm whitespace-nowrap transition-colors",
            bar ? "px-3" : "px-2.5 text-[0.90625rem]",
            current
              ? "bg-surface text-fg shadow-card font-semibold"
              : "text-muted hover:bg-bg-subtle hover:text-fg font-medium",
          )}
        >
          <Icon name={item.icon} size={18} aria-hidden="true" />
          <span className={cn(!bar && "min-w-0 flex-1 truncate")}>{t(item.key)}</span>
          {badge > 0 ? (
            <span className="bg-warning-subtle text-warning-subtle-fg grid h-[1.375rem] min-w-[1.375rem] place-items-center rounded-full px-1.5 text-[0.71875rem] font-semibold tabular-nums">
              {badge}
            </span>
          ) : null}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label={t("label")} className="lg:sticky lg:top-[calc(var(--site-sticky-top)+1.75rem)] lg:self-start">
      <ul className="border-border -mx-5 flex [scrollbar-width:none] gap-1 overflow-x-auto border-b px-5 pb-2 md:-mx-8 md:px-8 lg:hidden [&::-webkit-scrollbar]:hidden">
        {items.map((item) => link(item, true))}
      </ul>
      <div className="hidden lg:flex lg:flex-col">
        {company ? (
          <div className="border-border mb-2 flex items-center gap-3 border-b px-2 pt-1.5 pb-3.5">
            <span
              aria-hidden="true"
              className="bg-primary-subtle text-primary-subtle-fg grid size-10 shrink-0 place-items-center rounded-lg"
            >
              <Icon name="building" size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{company.name}</p>
              <p className="text-muted truncate text-[0.78125rem]">{company.roles}</p>
            </div>
          </div>
        ) : null}
        <ul className="flex flex-col gap-0.5">{items.map((item) => link(item, false))}</ul>
      </div>
    </nav>
  );
}
