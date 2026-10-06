import type { IconName } from "@/ui/icons";

/**
 * The partner sidebar (round 2, Phase 1; the audit's "Sidebar ของ partner" IA table): what used to
 * hide behind "เพิ่มเติม" in four groups — งานประจำวัน · แผนและกำลังผลิต · การเงิน · โรงงาน — and,
 * of those, only what the user's roles at this factory work with. "เพิ่มเติม" stays on a phone,
 * where the bottom bar has five places.
 */
export type SidebarGroupKey = "daily" | "plan" | "finance" | "factory";

export type SidebarItemKey =
  | "today"
  | "onboarding"
  | "jobs"
  | "qc"
  | "samples"
  | "ship"
  | "claims"
  | "capacity"
  | "hours"
  | "billing"
  | "payouts"
  | "prices"
  | "shippingRates"
  | "performance"
  | "styleIntakes"
  | "requests"
  | "knowledge"
  | "settings";

export interface SidebarItem {
  key: SidebarItemKey;
  href: string;
  icon: IconName;
}

export interface SidebarGroup {
  key: SidebarGroupKey;
  items: SidebarItem[];
}

const ITEMS: Record<SidebarItemKey, SidebarItem & { group: SidebarGroupKey; permission?: string }> = {
  today: { key: "today", href: "/", icon: "home", group: "daily" },
  onboarding: { key: "onboarding", href: "/onboarding", icon: "checklist", group: "daily" },
  jobs: { key: "jobs", href: "/jobs", icon: "factory", group: "daily", permission: "factory_jobs.read" },
  qc: { key: "qc", href: "/qc", icon: "clipboard-check", group: "daily", permission: "factory_qc.record" },
  samples: {
    key: "samples",
    href: "/samples",
    icon: "package-check",
    group: "daily",
    permission: "factory_samples.record_evidence",
  },
  ship: { key: "ship", href: "/ship", icon: "truck", group: "daily", permission: "factory_shipments.read" },
  claims: { key: "claims", href: "/claims", icon: "shield-alert", group: "daily", permission: "factory_claims.read" },
  capacity: {
    key: "capacity",
    href: "/capacity",
    icon: "calendar",
    group: "plan",
    permission: "factory_capacity.read",
  },
  hours: { key: "hours", href: "/settings/hours", icon: "clock", group: "plan", permission: "factory_capacity.manage" },
  billing: { key: "billing", href: "/billing", icon: "wallet", group: "finance", permission: "factory_payables.read" },
  payouts: { key: "payouts", href: "/payouts", icon: "coins", group: "finance", permission: "factory_payables.read" },
  prices: { key: "prices", href: "/prices", icon: "receipt", group: "finance", permission: "factory_prices.read" },
  shippingRates: {
    key: "shippingRates",
    href: "/prices/shipping",
    icon: "route",
    group: "finance",
    permission: "factory_prices.read",
  },
  performance: {
    key: "performance",
    href: "/performance",
    icon: "chart-line",
    group: "factory",
    permission: "factory_scorecard.read",
  },
  styleIntakes: {
    key: "styleIntakes",
    href: "/style-intakes",
    icon: "upload",
    group: "factory",
    permission: "factory_style_intakes.submit",
  },
  requests: { key: "requests", href: "/requests", icon: "send", group: "factory" },
  knowledge: { key: "knowledge", href: "/knowledge", icon: "article", group: "factory" },
  // Everyone's own notifications live there too; users and the factory's profile only for whom may manage them.
  settings: { key: "settings", href: "/settings", icon: "settings", group: "factory" },
};

/** What each role works with, from the audit's IA table; the owner has everything. */
/** Every role: the guide, a request to Packio, and their own settings (notifications). */
const EVERYONE: readonly SidebarItemKey[] = ["knowledge", "requests", "settings"];

const ROLE_ITEMS: Record<string, readonly SidebarItemKey[]> = {
  factory_owner: Object.keys(ITEMS) as SidebarItemKey[],
  factory_planner: ["today", "jobs", "capacity", "hours", ...EVERYONE],
  factory_operator: ["today", "jobs", ...EVERYONE],
  // QC and shipping open on their own queue (`/qc`, `/ship`): "งานวันนี้" would lead back to it.
  factory_qc: ["qc", "samples", "claims", ...EVERYONE],
  factory_shipping: ["ship", ...EVERYONE],
  factory_accountant: ["today", "billing", "payouts", "prices", "shippingRates", "performance", ...EVERYONE],
};

const GROUP_ORDER: SidebarGroupKey[] = ["daily", "plan", "finance", "factory"];

const itemOf = (key: SidebarItemKey): SidebarItem => ({ key, href: ITEMS[key].href, icon: ITEMS[key].icon });

/** A factory still being onboarded has no floor yet: its wizard, its prices and the guides. */
const ONBOARDING: readonly SidebarItemKey[] = ["today", "onboarding", "prices", "requests", "knowledge", "settings"];

const isOnboarding = (status: string | undefined) => status === "applied" || status === "under_review";

/** The items this user's roles at this factory open, in the IA order; a role it does not know opens by permission. */
export function sidebarItems(
  status: string | undefined,
  roles: readonly string[],
  can: (permission: string) => boolean,
): SidebarItemKey[] {
  const known = roles.filter((role) => role in ROLE_ITEMS);
  const wanted = isOnboarding(status)
    ? new Set(ONBOARDING)
    : known.length
      ? new Set(known.flatMap((role) => ROLE_ITEMS[role]!))
      : new Set(Object.keys(ITEMS) as SidebarItemKey[]);
  if (!isOnboarding(status)) wanted.delete("onboarding");
  return (Object.keys(ITEMS) as SidebarItemKey[]).filter((key) => {
    const permission = ITEMS[key].permission;
    return wanted.has(key) && (!permission || can(permission));
  });
}

export function partnerSidebar(
  status: string | undefined,
  roles: readonly string[],
  can: (permission: string) => boolean,
): SidebarGroup[] {
  const keys = sidebarItems(status, roles, can);
  return GROUP_ORDER.map((group) => ({
    key: group,
    items: keys.filter((key) => ITEMS[key].group === group).map(itemOf),
  })).filter((group) => group.items.length > 0);
}

/**
 * The phone's bottom bar: up to four of the role's daily destinations, then "เพิ่มเติม" for the rest
 * — so a QC inspector gets the QC queue, not the owner's billing.
 */
export function partnerBottomItems(
  status: string | undefined,
  roles: readonly string[],
  can: (permission: string) => boolean,
): SidebarItem[] {
  const keys = sidebarItems(status, roles, can);
  const preferred: SidebarItemKey[] = isOnboarding(status)
    ? ["today", "onboarding", "prices"]
    : ["today", "jobs", "qc", "ship", "billing", "samples", "claims", "capacity"];
  return preferred
    .filter((key) => keys.includes(key))
    .slice(0, 4)
    .map(itemOf);
}
