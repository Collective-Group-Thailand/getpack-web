/** The storefront's contact topic keys — the same values as the old subject list; the API routes them (D-458). */
export const INTENTS = [
  "order",
  "quote",
  "artwork",
  "payment",
  "delivery",
  "business",
  "partnership",
  "other",
] as const;
export type Intent = (typeof INTENTS)[number];
