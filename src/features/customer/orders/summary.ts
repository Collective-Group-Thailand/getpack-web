import { pick } from "@/features/customer/catalog/localize";
import type { Schemas } from "@/lib/api/types";

type Summary = Schemas["LineSummaryDto"];

/**
 * What a line, order or reorder is, in words, from its `LineSummaryDto` (U-B0.1): the catalogue
 * product's name when it has one, else the product type's; and the spec lines the quotation
 * recorded. Selecting the page's language is all this does — every word is the API's.
 */
export function productNameOf(locale: string, summary: Summary): string {
  return summary.product
    ? pick(locale, summary.product.nameTh, summary.product.nameEn)
    : pick(locale, summary.productTypeNameTh, summary.productTypeNameEn);
}

export function specLinesOf(locale: string, summary: Summary): { term: string; description: string }[] {
  return summary.specs.map((line) => ({
    term: pick(locale, line.labelTh, line.labelEn),
    description: pick(locale, line.valueTh, line.valueEn),
  }));
}
