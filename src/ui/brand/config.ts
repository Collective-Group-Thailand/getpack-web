/**
 * Brand values are configuration, not copy scattered through the app
 * (docs/prompts/design-system.md §2, docs/ui/brand.md).
 *
 * The brand *hue* is no longer here: it lives in `src/ui/tokens/primitives.ts` as the `brand`
 * palette, reached through the semantic `primary` tokens, so the logo and every button follow
 * one placeholder value until the brand kit lands.
 *
 * The Thai tagline is no longer here either — it is copy, and copy lives in `src/i18n`
 * (`common.brand.tagline`). The English name, tagline and company stay because they are the
 * legal identity rather than translatable text: they read the same in both locales.
 */
export const BRAND_NAME = "Packio";
export const BRAND_TAGLINE = "Your Packaging Production Partner";
export const BRAND_COMPANY = "Collective Group (Thailand)";
