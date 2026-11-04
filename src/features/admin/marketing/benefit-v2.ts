/**
 * Loyalty P3 (D-497): benefit schema v2 in the promotion editor — the v2 kinds' bodies and the
 * `benefitSchemaVersion: 2` that goes beside them. A v1 benefit stays v1 (no version sent); `free_shipping` becomes v2
 * only when it carries a cap. The published `PromotionBenefitDto` does not know v2 yet (CONTRACT-REQUEST
 * admin.loyalty.p3-fields), so the editor casts at its one call site.
 */

import type { BenefitV2 } from "@/lib/api/requests/admin-loyalty-p3";

/** The editor's benefit draft, as far as v2 reads it: the numbers still as typed. */
export interface BenefitV2Draft {
  type: string;
  maxAmount: string;
  daysSaved: string;
  addonCode: string;
  rounds: string;
}

const filled = (value: string) => value.trim() !== "";
const money = (value: string) => (filled(value) ? Number(value).toFixed(2) : null);
const count = (value: string) => (filled(value) ? Math.trunc(Number(value)) : null);

/** The v2 body of a v2 kind; null for a v1 benefit (the editor's own body applies). */
export function benefitV2Body(benefit: BenefitV2Draft): BenefitV2 | null {
  const cap = money(benefit.maxAmount);
  const capped = cap ? { maxAmount: cap } : {};
  switch (benefit.type) {
    case "free_sample":
      return { type: "free_sample", ...capped };
    case "free_rush":
      return { type: "free_rush", daysSaved: count(benefit.daysSaved) ?? 0 };
    case "free_addon":
      return { type: "free_addon", addonCode: benefit.addonCode.trim(), ...capped };
    case "revision_round":
      return { type: "revision_round", rounds: count(benefit.rounds) ?? 0 };
    case "free_shipping":
      // v1 had no cap; with one, the benefit is v2.
      return cap ? { type: "free_shipping", maxAmount: cap } : null;
    default:
      return null;
  }
}

/** `benefitSchemaVersion: 2` next to a v2 benefit; the body unchanged otherwise. */
export function withSchemaVersion<T extends object>(body: T, benefit: BenefitV2Draft): T {
  return benefitV2Body(benefit) ? ({ ...body, benefitSchemaVersion: 2 } as T) : body;
}
