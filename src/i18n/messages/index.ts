import type { Zone } from "@/lib/zones";

import type { Locale } from "../routing";

/**
 * Messages are split **per zone and per feature** on disk
 * (`messages/{th,en}/{common,customer,admin,partner}/*.json`) and loaded per zone, so the
 * storefront never downloads back-office copy and vice versa — the same reason each zone has
 * its own root layout.
 *
 * The folder a file sits in says who may load it; the namespace is still flat, because
 * `useTranslations("designs")` reads better than `useTranslations("customer.designs")` and the
 * zone is already decided by the time messages are loaded. `ZONE_NAMESPACES` is what actually
 * enforces the split.
 *
 * The imports are explicit rather than a glob so the bundler can see every file, and so a
 * missing namespace is a type error rather than a key that silently renders as `home.title`.
 */
const NAMESPACES = [
  "common",
  "auth",
  "status",
  "storefront",
  "home",
  "designs",
  "designer",
  "admin",
  "console",
  "approvals",
  "iam",
  "partner",
] as const;

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
  customer: ["common", "auth", "status", "storefront", "home", "designs", "designer"],
  admin: ["common", "auth", "status", "admin", "console", "iam", "approvals"],
  partner: ["common", "auth", "status", "partner"],
} as const satisfies Record<Zone, readonly Namespace[]>;

type Loader = () => Promise<{ default: Record<string, unknown> }>;

const LOADERS: Record<Locale, Record<Namespace, Loader>> = {
  th: {
    common: () => import("./th/common/common.json"),
    auth: () => import("./th/common/auth.json"),
    status: () => import("./th/common/status.json"),
    storefront: () => import("./th/customer/storefront.json"),
    home: () => import("./th/customer/home.json"),
    designs: () => import("./th/customer/designs.json"),
    designer: () => import("./th/customer/designer.json"),
    admin: () => import("./th/admin/admin.json"),
    console: () => import("./th/admin/console.json"),
    iam: () => import("./th/admin/iam.json"),
    approvals: () => import("./th/admin/approvals.json"),
    partner: () => import("./th/partner/partner.json"),
  },
  en: {
    common: () => import("./en/common/common.json"),
    auth: () => import("./en/common/auth.json"),
    status: () => import("./en/common/status.json"),
    storefront: () => import("./en/customer/storefront.json"),
    home: () => import("./en/customer/home.json"),
    designs: () => import("./en/customer/designs.json"),
    designer: () => import("./en/customer/designer.json"),
    admin: () => import("./en/admin/admin.json"),
    console: () => import("./en/admin/console.json"),
    iam: () => import("./en/admin/iam.json"),
    approvals: () => import("./en/admin/approvals.json"),
    partner: () => import("./en/partner/partner.json"),
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
