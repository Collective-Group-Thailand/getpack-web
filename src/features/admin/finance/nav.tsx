"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { useActor } from "../console/actor";

interface NavItem {
  key: string;
  href: string;
  icon: IconName;
  /** Shown to anyone holding one of these (the API still decides every read). */
  anyOf: readonly string[];
  exact?: boolean;
}

/**
 * The finance workspace's desks, grouped the way the work flows (F6): today's queues, the
 * customer side, the supplier side, banking, the books, and close & audit. A desk whose
 * permissions this person holds none of is not offered; each later deliverable adds its desks.
 */
export const FINANCE_NAV: readonly { group: string; items: readonly NavItem[] }[] = [
  {
    group: "daily",
    items: [
      { key: "home", href: "/finance", icon: "dashboard", anyOf: [], exact: true },
      { key: "slips", href: "/finance/slips", icon: "receipt", anyOf: ["payments.verify_slip", "payments.read"] },
      { key: "payments", href: "/finance/payments", icon: "credit-card", anyOf: ["payments.read"] },
      { key: "refunds", href: "/finance/refunds", icon: "reset", anyOf: ["payments.read"] },
    ],
  },
  {
    group: "customers",
    items: [
      { key: "documents", href: "/finance/documents", icon: "document", anyOf: ["receivables.read"] },
      { key: "creditNotes", href: "/finance/credit-notes", icon: "file-check", anyOf: ["receivables.read"] },
      { key: "receivables", href: "/finance/receivables", icon: "coins", anyOf: ["receivables.read"] },
    ],
  },
  {
    group: "suppliers",
    items: [
      { key: "payables", href: "/finance/payables", icon: "factory", anyOf: ["payables.read"] },
      { key: "payouts", href: "/finance/payouts", icon: "wallet", anyOf: ["payables.read"] },
    ],
  },
  {
    group: "banking",
    items: [{ key: "banking", href: "/finance/banking", icon: "building", anyOf: ["banking.read"] }],
  },
];

/** Whether a person may open at least one desk — the finance menu entry's rule. */
export function financeDesks(permissions: readonly string[]) {
  return FINANCE_NAV.map((group) => ({
    group: group.group,
    items: group.items.filter((item) => item.anyOf.length === 0 || item.anyOf.some((p) => permissions.includes(p))),
  })).filter((group) => group.items.length > 0);
}

const isActive = (item: NavItem, pathname: string) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

export function FinanceNav() {
  const t = useTranslations("finance.nav");
  const pathname = usePathname();
  const actor = useActor();
  const groups = financeDesks(actor.permissions);
  const row = useRef<HTMLUListElement>(null);

  // On a phone the desks are one scrolling row: keep the current one in view.
  useEffect(() => {
    row.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav aria-label={t("label")} className="lg:w-52 lg:shrink-0">
      {/* A phone gets one scrolling row; a desk-sized screen a grouped column beside the work. */}
      <ul ref={row} className="border-border flex gap-1 overflow-x-auto border-b px-4 pb-px lg:hidden">
        {groups
          .flatMap((group) => group.items)
          .map((item) => (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isActive(item, pathname) ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                  isActive(item, pathname) ? "border-primary text-fg" : "text-muted hover:text-fg border-transparent",
                )}
              >
                <Icon name={item.icon} size={16} aria-hidden />
                {t(`items.${item.key}`)}
              </Link>
            </li>
          ))}
      </ul>
      <div className="hidden flex-col gap-5 py-6 ps-4 lg:flex">
        {groups.map((group) => (
          <div key={group.group}>
            <p className="text-muted mb-1 px-3 text-xs font-medium">{t(`groups.${group.group}`)}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item, pathname) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                      isActive(item, pathname)
                        ? "bg-primary-subtle text-primary-subtle-fg font-medium"
                        : "text-muted hover:bg-surface-subtle hover:text-fg",
                    )}
                  >
                    <Icon name={item.icon} size={16} aria-hidden />
                    {t(`items.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
