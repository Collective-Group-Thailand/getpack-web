import type { IconName } from "@/ui/icons";

/**
 * The partner sidebar (round 2, Phase 1; the audit's "Sidebar ของ partner" IA table): what used to
 * hide behind "เพิ่มเติม" in four groups — งานประจำวัน · แผนและกำลังผลิต · การเงิน · โรงงาน — and,
 * of those, only what the user's roles at this factory work with. "เพิ่มเติม" stays on a phone,
 * where the bottom bar has five places.
 */
export type SidebarGroupKey = "daily" | "insight" | "sales" | "supply" | "plan" | "quality" | "finance" | "factory";

export type SidebarItemKey =
  | "today"
  | "alerts"
  | "onboarding"
  | "jobs"
  | "qc"
  | "samples"
  | "ship"
  | "claims"
  | "stock"
  | "purchasing"
  | "tradingPartners"
  | "planning"
  | "floor"
  | "kiosk"
  | "rfqs"
  | "schedule"
  | "maintenance"
  | "machines"
  | "documents"
  | "crm"
  | "quotations"
  | "salesOrders"
  | "deliveries"
  | "invoices"
  | "receivables"
  | "tax"
  | "insight"
  | "insightCosts"
  | "insightProfit"
  | "insightOee"
  | "qualityChecks"
  | "ncrs"
  | "qualityTemplates"
  | "people"
  | "supportAccess"
  | "payables"
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
  // E2.1 / E3 (D-358): the factory's ERP alerts — price rises, breakdowns, maintenance due, documents expiring.
  alerts: { key: "alerts", href: "/alerts", icon: "bell", group: "daily", permission: "factory_profile.read" },
  onboarding: { key: "onboarding", href: "/onboarding", icon: "checklist", group: "daily" },
  jobs: { key: "jobs", href: "/jobs", icon: "factory", group: "daily", permission: "factory_jobs.read" },
  floor: { key: "floor", href: "/floor", icon: "play", group: "daily", permission: "factory_production.record" },
  // E3 (D-353): one machine's screen for its operators — big buttons, pause with a reason.
  kiosk: {
    key: "kiosk",
    href: "/floor/kiosk",
    icon: "tablet",
    group: "daily",
    permission: "factory_production.record",
  },
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
  // E4 (D-359 – D-362): the factory's own customers — leads and deals, quotations, orders, delivery notes.
  crm: { key: "crm", href: "/crm", icon: "users", group: "sales", permission: "factory_sales.read" },
  quotations: { key: "quotations", href: "/quotations", icon: "document", group: "sales", permission: "factory_sales.read" },
  salesOrders: { key: "salesOrders", href: "/sales-orders", icon: "cart", group: "sales", permission: "factory_sales.read" },
  deliveries: { key: "deliveries", href: "/deliveries", icon: "truck", group: "sales", permission: "factory_sales.read" },
  // Packio Factory ERP (E1, D-316): the factory's own stock, buying and trading partners.
  stock: { key: "stock", href: "/stock", icon: "warehouse", group: "supply", permission: "factory_inventory.read" },
  purchasing: {
    key: "purchasing",
    href: "/purchasing",
    icon: "cart",
    group: "supply",
    permission: "factory_procurement.read",
  },
  // E2.1 (D-348): quotations from several suppliers, compared side by side.
  rfqs: {
    key: "rfqs",
    href: "/purchasing/rfqs",
    icon: "scale",
    group: "supply",
    permission: "factory_procurement.read",
  },
  tradingPartners: {
    key: "tradingPartners",
    href: "/partners",
    icon: "handshake",
    group: "supply",
    permission: "factory_trading_partners.read",
  },
  // E2 (D-339 – D-342): planning and the floor; the factory's own payables (D-337, D-338).
  planning: {
    key: "planning",
    href: "/planning",
    icon: "layers",
    group: "plan",
    permission: "factory_planning.read",
  },
  // E3 (D-352, D-355): the machine schedule, maintenance and the machines themselves.
  schedule: {
    key: "schedule",
    href: "/planning/schedule",
    icon: "gantt",
    group: "plan",
    permission: "factory_planning.read",
  },
  maintenance: {
    key: "maintenance",
    href: "/maintenance",
    icon: "wrench",
    group: "plan",
    permission: "factory_maintenance.read",
  },
  machines: {
    key: "machines",
    href: "/machines",
    icon: "cog",
    group: "plan",
    permission: "factory_planning.read",
  },
  // E4 (D-363 – D-367): invoices in the factory's own name, what customers owe, its tax.
  invoices: {
    key: "invoices",
    href: "/invoices",
    icon: "receipt",
    group: "finance",
    permission: "factory_receivables.read",
  },
  receivables: {
    key: "receivables",
    href: "/receivables",
    icon: "coins",
    group: "finance",
    permission: "factory_receivables.read",
  },
  tax: { key: "tax", href: "/tax", icon: "stamp", group: "finance", permission: "factory_tax.read" },
  // E5 (D-376 – D-378): the owner's dashboard, job costs, gross profit and OEE.
  insight: { key: "insight", href: "/insight", icon: "dashboard", group: "insight", permission: "factory_insight.read" },
  insightCosts: { key: "insightCosts", href: "/insight/costs", icon: "calculator", group: "insight", permission: "factory_insight.read" },
  insightProfit: { key: "insightProfit", href: "/insight/profit", icon: "trend-up", group: "insight", permission: "factory_insight.read" },
  insightOee: { key: "insightOee", href: "/insight/oee", icon: "activity", group: "insight", permission: "factory_insight.read" },
  // E5 (D-372 – D-374): the factory's own checks, NCRs and the checklists they use.
  qualityChecks: { key: "qualityChecks", href: "/quality", icon: "clipboard-check", group: "quality", permission: "factory_quality.read" },
  ncrs: { key: "ncrs", href: "/quality/ncrs", icon: "shield-alert", group: "quality", permission: "factory_quality.read" },
  qualityTemplates: {
    key: "qualityTemplates",
    href: "/quality/templates",
    icon: "checklist",
    group: "quality",
    permission: "factory_quality.read",
  },
  // E5 (D-380): shifts, who can run which machine, and the work log.
  people: { key: "people", href: "/people", icon: "users", group: "plan", permission: "factory_people.read" },
  payables: {
    key: "payables",
    href: "/payables",
    icon: "credit-card",
    group: "finance",
    permission: "factory_ap.read",
  },
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
  // E3 (D-356): certificates, permits, drawings — versioned, linked to records, reminded before they expire.
  documents: {
    key: "documents",
    href: "/documents",
    icon: "folder",
    group: "factory",
    permission: "factory_documents.read",
  },
  requests: { key: "requests", href: "/requests", icon: "send", group: "factory" },
  knowledge: { key: "knowledge", href: "/knowledge", icon: "article", group: "factory" },
  // Everyone's own notifications live there too; users and the factory's profile only for whom may manage them.
  // E5 (D-381): the owner lets Packio support read the ERP for a few days.
  supportAccess: {
    key: "supportAccess",
    href: "/settings/support",
    icon: "shield",
    group: "factory",
    permission: "factory_support.grant",
  },
  settings: { key: "settings", href: "/settings", icon: "settings", group: "factory" },
};

