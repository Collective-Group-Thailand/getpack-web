"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { SignOutButton } from "@/features/shared/auth/SignOutButton";
import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/** What the member's company roles open (`CompanyDto.can`) — only the parts this nav reads. */
export interface AccountCompany {
  name: string;
  can: {
    approveOrders: boolean;
    viewFinance: boolean;
    manageMembers: boolean;
    manageSettings: boolean;
    order: boolean;
  };
  /** Orders waiting for this member's decision, when they approve. */
  pendingApprovals: number;
}

interface Item {
  key: string;
  href: string;
  icon: IconName;
  /** Matches only this path, not what is under it (`/business` is not every business page). */
  exact?: boolean;
  badge?: number;
  /** The label's namespace: the account's own, or the business pages'. */
  ns?: "business";
}

interface Group {
  key: "orders" | "work" | "company" | "account";
  items: Item[];
}

function groupsFor(company: AccountCompany | null): Group[] {
  const groups: Group[] = [
    {
      key: "orders",
      items: [
        { key: "orders", href: "/account/orders", icon: "package" },
        { key: "instalments", href: "/account/instalments", icon: "wallet" },
        { key: "quotes", href: "/account/quotes", icon: "receipt" },
        { key: "rfqs", href: "/account/rfqs", icon: "inbox" },
        { key: "messages", href: "/account/messages", icon: "chat" },
      ],
    },
    {
      key: "work",
      items: [
        { key: "designs", href: "/account/designs", icon: "palette" },
        { key: "samples", href: "/account/samples", icon: "package-check" },
        { key: "structuralRequests", href: "/account/structural-requests", icon: "ruler" },
        { key: "replenishment", href: "/account/replenishment", icon: "refresh" },
        { key: "callOffs", href: "/account/call-offs", icon: "calendar" },
      ],
    },
  ];
  if (company) {
    const { can } = company;
    groups.push({
      key: "company",
      items: [
        ...(can.approveOrders
          ? [{ key: "approvals", href: "/business/approvals", icon: "check" as const, badge: company.pendingApprovals }]
          : []),
        { key: "companyOrders", href: "/business", icon: "building", exact: true },
        ...(can.order
          ? [{ key: "reorder", href: "/business/reorder", icon: "refresh" as const, ns: "business" as const }]
          : []),
        ...(can.viewFinance
          ? [{ key: "credit", href: "/business/credit", icon: "wallet" as const, ns: "business" as const }]
          : []),
        { key: "members", href: "/business/members", icon: "users", ns: "business" },
        ...(can.manageSettings
          ? [{ key: "settings", href: "/business/settings", icon: "settings" as const, ns: "business" as const }]
          : []),
      ],
    });
  }
  groups.push({
    key: "account",
    items: [
      { key: "addresses", href: "/account/addresses", icon: "map-pin" },
      { key: "points", href: "/account/points", icon: "star" },
      { key: "wallet", href: "/account/wallet", icon: "ticket" },
      { key: "referral", href: "/account/referral", icon: "gift" },
      { key: "agent", href: "/account/agent", icon: "handshake" },
      { key: "notifications", href: "/account/notifications", icon: "bell" },
      { key: "privacy", href: "/account/privacy", icon: "shield" },
    ],
  });
  return groups;
}

/**
 * The account's sections in four groups — คำสั่งซื้อ · งานของฉัน · บริษัทของฉัน (only for a company
 * member, round 2 B2) · บัญชี — under the overview, with sign-out last (B9). A column on wide
 * screens; on a phone one closed fold naming this page, with every section inside it. Same
 * links, same order, on both (WCAG 3.2.3).
 */
