import type { Schemas } from "@/lib/api/types";

type Component = Schemas["PriceComponent"];

/** The folding-carton loader's tables — tag & sleeve prices through the same loader (engine A). */
const FOLDING: readonly Component[] = [
  "material_prices",
  "paper_sheets",
  "paper_sizes",
  "paper_trims",
  "print_prices",
  "print_plates",
  "print_type_terms",
  "b_print_prices",
  "ink_colours",
  "finish_prices",
  "finish_plates",
  "foil_prices",
  "diecut_prices",
  "diecut_block_prices",
  "assembly_prices",
  "b_assembly_prices",
  "assembly_sheets",
  "print_wastes",
  "b_print_wastes",
  "finish_wastes",
  "diecut_wastes",
  "assembly_wastes",
  "code_margins",
  "pattern_conditions",
  "process_exclusions",
];

/**
 * The price components each product type's calculator reads (packio-api
 * `src/modules/pricing/calculators/<family>/*-snapshot.loader.ts`, the `pl*` models each loader
 * queries). The price screens show only these, so a folding-carton factory is not asked about
 * pouch film or corrugated board.
 *
 * CONTRACT-GAP partner.price-components-by-type — `PriceComponentDto` does not say which product
 * types read it (see docs/contract-requests.md). Until it does the pairing is copied here; a
 * product type not listed falls back to every component, as before.
 */
export const COMPONENTS_BY_TYPE: Record<string, readonly Component[]> = {
  folding_carton: FOLDING,
  tag_sleeve: FOLDING,
  corrugated: [
    "board_prices",
    "paper_roll_widths",
    "paper_sizes",
    "paper_trims",
    "corrugate_print_prices",
    "corrugate_print_type_terms",
    "ink_colours",
    "finish_prices",
    "corrugate_die_blocks",
    "corrugate_diecut_prices",
    "corrugate_assembly_prices",
    "corrugate_process_terms",
    "difficulty_levels",
    "difficulty_margins",
    "percent_reduces",
    "fix_cost_pcts",
    "fixed_options",
    "corrugate_pattern_conditions",
  ],
  label_sticker: [
    "material_prices",
    "label_paper_sheets",
    "paper_sizes",
    "paper_trims",
    "print_prices",
    "label_roll_print_prices",
    "label_print_type_terms",
    "ink_colours",
    "finish_prices",
    "label_diecut_prices",
    "diecut_block_prices",
    "print_wastes",
    "finish_wastes",
    "diecut_wastes",
  ],
  flexible_pouch: [
    "pouch_material_prices",
    "pouch_print_prices",
    "pouch_print_type_terms",
    "pouch_process_prices",
    "pouch_option_prices",
    "pouch_option_rules",
    "pouch_min_quantities",
    "pouch_factory_margins",
  ],
  standard_product: ["stock_product_prices"],
  service: ["service_prices"],
};

/**
 * The component definitions a product type's price list uses, in the order a factory works
 * through them (materials first, rules last — the `COMPONENTS_BY_TYPE` order within a group).
 */
export function componentsFor<T extends { component: Component }>(
  definitions: readonly T[],
  productTypeCode: string | null | undefined,
): T[] {
  const wanted = productTypeCode ? COMPONENTS_BY_TYPE[productTypeCode] : undefined;
  if (!wanted) return [...definitions];
  const rank = new Map(wanted.map((component, index) => [component, index]));
  return definitions
    .filter((item) => rank.has(item.component))
    .sort((a, b) => rank.get(a.component)! - rank.get(b.component)!);
}