/** What each role works with, from the audit's IA table; the owner has everything. */
/** Every role: the guide, a request to Packio, and their own settings (notifications). */
const EVERYONE: readonly SidebarItemKey[] = ["knowledge", "requests", "settings"];

const ROLE_ITEMS: Record<string, readonly SidebarItemKey[]> = {
  factory_owner: Object.keys(ITEMS) as SidebarItemKey[],
  factory_planner: [
    "today",
    "insight",
    "insightCosts",
    "insightOee",
    "alerts",
    "jobs",
    "floor",
    "kiosk",
    "planning",
    "schedule",
    "maintenance",
    "machines",
    "qualityChecks",
    "ncrs",
    "people",
    "salesOrders",
    "stock",
    "purchasing",
    "capacity",
    "hours",
    "documents",
    ...EVERYONE,
  ],
  factory_operator: ["today", "alerts", "floor", "kiosk", "jobs", "planning", "maintenance", "qualityChecks", "ncrs", "people", "documents", ...EVERYONE],
  // QC and shipping open on their own queue (`/qc`, `/ship`): "งานวันนี้" would lead back to it.
  factory_qc: ["qc", "qualityChecks", "ncrs", "qualityTemplates", "samples", "claims", ...EVERYONE],
  factory_shipping: ["ship", ...EVERYONE],
  factory_accountant: [
    "today",
    "insight",
    "insightCosts",
    "insightProfit",
    "alerts",
    "quotations",
    "salesOrders",
    "invoices",
    "receivables",
    "tax",
    "qualityChecks",
    "purchasing",
    "tradingPartners",
    "stock",
    "payables",
    "billing",
    "payouts",
    "prices",
    "shippingRates",
    "performance",
    "documents",
    ...EVERYONE,
  ],
  // Packio Factory ERP roles (D-319): the store and the buying desk.
  factory_storekeeper: [
    "alerts",
    "qualityChecks",
    "ncrs",
    "deliveries",
    "salesOrders",
    "stock",
    "purchasing",
    "tradingPartners",
    "planning",
    "documents",
    ...EVERYONE,
  ],
  factory_purchaser: ["alerts", "purchasing", "rfqs", "stock", "tradingPartners", "payables", "documents", ...EVERYONE],
  // E3 (D-357): the maintenance crew — orders, plans, machines and the spare parts in stock.
  factory_maintenance: ["alerts", "maintenance", "machines", "ncrs", "people", "stock", "documents", ...EVERYONE],
  // E4 (D-371): the sales desk — its customers and deals through to delivery, and what they owe.
  factory_sales: [
    "alerts",
    "crm",
    "quotations",
    "salesOrders",
    "deliveries",
    "invoices",
    "receivables",
    "tradingPartners",
    "stock",
    "documents",
    ...EVERYONE,
  ],
};

const DESKS: readonly SidebarItemKey[] = [
  "insight",
  "crm",
  "quotations",
  "maintenance",
  "stock",
  "deliveries",
  "purchasing",
  "tradingPartners",
  "qualityChecks",
  "alerts",
];

const GROUP_ORDER: SidebarGroupKey[] = ["daily", "insight", "sales", "supply", "plan", "quality", "finance", "factory"];

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
    : ["today", "jobs", "floor", "qc", "ship", "billing", "samples", "claims", "capacity"];
  const floor = preferred.filter((key) => keys.includes(key));
  // The store, the buying desk (D-319) and the maintenance crew (D-357) have no floor queue: their bar is
  // their own desk, then the alerts.
  const supply = floor.length < 2 ? DESKS.filter((key) => keys.includes(key)) : [];
  return [...floor, ...supply].slice(0, 4).map(itemOf);
}
