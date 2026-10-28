import type { IconName } from "@/ui/icons";

/**
 * The account's sections (account pack Phase 1, GLOBAL-RULES §5 "Account nav labels"): nine places in two groups
 * — ภาพรวม · ซื้อ (คำสั่งซื้อ, ใบเสนอราคา, งานออกแบบ, สั่งซ้ำ) · เอกสารและบัญชี (เอกสาร, ข้อความ, คะแนนและสิทธิพิเศษ,
 * ข้อมูลบัญชี). Pages that belong together are tabs of one section; every earlier page keeps its own address and
 * is now that section's tab, so no old link breaks (งวดชำระ moved into each order; its page stays, under orders). The
 * side nav, the phone's scrolling bar, the tab bars and the header's avatar menu all read this one list.
 * Labels: `account.nav.<key>` / `account.tabs.<key>`.
 */
export type SectionKey =
  | "overview"
  | "orders"
  | "quotes"
  | "designs"
  | "reorder"
  | "documents"
  | "messages"
  | "rewards"
  | "profile"
  | "company";

export interface SectionTab {
  key: string;
  href: string;
  /** Other addresses that are this tab (a request's detail page under its list). */
  also?: readonly string[];
}

export interface AccountSection {
  key: SectionKey;
  href: string;
  icon: IconName;
  group: "top" | "buy" | "records";
  tabs?: readonly SectionTab[];
  /** Matches only `href` itself, not what is under it. */
  exact?: boolean;
  /** Other addresses that belong to this section without a tab of their own. */
  also?: readonly string[];
}

export const ACCOUNT_SECTIONS: readonly AccountSection[] = [
  { key: "overview", href: "/account", icon: "home", group: "top", exact: true },
  // งวดชำระ lives in each order and the "ต้องทำตอนนี้" list; its old page stays as the orders' instalment record.
  { key: "orders", href: "/account/orders", icon: "package", group: "buy", also: ["/account/instalments"] },
  {
    key: "quotes",
    href: "/account/quotes",
    icon: "receipt",
    group: "buy",
    tabs: [
      { key: "quotes", href: "/account/quotes" },
      { key: "rfqs", href: "/account/rfqs", also: ["/account/rfq-baskets"] },
    ],
  },
  {
    key: "designs",
    href: "/account/designs",
    icon: "edit",
    group: "buy",
    tabs: [
      { key: "designs", href: "/account/designs" },
      { key: "samples", href: "/account/samples" },
      { key: "structuralRequests", href: "/account/structural-requests" },
    ],
  },
  {
    key: "reorder",
    href: "/account/replenishment",
    icon: "refresh",
    group: "buy",
    tabs: [
      { key: "replenishment", href: "/account/replenishment" },
      { key: "callOffs", href: "/account/call-offs" },
    ],
  },
  { key: "documents", href: "/account/documents", icon: "document", group: "records" },
  { key: "messages", href: "/account/messages", icon: "chat", group: "records" },
  {
    key: "rewards",
    href: "/account/points",
    icon: "gift",
    group: "records",
    tabs: [
      { key: "points", href: "/account/points" },
      { key: "wallet", href: "/account/wallet" },
      { key: "referral", href: "/account/referral" },
      { key: "agent", href: "/account/agent" },
    ],
  },
  {
    key: "profile",
    href: "/account/addresses",
    icon: "user",
    group: "records",
    tabs: [
      { key: "addresses", href: "/account/addresses" },
      { key: "notifications", href: "/account/notifications" },
      { key: "privacy", href: "/account/privacy" },
    ],
  },
];

/** A company member's own place (round 2, B2): the company's orders, approvals, team and credit. */
export const COMPANY_SECTION: AccountSection = {
  key: "company",
  href: "/business",
  icon: "building",
  group: "records",
};

/** "ทีมและผู้อนุมัติ" — a tab of ข้อมูลบัญชี for a company member (the company approval feature exists). */
export const TEAM_TAB: SectionTab = { key: "team", href: "/business/members" };

/** The address without the `/en` prefix. */
export function plainPath(pathname: string): string {
  return pathname.replace(/^\/en(?=\/|$)/, "") || "/";
}

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** The tab that `path` is, of the sections given. */
export function tabOf(section: AccountSection, path: string): SectionTab | null {
  return section.tabs?.find((tab) => [tab.href, ...(tab.also ?? [])].some((href) => under(path, href))) ?? null;
}

/** The section that `path` belongs to, or null (a page outside the account). */
export function sectionOf(path: string, sections: readonly AccountSection[] = ACCOUNT_SECTIONS): AccountSection | null {
  const plain = plainPath(path);
  return (
    sections.find((section) =>
      section.exact
        ? plain === section.href
        : under(plain, section.href) ||
          tabOf(section, plain) !== null ||
          (section.also ?? []).some((href) => under(plain, href)),
    ) ?? null
  );
}
