import { describe, expect, it } from "vitest";

import {
  creditUplift,
  creditVersionP3Fields,
  loyaltyCampaignListP3Fields,
  promotionP3Fields,
} from "@/lib/api/requests/admin-loyalty-p3";
import { loyaltySummaryP3Fields } from "@/lib/api/requests/store-loyalty-p3";

import { benefitV2FieldsOf, campaignP3Of, creditUpliftOf, creditVersionP3Of, loyaltyP3Of, promotionP3Of } from "./read";

const SAMPLE_SUMMARY = {
  tier: "platinum",
  nextTier: null,
  perks: [
    { code: "free_shipping_every_order", status: "active" },
    { code: "quarterly_free_rush", status: "granted", period: "2026-Q4", couponExpiresAt: "2027-01-31T23:59:59+07:00" },
    { code: "a_perk_from_the_future", status: "active" },
  ],
  nextTierPerks: [],
  activeMultipliers: [
    { source: "tier", multiplier: "2.00" },
    { source: "anniversary", multiplier: "2.00", endsOn: "2026-11-30" },
    { source: "campaign", multiplier: "1.50", name: "สะสมแต้มกล่องลูกฟูก", endsAt: "2026-11-30T23:59:59+07:00" },
  ],
  maxCombinedMultiplier: "3.00",
  anniversaryMonth: 11,
  rewardCoupons: 2,
};

describe("loyaltyP3Of", () => {
  it("reads the API-CHANGES-P3 sample, Platinum included, and matches the schema", () => {
    const read = loyaltyP3Of(SAMPLE_SUMMARY);
    expect(read.tier).toBe("platinum");
    expect(read.perks.map((perk) => perk.code)).toEqual(["free_shipping_every_order", "quarterly_free_rush"]);
    expect(read.activeMultipliers).toHaveLength(3);
    const { tier, nextTier, ...fields } = read;
    void [tier, nextTier];
    expect(loyaltySummaryP3Fields.safeParse(fields).success).toBe(true);
  });

  it("reads a pre-P3 summary as nothing new", () => {
    expect(loyaltyP3Of({ tier: "silver", nextTier: "gold" })).toEqual({
      tier: "silver",
      nextTier: "gold",
      perks: [],
      nextTierPerks: [],
      activeMultipliers: [],
      maxCombinedMultiplier: "3.00",
      anniversaryMonth: null,
      rewardCoupons: 0,
    });
  });
});

describe("promotionP3Of", () => {
  it("defaults to a manual v1 promotion", () => {
    expect(promotionP3Of({})).toEqual({ benefitSchemaVersion: 1, origin: "manual", capacityDeal: null });
  });

  it("reads a capacity deal with its approval", () => {
    const read = promotionP3Of({
      benefitSchemaVersion: 1,
      origin: "capacity_deal",
      capacityDeal: {
        weekStart: "2026-11-09",
        productTypeCode: "corrugated_rsc",
        freePct: "41.50",
        approval: { id: "0192f3a0-7c1e-7d2a-9b1f-0000000a9001", status: "pending" },
      },
    });
    expect(read.capacityDeal?.approval?.status).toBe("pending");
    expect(promotionP3Fields.safeParse(read).success).toBe(true);
  });

  it("reads benefit v2 fields off any benefit", () => {
    expect(benefitV2FieldsOf({ type: "free_rush", daysSaved: 2 })).toEqual({ daysSaved: 2, addonCode: null });
    expect(benefitV2FieldsOf({ type: "free_addon", addonCode: "spot_uv" })).toEqual({
      daysSaved: null,
      addonCode: "spot_uv",
    });
  });
});

describe("credit readers", () => {
  it("reads a version without P3 fields as a request", () => {
    const read = creditVersionP3Of({ id: "x" });
    expect(read).toEqual({ origin: "request", baseVersionId: null, upliftFactor: null, companyTier: null });
    expect(creditVersionP3Fields.safeParse(read).success).toBe(true);
  });

  it("reads the uplift and refuses a malformed one", () => {
    const uplift = {
      mode: "frozen",
      modeReason: "รอตรวจงบการเงินปี 2569 ก่อนปรับวงเงิน",
      baseLimit: "600000.00",
      companyTier: "platinum",
      companySpend12m: "612400.00",
      target: "1200000.00",
      capped: true,
      aboveCapTarget: "1200000.00",
    };
    expect(creditUplift.safeParse(creditUpliftOf({ uplift })).success).toBe(true);
    expect(creditUpliftOf({ uplift: { ...uplift, mode: "sometimes" } })).toBeNull();
    expect(creditUpliftOf({ uplift: { ...uplift, companySpend12m: 612400 } })).toBeNull();
    expect(creditUpliftOf({})).toBeNull();
  });
});

describe("campaignP3Of", () => {
  it("reads an admin rule campaign and keeps the audience's known keys only", () => {
    const read = campaignP3Of({
      kind: "admin_rule",
      name: "สะสมแต้มกล่องลูกฟูก ×1.5",
      productTypeCodes: ["corrugated_rsc"],
      audience: { tiers: ["silver", "gold", "diamond"], somethingElse: true },
      createdBy: { id: "0192f3a0-7c1e-7d2a-9b1f-000000000007", displayName: "ฝ่ายการตลาด" },
    });
    expect(read.audience).toEqual({ tiers: ["silver", "gold"] });
    expect(loyaltyCampaignListP3Fields.safeParse(read).success).toBe(true);
  });

  it("reads a P2 row as before", () => {
    expect(campaignP3Of({ kind: "reorder_bonus" })).toMatchObject({
      kind: "reorder_bonus",
      name: null,
      audience: null,
    });
  });
});