export function AccountNav({ company = null }: { company?: AccountCompany | null }) {
  const t = useTranslations("account.nav");
  const tBusiness = useTranslations("business.nav");
  const pathname = usePathname().replace(/^\/en(?=\/|$)/, "") || "/";
  const isCurrent = (item: Item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));
  const groups = groupsFor(company);

  const link = (item: Item) => {
    const current = isCurrent(item);
    return (
      <li key={item.key}>
        <Link
          href={item.href}
          aria-current={current ? "page" : undefined}
          className={cn(
            "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm",
            // The open section is a filled row with a bar at its start, not a tint alone — on
            // the page's own surface a tint was all that told it apart (owner feedback 2026-10-14).
            current
              ? "bg-primary-subtle text-primary-subtle-fg border-primary border-s-[3px] ps-2.5 font-semibold"
              : "text-muted hover:bg-bg-subtle hover:text-fg",
          )}
        >
          <Icon name={item.icon} size={16} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{item.ns === "business" ? tBusiness(item.key) : t(item.key)}</span>
          {item.badge ? (
            <span className="bg-warning-subtle text-warning-subtle-fg rounded-control px-2 text-xs font-semibold tabular-nums">
              {item.badge}
              <span className="sr-only"> {t("waiting")}</span>
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  const overview: Item = { key: "overview", href: "/account", icon: "dashboard", exact: true };
  const currentItem = [overview, ...groups.flatMap((group) => group.items)].find(isCurrent) ?? null;
  const labelOf = (item: Item) => (item.ns === "business" ? tBusiness(item.key) : t(item.key));
  const groupTitle = (group: Group) =>
    group.key === "company" && company ? t("groups.companyNamed", { name: company.name }) : t(`groups.${group.key}`);
  const badges = groups.flatMap((group) => group.items).reduce((sum, item) => sum + (item.badge ?? 0), 0);

  return (
    <nav
      aria-label={t("label")}
      // Its own panel on a wide screen, so it reads as the account's menu rather than as text
      // floating at the page's edge.
      className="lg:border-border lg:bg-surface lg:rounded-card lg:sticky lg:top-20 lg:self-start lg:border lg:p-3"
    >
      {/*
        A phone: one fold, closed, naming this page — the page's own content starts right under
        it. Opened, every section with its links, in the same order as the wide screen's column
        (WCAG 3.2.3). Before, four folded groups and the open one stood above every page, and
        "คำสั่งซื้อของฉัน" began below the fold (customer walkthrough 2026-10-16).
      */}
      <details className="bg-surface border-border rounded-xl border lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm [&::-webkit-details-marker]:hidden">
          <Icon name="menu" size={18} aria-hidden="true" className="text-muted" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{t("menuOpen")}</span>
            {currentItem ? (
              <span className="text-muted"> · {t("menuCurrent", { page: labelOf(currentItem) })}</span>
            ) : null}
          </span>
          {badges ? (
            <span className="bg-warning-subtle text-warning-subtle-fg rounded-control px-2 text-xs font-semibold">
              {badges}
              <span className="sr-only"> {t("waiting")}</span>
            </span>
          ) : null}
          <Icon name="chevron-down" size={16} aria-hidden="true" className="text-muted" />
        </summary>
        <div className="border-border border-t px-2 pt-2 pb-3">
          <ul className="flex flex-col gap-0.5">{link(overview)}</ul>
          {groups.map((group) => (
            <div key={group.key} className="mt-3">
              <p className="text-muted px-3 pb-1 text-xs font-semibold">{groupTitle(group)}</p>
              <ul className="flex flex-col gap-0.5">{group.items.map(link)}</ul>
            </div>
          ))}
          <div className="border-border mt-3 border-t pt-2">
            <SignOutButton zone="customer" variant="ghost" />
          </div>
        </div>
      </details>

      {/* Wide screens: the column. */}
      <div className="hidden lg:block">
        <ul className="flex flex-col gap-1">{link(overview)}</ul>
        {groups.map((group) => (
          <div key={group.key} className="mt-4">
            <p className="text-muted px-3 pb-1 text-xs font-semibold">{groupTitle(group)}</p>
            <ul className="flex flex-col gap-0.5">{group.items.map(link)}</ul>
          </div>
        ))}
        <div className="border-border mt-4 border-t pt-3">
          <SignOutButton zone="customer" variant="ghost" />
        </div>
      </div>
    </nav>
  );
}
