import type { IconName } from "@/ui/icons";

/**
 * The rail's one outline icon set: a product-type code → a line icon from the registry, all drawn
 * in `currentColor` so a selected card tints its icon with its text. Unknown or new codes get the
 * neutral box rather than nothing, so a category the web does not know yet still has a card that
 * lines up with the rest.
 */
const BY_CODE: Record<string, IconName> = {
  folding_carton: "box",
  corrugated: "package",
  rigid: "archive",
  flexible: "shopping-bag",
  label: "tag",
  tag_sleeve: "package-open",
  insert: "grid",
};

export const ALL_CATEGORIES_ICON: IconName = "layout-grid";
export const DEFAULT_CATEGORY_ICON: IconName = "box";

export function categoryIcon(code: string | null | undefined): IconName {
  if (!code) return ALL_CATEGORIES_ICON;
  return BY_CODE[code] ?? DEFAULT_CATEGORY_ICON;
}
