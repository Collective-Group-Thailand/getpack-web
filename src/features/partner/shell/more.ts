import type { IconName } from "@/ui/icons";

export interface MoreItem {
  key: "onboarding" | "prices" | "shipping" | "capacity" | "requests";
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
  { key: "requests", href: "/requests", icon: "send" },
];
