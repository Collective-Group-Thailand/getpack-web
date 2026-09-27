import type { IconName } from "@/ui/icons";

export type PartnerNavKey = "today" | "onboarding" | "prices" | "jobs" | "ship" | "billing" | "more";

export interface PartnerNavItem {
  key: PartnerNavKey;
  href: string;
  icon: IconName;
}

const ITEMS: Record<PartnerNavKey, PartnerNavItem> = {
  today: { key: "today", href: "/", icon: "home" },
  onboarding: { key: "onboarding", href: "/onboarding", icon: "checklist" },
  prices: { key: "prices", href: "/prices", icon: "coins" },
  jobs: { key: "jobs", href: "/jobs", icon: "factory" },
  ship: { key: "ship", href: "/ship", icon: "truck" },
  billing: { key: "billing", href: "/billing", icon: "wallet" },
  more: { key: "more", href: "/more", icon: "menu" },
};

/**
 * The shop-floor destinations for this factory and this user — at most five, so each keeps a
 * 64 px target on a 6" phone.
 *
 * A factory still onboarding (applied, under review) has no jobs yet: its bar is the wizard and
 * its prices. From trial on it is the production floor, and onboarding and prices move to
 * "more". Destinations the role cannot open are left out rather than shown disabled (the API
 * still refuses them).
 */
export function partnerNav(status: string | undefined, can: (permission: string) => boolean): PartnerNavItem[] {
  const onboarding = status === "applied" || status === "under_review";
  const keys: PartnerNavKey[] = onboarding
    ? ["today", "onboarding", ...(can("factory_prices.read") ? (["prices"] as const) : []), "more"]
    : ["today", "jobs", "ship", "billing", "more"];
  return keys.map((key) => ITEMS[key]);
}

/** Whether `href` is the current section for `pathname` (the home item matches only itself). */
export const isCurrent = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
