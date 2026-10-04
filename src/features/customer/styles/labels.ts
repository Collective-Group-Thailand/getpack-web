import type { FilterKey } from "./query";

/** A translator with `has`, as both `useTranslations` and `getTranslations` return for "styles". */
export interface StylesT {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

const word = (t: StylesT, key: string, fallback: string) => (t.has(key) ? t(key) : fallback);

/** An axis's name and one of its values, falling back to the API's code for a value not worded yet. */
export const axisLabel = (t: StylesT, axis: string) => word(t, `axes.${axis}`, axis);
export const valueLabel = (t: StylesT, axis: string, value: string) => word(t, `values.${axis}.${value}`, value);

/** A facet value's words: options read `axis: value`, the rest from their own lists. */
export function facetLabel(t: StylesT, facet: FilterKey, value: string): string {
  switch (facet) {
    case "closure":
    case "feature": {
      const [axis, option = ""] = value.split(":");
      return `${axisLabel(t, axis)}: ${valueLabel(t, axis, option)}`;
    }
    case "category":
      return word(t, `categories.${value}`, value);
    case "family":
      return word(t, `families.${value}`, value);
    case "materialClass":
      return word(t, `materialClasses.${value}`, value);
    case "pricePath":
      return word(t, `pricePaths.${value}`, value);
    case "useCase":
      return word(t, `useCases.${value}`, value);
  }
}
