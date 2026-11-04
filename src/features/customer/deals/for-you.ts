import type { Deal } from "@/features/shared/deals/types";

/**
 * The reason line of a deal in "สำหรับคุณ" (loyalty P2, D-494). Only the three reasons the API may disclose are
 * worded; a match on a business type or on inactivity comes with `forYouReason: null` and shows no line, so no card
 * ever names an internal attribute.
 */
export function forYouReasonText(
  deal: Deal,
  words: {
    newCustomer: string;
    tier: string;
    orderedType: (type: string) => string;
    orderedAny: string;
  },
  typeNames: Record<string, string>,
): string | null {
  const { forYou, forYouReason } = deal;
  if (!forYou || !forYouReason) return null;
  if (forYouReason === "new_customer") return words.newCustomer;
  if (forYouReason === "tier") return words.tier;
  const type = deal.productTypeCodes.map((code) => typeNames[code]).find(Boolean);
  return type ? words.orderedType(type) : words.orderedAny;
}
