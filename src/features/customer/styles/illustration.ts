import type { ProductFamily } from "@/ui/components/ProductIllustration";

/** The line drawing that stands in for a style's picture until the API renders one. */
export function illustrationOf(style: { category: string; family: string; materialClass: string }): ProductFamily {
  if (style.family === "display") return "display";
  if (style.materialClass === "food_board") return "food";
  switch (style.category) {
    case "corrugated":
      return "shipping";
    case "rigid":
      return "rigid";
    case "flexible":
      return style.family === "paper_bag" ? "bag" : "pouch";
    case "label":
      return "label";
    case "tag_sleeve":
      return "tag";
    default:
      return "tuck";
  }
}
