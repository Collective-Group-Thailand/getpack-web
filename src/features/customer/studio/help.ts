import type { RuleId } from "@/features/designer/lib/checks";

/** The print-ready learning path, where the checks with no single glossary term are explained. */
const PRINT_READY = "/learn/print-ready-files";

/**
 * Where each studio check is explained (U5.2 §4): its glossary entry when one term covers it, the
 * print-ready learning path otherwise. Every check message links somewhere — none is a dead end.
 */
export const RULE_HELP: Record<RuleId, string> = {
  bleed: "/help/glossary#bleed",
  safe_zone: "/help/glossary#safe-zone",
  crosses_crease: "/help/glossary#crease",
  crosses_glue: "/help/glossary#dieline",
  off_sheet: "/help/glossary#dieline",
  image_resolution: PRINT_READY,
  min_text_size: PRINT_READY,
  hairline: PRINT_READY,
  rich_black_small_text: PRINT_READY,
  rgb_out_of_gamut: PRINT_READY,
  spot_colour_count: PRINT_READY,
  barcode_across_fold: PRINT_READY,
  barcode_invalid: PRINT_READY,
  white_ink_needed: PRINT_READY,
  finish_min_feature: "/help/glossary#spot-uv",
  element_right_missing: PRINT_READY,
};
