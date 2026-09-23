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
 * Icons for the menu keys F2 introduces. A key with no icon still renders — with no icon —
 * rather than being dropped or given a wrong one.
 */
const MENU_ICONS: Record<string, IconName> = {
  dashboard: "pattern",
  orders: "package",
  quotations: "receipt",
  rfq: "chat",
  prepress: "image",
  catalogue: "box",
  partners: "factory",
  production: "factory",
  logistics: "truck",
  shipments: "truck",
  claims: "flag",
  finance: "wallet",
  documents: "document",
  payouts: "credit-card",
  marketing: "flag",
  campaigns: "flag",
  customers: "user",
  companies: "user",
  b2b: "user",
  users: "user",
  approvals: "check",
  audit_logs: "eye",
  analytics: "pattern",
  reports: "document",
  settings: "edit",
};

export interface SidebarItem {
  key: string;
  href: string;
  icon?: IconName;
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
