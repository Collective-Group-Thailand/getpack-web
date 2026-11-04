import type { PointsMultipliers } from "@/features/shared/loyalty-p2/types";

export type MultiplierPart = "tier" | "paymentMethod" | "reorderCampaign" | "promotion";
const PARTS: readonly MultiplierPart[] = ["tier", "paymentMethod", "reorderCampaign", "promotion"];

/** A decimal string that is exactly one ("1", "1.0", "1.00"). */
const isOne = (value: string) => /^1(\.0+)?$/.test(value.trim());

/**
 * The multipliers worth naming in a points breakdown (D-495): the ones that are not ×1, in a fixed order, with the
 * API's own figures — the web never multiplies them (the combined figure and the points are the API's).
 */
export function multiplierParts(
  multipliers: PointsMultipliers | null | undefined,
): { part: MultiplierPart; value: string }[] {
  if (!multipliers) return [];
  return PARTS.filter((part) => !isOne(multipliers[part])).map((part) => ({
    part,
    value: multipliers[part].replace(/0+$/, "").replace(/\.$/, ""),
  }));
}

/** "1.50" → "1.5", "2.00" → "2": the figure as a customer reads it. */
export const shortMultiplier = (value: string) => value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
