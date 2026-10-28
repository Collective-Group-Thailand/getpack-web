import { defaultPatternOf, defaultStandardSizeOf, type Configurator } from "@/features/customer/configurator/state";
import { styleHref } from "@/features/customer/styles/paths";
import { DIELINE_FRAGMENT } from "@/features/customer/styles/paths";

/**
 * Where "ดาวน์โหลดแบบกล่อง" goes for a product (D-271, D-441): the free-dieline form of the style the
 * product's default pattern is drawn from, with the variant the API publishes for it chosen and the
 * default standard size filled in (`/styles/<code>?v=<variant>&l=&w=&h=#dieline`). `null` when the
 * API reports no published variant for that pattern (`dielineVariantCodes` empty) — the caller keeps
 * its fallback. Nothing is derived: the code, the variant and the millimetres are the API's.
 *
 * `sizeCode`: the product page's "แบบกล่องเบอร์ X" (pdp redesign item 3) asks for the standard size the
 * customer picked; an unknown code falls back to the default size.
 */
export function dielineTargetOf(configurator: Configurator | null, sizeCode?: string | null): string | null {
  if (!configurator) return null;
  const pattern = defaultPatternOf(configurator);
  // An API that predates `dielineVariantCodes` (UAT before the pricing fix) omits the field: no variant, old fallback.
  const variant = (pattern?.dielineVariantCodes as string[] | undefined)?.[0];
  if (!pattern?.styleCode || !variant) return null;
  const size =
    (sizeCode ? configurator.standardSizes.find((candidate) => candidate.code === sizeCode) : undefined) ??
    defaultStandardSizeOf(configurator);
  const query = new URLSearchParams({ v: variant });
  if (size && size.heightMm > 0) {
    query.set("l", String(size.lengthMm));
    query.set("w", String(size.widthMm));
    query.set("h", String(size.heightMm));
  }
  return `${styleHref(pattern.styleCode, "")}?${query}#${DIELINE_FRAGMENT}`;
}
