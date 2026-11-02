import { AGENT_ZONE_PATHS } from "@/features/shared/agent/zone-paths";
import type { IconName } from "@/ui/icons";

/**
 * getpack Agent's destinations (D-467, PROMPT <responsive>): the four a phone's tab bar carries — ภาพรวม ·
 * ลูกค้ามุ่งหวัง · ใบเสนอราคา · ค่าคอม, no "more" — and the rest, which the tablet rail and the desktop sidebar add.
 * The account pages (payout, tax, notifications, profile) live in the header's profile menu on every size.
 */
export type AgentNavKey =
  | "home"
  | "leads"
  | "quotes"
  | "commissions"
  | "customers"
  | "statements"
  | "payout"
  | "tax"
  | "notifications"
  | "profile";

export interface AgentNavItem {
  key: AgentNavKey;
  href: string;
  icon: IconName;
}

const item = (key: AgentNavKey, icon: IconName): AgentNavItem => ({ key, href: AGENT_ZONE_PATHS[key], icon });

/** The phone's bottom tabs: exactly four. */
export const TAB_ITEMS: readonly AgentNavItem[] = [
  item("home", "dashboard"),
  item("leads", "user-plus"),
  item("quotes", "document"),
  item("commissions", "coins"),
];

/** The tablet rail: the four, then the two lists that sit behind them on a phone. */
export const RAIL_ITEMS: readonly AgentNavItem[] = [...TAB_ITEMS, item("customers", "users"), item("statements", "receipt")];

/** The desktop sidebar, in groups. */
export const SIDEBAR_GROUPS: readonly { key: "sell" | "earn" | "account"; items: readonly AgentNavItem[] }[] = [
  { key: "sell", items: [item("home", "dashboard"), item("leads", "user-plus"), item("customers", "users"), item("quotes", "document")] },
  { key: "earn", items: [item("commissions", "coins"), item("statements", "receipt")] },
  {
    key: "account",
    items: [item("payout", "wallet"), item("tax", "calculator"), item("notifications", "bell"), item("profile", "user")],
  },
];

/** The profile menu in the header. */
export const PROFILE_MENU: readonly AgentNavItem[] = [
  item("profile", "user"),
  item("payout", "wallet"),
  item("tax", "calculator"),
  item("notifications", "bell"),
];

/** An ended agent keeps the statements and 50 ทวิ only (D-467 guard). */
export const ENDED_ITEMS: readonly AgentNavItem[] = [item("statements", "receipt")];

/** Whether `href` is the page the reader is on: `/` only itself, the rest their own subtree too. */
export function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
