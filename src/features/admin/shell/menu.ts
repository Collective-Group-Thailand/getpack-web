import type { MenuEntry } from "@/lib/api/types";
import { ZONE_CONFIG } from "@/lib/zones";
import type { IconName } from "@/ui/icons";

/**
 * The admin sidebar is built from `/v1/admin/me` and nothing else (F1 1.3, D-140).
 *
 * There is no role check anywhere in this zone's navigation. Fourteen staff roles, several
 * held at once, with SoD pairs that block each other (`accounting-design.md` §8) — expressed
 * as `actor.roles.includes(…)` in a sidebar, that becomes a second permission system that
 * disagrees with the real one. The API sends the entries this user may open; the frontend owns
 * only how they look.
 */

/**
 * `MenuEntryDto.path` is host-absolute (`/admin/approvals`) because that is how the backend
 * thinks about the surface. On the admin host the browser never sees `/admin` — `src/proxy.ts`
 * rewrites `admin.packio.co.th/approvals` to the internal `/admin/approvals` — so a link
 * printed verbatim would send someone to `/admin/approvals`, which the proxy then refuses as a
 * cross-zone path (`isInternalOnlyPath`) and answers 404.
 *
 * The contract's own example uses `/admin/approvals`; the MSW mock uses `/orders`. Both are
 * plausible readings of the field, so both are accepted here rather than assumed away.
 */
export function browserPath(path: string): string {
  const prefix = ZONE_CONFIG.admin.routePrefix;
  if (path === prefix) return "/";
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Icons for the menu keys. A key with no icon still renders — with no icon — rather than being
 * dropped or given a wrong one.
 */
const MENU_ICONS: Record<string, IconName> = {
  dashboard: "dashboard",
  approvals: "stamp",
  orders: "package",
  cs_calculators: "calculator",
  quotations: "receipt",
  rfq: "chat",
  // CONTRACT-REQUEST admin.menu-inbox: ready for when packio-api adds the entry.
  inbox: "inbox",
  // CONTRACT-REQUEST admin.menu-assistant
  assistant: "sparkles",
  discount_memos: "percent",
  prepress: "image",
  production: "factory",
  shipments: "truck",
  claims: "flag",
  partners: "handshake",
  catalogue: "box",
  cms: "article",
  marketing: "megaphone",
  customers: "user",
  companies: "building",
  analytics: "chart",
  reports: "document",
  finance: "wallet",
  users: "users",
  settings: "settings",
  feature_flags: "flag",
  notification_templates: "mail",
  notification_routes: "route",
  audit_logs: "history",
  outbox: "inbox",
  ops: "activity",
};

/**
 * How the sidebar groups what the API sent (F2 A.3: "collapsible sidebar grouped by the role
 * menu"). Presentation only: grouping never adds or removes an entry, and a key in no group
 * lands in `other` rather than disappearing. Within a group the API's order is kept.
 */
export const MENU_GROUPS: readonly { key: string; entries: readonly string[] }[] = [
  { key: "overview", entries: ["dashboard", "approvals"] },
  { key: "sales", entries: ["orders", "inbox", "cs_calculators", "quotations", "rfq", "discount_memos"] },
  { key: "operations", entries: ["prepress", "production", "shipments", "claims", "samples"] },
  { key: "supply", entries: ["partners", "catalogue", "structural_requests", "style_intakes"] },
  { key: "growth", entries: ["marketing", "cms", "customers", "companies"] },
  { key: "insights", entries: ["analytics", "assistant", "reports", "finance"] },
  {
    key: "system",
    entries: [
      "users",
      "settings",
      "feature_flags",
      "notification_templates",
      "notification_routes",
      "audit_logs",
      "outbox",
      "ops",
    ],
  },
];

export interface SidebarGroup {
  key: string;
  items: SidebarItem[];
}

export function groupSidebar(items: readonly SidebarItem[]): SidebarGroup[] {
  const groups = MENU_GROUPS.map((group) => ({
    key: group.key,
    items: items.filter((item) => group.entries.includes(item.key)),
  }));
  const known = new Set(MENU_GROUPS.flatMap((group) => group.entries));
  const other = items.filter((item) => !known.has(item.key));
  return [...groups, { key: "other", items: other }].filter((group) => group.items.length > 0);
}

export interface SidebarItem {
  key: string;
  href: string;
  icon?: IconName;
}

/**
 * Screens packio-api's menu does not list yet (CONTRACT-REQUEST admin.menu-samples), offered by
 * the permission that opens them — so they live in the sidebar as modules of their own instead of
 * as buttons on the order desk's header (UX audit, /orders). Dropped once the API sends them.
 */
export function localItems(permissions: readonly string[]): SidebarItem[] {
  const has = (...wanted: string[]) => wanted.some((permission) => permissions.includes(permission));
  return [
    ...(has("samples.read") ? [{ key: "samples", href: "/samples", icon: "package-check" as const }] : []),
    ...(has("structural_requests.manage", "structural_requests.design")
      ? [{ key: "structural_requests", href: "/structural-requests", icon: "ruler" as const }]
      : []),
    ...(has("styles.import", "styles.approve_recipe")
      ? [{ key: "style_intakes", href: "/style-intakes", icon: "upload" as const }]
      : []),
  ];
}

export function sidebarItems(menu: readonly MenuEntry[]): SidebarItem[] {
  return menu.map((entry) => ({
    key: entry.key,
    href: browserPath(entry.path),
    icon: MENU_ICONS[entry.key],
  }));
}

/**
 * Whether a sidebar entry is the page being looked at.
 *
 * Prefix matching, so `/orders/PK-2569-00042` still lights up `/orders` — but at a segment
 * boundary, or `/order` would match `/orders` and two entries would look current at once.
 * `/` is exact, since every path starts with it.
 */
export function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The label for a menu key.
 *
 * `MenuEntryDto` says "Stable key; the frontend owns the label", so a key the UI has not met
 * is a translation we owe, not an error. It renders as the key itself — visible, greppable and
 * obviously unfinished — because hiding the entry would take away a screen the API just said
 * this person may open.
 */
export function menuLabel(key: string, translate: (key: string) => string): string {
  const messageKey = `menu.${key}`;
  const label = translate(messageKey);
  // next-intl returns the full path when a key is missing; `t.has()` is not available on the
  // plain function shape this takes, which keeps it usable from a server component.
  return label.endsWith(messageKey) ? key : label;
}
