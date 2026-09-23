import type { Zone } from "@/lib/zones";

import type { Locale } from "../routing";

/**
 * Messages are split per namespace (00-master-plan.md §3) and loaded **per zone**, so the
 * storefront never downloads back-office copy and vice versa — the same reason each zone
 * has its own root layout.
 *
 * The imports are explicit rather than a glob so the bundler can see every file, and so a
 * missing namespace is a type error rather than a key that silently renders as `home.title`.
 * F1 Deliverable 1.3 splits these flat files per feature.
 */
const NAMESPACES = ["common", "auth", "status", "home", "designs", "designer", "admin", "partner"] as const;

export type Namespace = (typeof NAMESPACES)[number];

/**
 * `common`, `auth` and `status` are everywhere; the rest belong to exactly one zone.
 *
 * `auth` is shared because all three zones sign someone in, and the wording of "your session
 * has ended" or "too many attempts" should not drift between them. `status` is shared for a
 * stronger reason: `src/domain/status` is the single source of a status's label, and an order
 * that reads "รอตรวจสอบการชำระเงิน" to a customer must read the same to the CS agent looking at
 * the same row. The copy each zone does *not* use is a handful of strings, which is cheaper
 * than three near-identical namespaces that drift.
 */
export const ZONE_NAMESPACES = {
  customer: ["common", "auth", "status", "home", "designs", "designer"],
  admin: ["common", "auth", "status", "admin"],
  partner: ["common", "auth", "status", "partner"],
} as const satisfies Record<Zone, readonly Namespace[]>;

type Loader = () => Promise<{ default: Record<string, unknown> }>;

const LOADERS: Record<Locale, Record<Namespace, Loader>> = {
  th: {
    common: () => import("./th/common.json"),
    auth: () => import("./th/auth.json"),
    status: () => import("./th/status.json"),
    home: () => import("./th/home.json"),
    designs: () => import("./th/designs.json"),
    designer: () => import("./th/designer.json"),
    admin: () => import("./th/admin.json"),
    partner: () => import("./th/partner.json"),
  },
  en: {
    common: () => import("./en/common.json"),
    auth: () => import("./en/auth.json"),
    status: () => import("./en/status.json"),
    home: () => import("./en/home.json"),
    designs: () => import("./en/designs.json"),
    designer: () => import("./en/designer.json"),
    admin: () => import("./en/admin.json"),
    partner: () => import("./en/partner.json"),
  },
};

async function load(locale: Locale, namespaces: readonly Namespace[]) {
  const entries = await Promise.all(
    namespaces.map(async (namespace) => [namespace, (await LOADERS[locale][namespace]()).default] as const),
  );
  return Object.fromEntries(entries) as Record<Namespace, Record<string, unknown>>;
}

/** Namespaced messages for one zone: `useTranslations("designer.setup")` and so on. */
export function loadMessages(locale: Locale, zone: Zone = "customer") {
  return load(locale, ZONE_NAMESPACES[zone]);
}

/** Every namespace, whatever zone owns it — for the th/en parity test. */
export function loadAllMessages(locale: Locale) {
  return load(locale, NAMESPACES);
}
