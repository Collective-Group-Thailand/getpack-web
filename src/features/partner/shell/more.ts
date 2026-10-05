import type { IconName } from "@/ui/icons";

export interface MoreItem {
  key:
    | "onboarding"
    | "prices"
    | "shipping"
    | "capacity"
    | "samples"
    | "payouts"
    | "claims"
    | "performance"
    | "requests"
    | "settings";
  href: string;
  icon: IconName;
  /** Hidden without it; the API refuses the screen anyway. */
  permission?: string;
}

/** Everything the bottom bar has no room for, one tap from "more". */
export const MORE_ITEMS: MoreItem[] = [
  { key: "onboarding", href: "/onboarding", icon: "checklist" },
  { key: "prices", href: "/prices", icon: "coins", permission: "factory_prices.read" },
  { key: "shipping", href: "/prices/shipping", icon: "truck", permission: "factory_prices.read" },
  { key: "capacity", href: "/capacity", icon: "calendar", permission: "factory_jobs.read" },
  { key: "samples", href: "/samples", icon: "package-check", permission: "factory_jobs.read" },
  { key: "payouts", href: "/payouts", icon: "coins", permission: "factory_payables.read" },
  { key: "claims", href: "/claims", icon: "shield-alert", permission: "factory_claims.read" },
  { key: "performance", href: "/performance", icon: "chart-line", permission: "factory_scorecard.read" },
  { key: "requests", href: "/requests", icon: "send" },
  { key: "settings", href: "/settings", icon: "settings" },
];
