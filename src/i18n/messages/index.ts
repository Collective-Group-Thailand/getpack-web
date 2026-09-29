import type { Zone } from "@/lib/zones";

import { pickProblems, problemCodesFor } from "../problems";
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
  "problems",
  "storefront",
  "home",
  "designs",
  "designer",
  "catalog",
  "configurator",
  "quoteRequests",
  "cart",
  "checkout",
  "payment",
  "instalments",
  "account",
  "myOrders",
  "artwork",
  "proof",
  "fulfilment",
  "help",
  "business",
  "liff",
  "admin",
  "console",
  "approvals",
  "iam",
  "platform",
  "dashboard",
  "orders",
  "cs",
  "rfq",
  "prepress",
  "catalogue",
  "partners",
  "production",
  "marketing",
  "customers",
  "companies",
  "logistics",
  "analytics",
  "reports",
  "finance",
  "partner",
  "partnerToday",
  "partnerOnboarding",
  "partnerPrices",
  "partnerRequests",
  "partnerJobs",
  "partnerShip",
  "partnerBilling",
  "partnerAccount",
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
  customer: [
    "common",
    "auth",
    "status",
    "problems",
    "storefront",
    "home",
    "designs",
    "designer",
    "catalog",
    "configurator",
    "quoteRequests",
    "cart",
    "checkout",
    "payment",
    "instalments",
    "account",
    "myOrders",
    "artwork",
    "proof",
    "fulfilment",
    "help",
    "business",
    "liff",
  ],
  admin: [
    "common",
    "auth",
    "status",
    "problems",
    "admin",
    "console",
    "iam",
    "approvals",
    "platform",
    "dashboard",
    "orders",
    "cs",
    "rfq",
    "prepress",
    "catalogue",
    "partners",
    "production",
    "marketing",
    "customers",
    "companies",
    "logistics",
    "analytics",
    "reports",
    "finance",
    // The designer, for prepress opening a design read-only or as a copy (F4 C.2).
    "designer",
  ],
  partner: [
    "common",
    "auth",
    "status",
    "problems",
    "partner",
    "partnerToday",
    "partnerOnboarding",
    "partnerPrices",
    "partnerRequests",
    "partnerJobs",
    "partnerShip",
    "partnerBilling",
    "partnerAccount",
  ],
} as const satisfies Record<Zone, readonly Namespace[]>;

type Loader = () => Promise<{ default: Record<string, unknown> }>;

