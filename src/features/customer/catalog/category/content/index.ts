import { CATEGORY_CONTENT } from "./entries";
import { approved, type CategoryContent } from "./schema";

export { approved, type CategoryContent } from "./schema";

/**
 * What a category page may show of its content: only approved entries survive; the rest are removed so a
 * caller cannot render a draft by mistake.
 */
export function contentFor(code: string, source: readonly CategoryContent[] = CATEGORY_CONTENT): CategoryContent {
  const entry = source.find((candidate) => candidate.categoryCode === code);
  if (!entry) return { categoryCode: code };
  const products = entry.products
    ? Object.fromEntries(Object.entries(entry.products).filter(([, value]) => approved(value)))
    : undefined;
  return {
    categoryCode: code,
    ...(approved(entry.intro) ? { intro: entry.intro } : {}),
    ...(approved(entry.useCases) ? { useCases: entry.useCases } : {}),
    ...(products && Object.keys(products).length ? { products } : {}),
    ...(approved(entry.sizeFinder) ? { sizeFinder: entry.sizeFinder } : {}),
    ...(approved(entry.guide) ? { guide: entry.guide } : {}),
    ...(approved(entry.styles) ? { styles: entry.styles } : {}),
    ...(approved(entry.faq) ? { faq: entry.faq } : {}),
  };
}
