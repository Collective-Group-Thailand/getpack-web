"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { useActor } from "../console/actor";
import { usePublishDesks } from "../shell/subnav";

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
      { key: "corrections", href: "/finance/corrections", icon: "edit", anyOf: ["receivables.read"] },
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
  {
    group: "books",
    items: [
      { key: "ledger", href: "/finance/ledger", icon: "layers", anyOf: ["ledger.read"] },
      { key: "tax", href: "/finance/tax", icon: "percent", anyOf: ["tax.read"] },
      { key: "assets", href: "/finance/assets", icon: "archive", anyOf: ["fixed_assets.read"] },
    ],
  },
  {
    group: "close",
    items: [
      { key: "close", href: "/finance/close", icon: "checklist", anyOf: ["close.read"] },
      { key: "reports", href: "/finance/reports", icon: "spreadsheet", anyOf: ["ledger.read"] },
      { key: "audit", href: "/finance/audit", icon: "shield", anyOf: ["audit_support.read"] },
    ],
  },
  {
    // D-472: the management P&L — confidential, for C-Level, VP, Director and the Finance Manager only.
    group: "planning",
    items: [{ key: "pnl", href: "/finance/pnl", icon: "chart-line", anyOf: ["pnl.read"] }],
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

/**
 * The finance desks go to the main sidebar, nested and grouped under "การเงิน" (one navigation column — the second
 * sidebar squeezed every finance table). Only while the sidebar is collapsed to icons does the page carry them, as
 * one light line that scrolls sideways; a phone reaches them from the menu drawer.
 */
export function FinanceNav() {
  const t = useTranslations("finance.nav");
  const pathname = usePathname();
  const actor = useActor();
  const groups = financeDesks(actor.permissions);
  const row = useRef<HTMLElement>(null);
  const listed = usePublishDesks(
    groups.map((group) => ({
      label: t(`groups.${group.group}`),
      items: group.items.map((item) => ({
        href: item.href,
        label: t(`items.${item.key}`),
        ...(item.exact ? { exact: true } : {}),
      })),
    })),
  );

  useEffect(() => {
    const current = row.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const box = row.current;
    if (current && box && box.scrollWidth > box.clientWidth) {
      box.scrollLeft = current.offsetLeft - (box.clientWidth - current.offsetWidth) / 2;
    }
  }, [pathname]);

  if (listed) return null;
  return (
    <nav
      ref={row}
      aria-label={t("label")}
      className="relative flex [scrollbar-width:none] items-center gap-x-1 overflow-x-auto overscroll-x-contain px-4 pt-3 text-sm md:px-8 [&::-webkit-scrollbar]:hidden"
    >
      {groups
        .flatMap((group) => group.items)
        .map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-visible:ring-focus-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-inset md:min-h-8",
                active ? "text-fg font-semibold" : "text-muted hover:text-fg font-medium",
              )}
            >
              <Icon name={item.icon} size={16} className={active ? "text-primary" : undefined} aria-hidden />
              {t(`items.${item.key}`)}
            </Link>
          );
        })}
    </nav>
  );
}