const LOADERS: Record<Locale, Record<Namespace, Loader>> = {
  th: {
    common: () => import("./th/common/common.json"),
    auth: () => import("./th/common/auth.json"),
    status: () => import("./th/common/status.json"),
    problems: () => import("./th/common/problems.json"),
    storefront: () => import("./th/customer/storefront.json"),
    home: () => import("./th/customer/home.json"),
    designs: () => import("./th/customer/designs.json"),
    designer: () => import("./th/customer/designer.json"),
    catalog: () => import("./th/customer/catalog.json"),
    configurator: () => import("./th/customer/configurator.json"),
    quoteRequests: () => import("./th/customer/quote-requests.json"),
    cart: () => import("./th/customer/cart.json"),
    checkout: () => import("./th/customer/checkout.json"),
    payment: () => import("./th/customer/payment.json"),
    instalments: () => import("./th/customer/instalments.json"),
    account: () => import("./th/customer/account.json"),
    myOrders: () => import("./th/customer/my-orders.json"),
    artwork: () => import("./th/customer/artwork.json"),
    proof: () => import("./th/customer/proof.json"),
    fulfilment: () => import("./th/customer/fulfilment.json"),
    help: () => import("./th/customer/help.json"),
    business: () => import("./th/customer/business.json"),
    liff: () => import("./th/customer/liff.json"),
    admin: () => import("./th/admin/admin.json"),
    reports: () => import("./th/admin/reports.json"),
    finance: () => import("./th/admin/finance.json"),
    analytics: () => import("./th/admin/analytics.json"),
    logistics: () => import("./th/admin/logistics.json"),
    companies: () => import("./th/admin/companies.json"),
    customers: () => import("./th/admin/customers.json"),
    marketing: () => import("./th/admin/marketing.json"),
    production: () => import("./th/admin/production.json"),
    partners: () => import("./th/admin/partners.json"),
    catalogue: () => import("./th/admin/catalogue.json"),
    prepress: () => import("./th/admin/prepress.json"),
    rfq: () => import("./th/admin/rfq.json"),
    cs: () => import("./th/admin/cs.json"),
    orders: () => import("./th/admin/orders.json"),
    dashboard: () => import("./th/admin/dashboard.json"),
    platform: () => import("./th/admin/platform.json"),
    console: () => import("./th/admin/console.json"),
    iam: () => import("./th/admin/iam.json"),
    approvals: () => import("./th/admin/approvals.json"),
    partner: () => import("./th/partner/partner.json"),
    partnerToday: () => import("./th/partner/today.json"),
    partnerOnboarding: () => import("./th/partner/onboarding.json"),
    partnerPrices: () => import("./th/partner/prices.json"),
    partnerRequests: () => import("./th/partner/requests.json"),
    partnerJobs: () => import("./th/partner/jobs.json"),
    partnerShip: () => import("./th/partner/ship.json"),
    partnerBilling: () => import("./th/partner/billing.json"),
    partnerAccount: () => import("./th/partner/account.json"),
  },
  en: {
    common: () => import("./en/common/common.json"),
    auth: () => import("./en/common/auth.json"),
    status: () => import("./en/common/status.json"),
    problems: () => import("./en/common/problems.json"),
    storefront: () => import("./en/customer/storefront.json"),
    home: () => import("./en/customer/home.json"),
    designs: () => import("./en/customer/designs.json"),
    designer: () => import("./en/customer/designer.json"),
    catalog: () => import("./en/customer/catalog.json"),
    configurator: () => import("./en/customer/configurator.json"),
    quoteRequests: () => import("./en/customer/quote-requests.json"),
    cart: () => import("./en/customer/cart.json"),
    checkout: () => import("./en/customer/checkout.json"),
    payment: () => import("./en/customer/payment.json"),
    instalments: () => import("./en/customer/instalments.json"),
    account: () => import("./en/customer/account.json"),
    myOrders: () => import("./en/customer/my-orders.json"),
    artwork: () => import("./en/customer/artwork.json"),
    proof: () => import("./en/customer/proof.json"),
    fulfilment: () => import("./en/customer/fulfilment.json"),
    help: () => import("./en/customer/help.json"),
    business: () => import("./en/customer/business.json"),
    liff: () => import("./en/customer/liff.json"),
    admin: () => import("./en/admin/admin.json"),
    reports: () => import("./en/admin/reports.json"),
    finance: () => import("./en/admin/finance.json"),
    analytics: () => import("./en/admin/analytics.json"),
    logistics: () => import("./en/admin/logistics.json"),
    companies: () => import("./en/admin/companies.json"),
    customers: () => import("./en/admin/customers.json"),
    marketing: () => import("./en/admin/marketing.json"),
    production: () => import("./en/admin/production.json"),
    partners: () => import("./en/admin/partners.json"),
    catalogue: () => import("./en/admin/catalogue.json"),
    prepress: () => import("./en/admin/prepress.json"),
    rfq: () => import("./en/admin/rfq.json"),
    cs: () => import("./en/admin/cs.json"),
    orders: () => import("./en/admin/orders.json"),
    dashboard: () => import("./en/admin/dashboard.json"),
    platform: () => import("./en/admin/platform.json"),
    console: () => import("./en/admin/console.json"),
    iam: () => import("./en/admin/iam.json"),
    approvals: () => import("./en/admin/approvals.json"),
    partner: () => import("./en/partner/partner.json"),
    partnerToday: () => import("./en/partner/today.json"),
    partnerOnboarding: () => import("./en/partner/onboarding.json"),
    partnerPrices: () => import("./en/partner/prices.json"),
    partnerRequests: () => import("./en/partner/requests.json"),
    partnerJobs: () => import("./en/partner/jobs.json"),
    partnerShip: () => import("./en/partner/ship.json"),
    partnerBilling: () => import("./en/partner/billing.json"),
    partnerAccount: () => import("./en/partner/account.json"),
  },
};

async function load(locale: Locale, namespaces: readonly Namespace[], zone?: Zone) {
  const entries = await Promise.all(
    namespaces.map(async (namespace) => {
      const messages = (await LOADERS[locale][namespace]()).default;
      // Problem copy is cut to the codes this zone can receive (`src/i18n/problems.ts`).
      if (namespace === "problems" && zone)
        return [namespace, pickProblems(messages as never, problemCodesFor(zone))] as const;
      return [namespace, messages] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Namespace, Record<string, unknown>>;
}

/** Namespaced messages for one zone: `useTranslations("designer.setup")` and so on. */
export function loadMessages(locale: Locale, zone: Zone = "customer") {
  return load(locale, ZONE_NAMESPACES[zone], zone);
}

/** Every namespace, whatever zone owns it — for the th/en parity test. */
export function loadAllMessages(locale: Locale) {
  return load(locale, NAMESPACES);
}
