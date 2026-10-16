/**
 * The seven instant calculators of D-100. A plain module, because the calculator page (a Server
 * Component) looks a type up here before rendering.
 *
 * Only folding (B2.3) and corrugate (U-B6, contract v0.3.0) are published as CS calculators. The
 * other five arrive from getpack-api U-B6 one by one; until then the desk shows their types as
 * RFQ-only, never a price of its own (U1 §U-F0.2–0.4).
 */

import type { IconName } from "@/ui/icons";

export type CalculatorKey = "folding" | "corrugate" | "label" | "tag_sleeve" | "pouch" | "standard_product" | "service";

/** The calculators getpack-api publishes for CS (`admin.csFolding.*`, `admin.csCorrugate.*`). */
export const PUBLISHED_CALCULATORS = ["folding", "corrugate"] as const;
export type PublishedCalculator = (typeof PUBLISHED_CALCULATORS)[number];

export function isPublished(key: CalculatorKey): key is PublishedCalculator {
  return (PUBLISHED_CALCULATORS as readonly string[]).includes(key);
}

export const CALCULATORS: { key: CalculatorKey; icon: IconName; flag?: string }[] = [
  { key: "folding", icon: "box" },
  { key: "corrugate", icon: "package" },
  // Legacy `DISPLAY_MENU_LABEL`, now a feature flag returned by /v1/admin/me (F2 A.1).
  { key: "label", icon: "tag", flag: "labelCalculator" },
  { key: "tag_sleeve", icon: "ticket" },
  { key: "pouch", icon: "layers" },
  { key: "standard_product", icon: "warehouse" },
  { key: "service", icon: "sparkles" },
];
