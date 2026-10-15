/**
 * The products the library's styles are grouped by (D-410) — the master file's `use_cases`, each
 * a page of its own ("กล่องครีม", "กล่องสบู่"). Listed in the order the storefront shows them.
 */
export const USE_CASES = [
  "cosmetics",
  "soap",
  "supplements",
  "food",
  "snack",
  "bakery",
  "beverage",
  "tea_coffee",
  "jewelry",
  "apparel",
  "electronics",
  "candle_fragrance",
  "produce",
  "gift",
  "luxury",
  "retail",
  "ecommerce",
  "shipping",
  "protection",
  "branding",
] as const;

export type UseCase = (typeof USE_CASES)[number];

export const isUseCase = (value: string): value is UseCase => (USE_CASES as readonly string[]).includes(value);
