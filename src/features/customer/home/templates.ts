import type { StyleCard } from "@/features/customer/catalog/api.server";

/**
 * The seven templates the home page leads with, in the "Main" board's order: the shapes a small
 * brand already knows (the board's "ไม่ต้องเริ่มจากศูนย์") — the lid box as the feature card, then the
 * mailer, the tuck-end carton, the rope-handle bag, the bakery (SOS) bag, the flat label/wrap and the
 * sleeve. Each has a photo slot in the home-photos manifest (`template-<name>`).
 */
export const HOME_TEMPLATE_CODES = [
  "PK-LB-01", // two-piece telescope (lid and base)
  "PK-CF-01", // roll-end tuck-front mailer
  "PK-TE-01", // straight tuck end
  "PK-PG-01", // paper carrier bag, twisted handles
  "PK-PG-02", // SOS (bakery) bag
  "PK-LA-02", // flat rectangle: label, sticker, wrap
  "PK-SL-01", // sleeve
] as const;

/**
 * The home's templates: the curated codes the library publishes, in their order; when some are not
 * published (a fresh stack, a withdrawn base) the most popular styles fill the row back to seven,
 * never repeating one.
 */
export function homeTemplates(published: StyleCard[], popular: StyleCard[], count = HOME_TEMPLATE_CODES.length) {
  const byCode = new Map(published.map((style) => [style.code, style]));
  const chosen = HOME_TEMPLATE_CODES.map((code) => byCode.get(code)).filter((style): style is StyleCard => !!style);
  const seen = new Set(chosen.map((style) => style.code));
  for (const style of popular) {
    if (chosen.length >= count) break;
    if (!seen.has(style.code)) {
      chosen.push(style);
      seen.add(style.code);
    }
  }
  return chosen.slice(0, count);
}
