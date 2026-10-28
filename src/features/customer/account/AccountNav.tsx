"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { SignOutButton } from "@/features/shared/auth/SignOutButton";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/ui/components/Avatar";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { ACCOUNT_SECTIONS, type AccountSection, COMPANY_SECTION, plainPath, sectionOf } from "./sections";

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

/** The header block's figures, each from its own read (null when that read failed). */
export interface AccountMe {
  name: string | null;
  /** Display strings, formatted by the server (`format.number`, `format.thb`). */
  points: string | null;
  credit: string | null;
}

/**
 * The account's menu (account pack Phase 1): who is signed in and their points and store credit, then nine
 * sections in two groups — ภาพรวม · ซื้อ · เอกสารและบัญชี — with sign-out last. "คำสั่งซื้อ" carries how many orders
 * wait for the customer (`store.orders.tabCounts().todo`). A company member also gets "บริษัทของฉัน" with the orders
 * waiting for their approval. Wide screens: a sticky column. Phones and tablets: one horizontally scrolling bar
 * under the site header — the same links in the same order (WCAG 3.2.3), the current one scrolled into view.
 */
export function AccountNav({
  me,
  todo = 0,
  company = null,
}: {
  me: AccountMe;
  todo?: number;
  company?: AccountCompany | null;
}) {
  const t = useTranslations("account.nav");
  const path = plainPath(usePathname());
  const sections = company ? [...ACCOUNT_SECTIONS, COMPANY_SECTION] : ACCOUNT_SECTIONS;
  const current = sectionOf(path, sections);
  const badgeOf = (section: AccountSection) =>
    section.key === "orders" ? todo : section.key === "company" ? (company?.pendingApprovals ?? 0) : 0;
  const labelOf = (section: AccountSection) =>
    section.key === "company" && company ? t("companyNamed", { name: company.name }) : t(section.key);

  const item = (section: AccountSection, bar: boolean) => {
    const active = current?.key === section.key;
    const badge = badgeOf(section);
    return (
      <li key={section.key} className={bar ? "shrink-0" : undefined}>
        <Link
          href={section.href}
          aria-current={active ? "page" : undefined}
          ref={
            bar && active
              ? (node: HTMLAnchorElement | null) => node?.scrollIntoView({ block: "nearest", inline: "center" })
              : undefined
          }
          className={cn(
            "flex items-center gap-2.5 rounded-[10px] text-sm whitespace-nowrap transition-colors",
            bar ? "min-h-10 px-3" : "min-h-10 px-2.5 text-[0.90625rem]",
            active
              ? "bg-surface text-fg shadow-card font-semibold"
              : "text-muted hover:bg-bg-subtle hover:text-fg font-medium",
          )}
        >
          <Icon name={section.icon} size={18} aria-hidden="true" />
          <span className={cn(!bar && "min-w-0 flex-1 truncate")}>{labelOf(section)}</span>
          {badge > 0 ? (
            <span
              className={cn(
                "grid h-[1.375rem] min-w-[1.375rem] place-items-center rounded-full px-1.5 text-[0.71875rem] font-semibold tabular-nums",
                section.key === "orders" ? "bg-primary text-primary-fg" : "bg-warning-subtle text-warning-subtle-fg",
              )}
            >
              {badge}
              <span className="sr-only"> {t("waiting")}</span>
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  const group = (key: AccountSection["group"]) => sections.filter((section) => section.group === key);

  return (
    <nav aria-label={t("label")} className="lg:sticky lg:top-24 lg:self-start">
      {/* Phones and tablets: one scrolling bar, under the site header. */}
      <ul className="border-border -mx-5 flex [scrollbar-width:none] gap-1 overflow-x-auto border-b px-5 pb-2 md:-mx-8 md:px-8 lg:hidden [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => item(section, true))}
      </ul>

      {/* Wide screens: the column. */}
      <div className="hidden lg:flex lg:flex-col">
        <div className="border-border mb-2 flex items-center gap-3 border-b px-2 pt-1.5 pb-3.5">
          {me.name ? <Avatar name={me.name} size="lg" /> : null}
          <div className="min-w-0">
            {me.name ? <p className="truncate font-semibold">{me.name}</p> : null}
            {me.points !== null || me.credit !== null ? (
              <p className="text-muted text-[0.78125rem] tabular-nums">
                {[me.points !== null ? t("me.points", { points: me.points }) : null, me.credit]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
        <ul className="flex flex-col gap-0.5">{group("top").map((section) => item(section, false))}</ul>
        <p className="text-muted px-2.5 pt-3.5 pb-1 text-[0.6875rem] font-semibold tracking-[0.06em]">
          {t("groups.buy")}
        </p>
        <ul className="flex flex-col gap-0.5">{group("buy").map((section) => item(section, false))}</ul>
        <p className="text-muted px-2.5 pt-3.5 pb-1 text-[0.6875rem] font-semibold tracking-[0.06em]">
          {t("groups.records")}
        </p>
        <ul className="flex flex-col gap-0.5">{group("records").map((section) => item(section, false))}</ul>
        <div className="mt-2.5">
          <SignOutButton zone="customer" variant="ghost" />
        </div>
      </div>
    </nav>
  );
}
