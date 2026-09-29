/**
 * The mock's seeded orders the walks start from (`mocks/admin/commerce.ts`). A moderated round
 * uses the UAT environment's equivalents, listed in its results file (`moderator-guide.md` §3).
 */

/** Order 32, the `receiver` persona's: delivered yesterday, 970 of 1,000 (T8, T9). */
export const DELIVERED = { id: "00000000-0000-4000-8000-6f7264000020", code: "PK-2569-00131" } as const;

/** Order 26, the `buyer` persona's: in production, due to ship in two days (T7). */
export const IN_PRODUCTION = { id: "00000000-0000-4000-8000-6f726400001a", code: "PK-2569-00125" } as const;

/** Order 37, the `returning` persona's: completed, paid, with its tax invoice/receipt TR (T10). */
export const INVOICED = { id: "00000000-0000-4000-8000-6f7264000025", code: "PK-2569-00136" } as const;
