/**
 * The seven instant calculators of D-100. A plain module, because the calculator page (a Server
 * Component) looks a type up here before rendering.
 */

import type { IconName } from "@/ui/icons";

export type CalculatorKey = "folding" | "corrugate" | "label" | "tag_sleeve" | "pouch" | "standard_product" | "service";

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
