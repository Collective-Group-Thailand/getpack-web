import { describe, expect, it } from "vitest";

import { pointsLiabilityMemo, refAgentP2Fields } from "@/lib/api/requests/admin-loyalty-p2";
import {
  checkoutPointsP2Fields,
  dealP2Fields,
  loyaltySummaryP2Fields,
  reorderSuggestionP2Fields,
} from "@/lib/api/requests/store-loyalty-p2";

import {
  checkoutPointsP2Of,
  dealP2Of,
  loyaltySummaryP2Of,
  pointsLiabilityOf,
  promotionP2Of,
  refAgentP2Of,
  reorderSuggestionP2Of,
} from "./read";

const bundle = {
  items: [
    {
      productTypeCode: "corrugated",
      productTypeName: "กล่อง",
      summary: "30 × 20 × 15 ซม.",
      quantity: 500,
      unit: "ใบ",
      unitPrice: "14.79",
    },
    {
      productTypeCode: "label_sticker",
      productTypeName: "สติกเกอร์",
      summary: "5 ซม.",
      quantity: 1000,
      unit: "ดวง",
      unitPrice: "1.20",
    },
  ],
  estimatedSaving: "640.00",
};

describe("P2 readers of published responses", () => {
  it("read a deal's P2 fields exactly as the schema describes them", () => {
    const raw = { id: "x", forYou: true, forYouReason: "ordered_product_type", bundle };
    expect(dealP2Of(raw)).toEqual(dealP2Fields.parse(raw));
  });

  it("read a deal without P2 fields as nothing new", () => {
    expect(dealP2Of({ id: "x" })).toEqual({ forYou: false, forYouReason: null, bundle: null });
  });

  it("never disclose a reason the contract does not allow", () => {
    expect(dealP2Of({ forYou: true, forYouReason: "inactive_days" }).forYouReason).toBeNull();
    expect(dealP2Of({ forYou: true, forYouReason: "business_type" }).forYouReason).toBeNull();
  });

  it("drop a bundle with a malformed item rather than show part of it", () => {
    const broken = { ...bundle, items: [bundle.items[0], { ...bundle.items[1], unitPrice: 1.2 }] };
    expect(dealP2Of({ bundle: broken }).bundle).toBeNull();
  });

  it("read the summary's bonus lots", () => {
    const raw = {
      bonusLots: [{ points: 40, reason: "winback", expiresAt: "2026-12-04T23:59:59+07:00" }],
      activeCampaigns: 1,
    };
    expect(loyaltySummaryP2Of(raw)).toEqual(loyaltySummaryP2Fields.parse(raw));
    expect(loyaltySummaryP2Of({})).toEqual({ bonusLots: [], activeCampaigns: 0 });
  });

  it("read a suggestion's prediction and bonus", () => {
    const raw = {
      predictedStockOutOn: "2026-11-18",
      bonus: { multiplier: "1.50", endsAt: "2026-11-12T09:40:00+07:00" },
    };
    expect(reorderSuggestionP2Of(raw)).toEqual(reorderSuggestionP2Fields.parse(raw));
    expect(reorderSuggestionP2Of({})).toEqual({ predictedStockOutOn: null, bonus: null });
  });

  it("read the checkout points breakdown", () => {
    const raw = {
      multipliers: {
        tier: "1.25",
        paymentMethod: "1.00",
        reorderCampaign: "1.50",
        promotion: "1.00",
        combined: "1.88",
        capped: false,
      },
      paymentBonus: { multiplier: "1.20", methods: ["scb_qr"] },
      toEarnWithPaymentBonus: 27,
    };
    expect(checkoutPointsP2Of(raw)).toEqual(checkoutPointsP2Fields.parse(raw));
    expect(checkoutPointsP2Of(null)).toEqual({ multipliers: null, paymentBonus: null, toEarnWithPaymentBonus: null });
  });

  it("read the admin promotion's audience, bundle and listing", () => {
    const read = promotionP2Of({
      conditions: { audience: { tiers: ["silver"] }, cartProductTypeCountGte: 2 },
      display: {
        listing: "matching_only",
        bundle: { items: [{ productTypeCode: "a", configuration: {}, quantity: 5 }] },
      },
    });
    expect(read).toEqual({
      audience: { tiers: ["silver"] },
      cartProductTypeCountGte: 2,
      listing: "matching_only",
      bundleItems: [{ productTypeCode: "a", configuration: {}, quantity: 5 }],
    });
    expect(promotionP2Of({ conditions: {}, display: null }).listing).toBe("everyone");
  });

  it("read the agent performance fields and the P&L memo", () => {
    const agent = {
      agentCode: "A",
      visitors: 1,
      visits: 2,
      signups: 1,
      customers: 1,
      orderGroups: 1,
      grossAmount: "10.00",
      discountAmount: "1.00",
      redemptions: 1,
    };
    expect(refAgentP2Of(agent)).toEqual(expect.objectContaining(refAgentP2Fields.parse(agent)));
    expect(refAgentP2Of({ agentCode: "A", visitors: 1, visits: 2 })).toBeNull();
    const memo = {
      asOf: "2026-10-31",
      outstandingPoints: 182400,
      faceValue: "456000.00",
      expectedRedemptionRatePct: "60",
      rateConfirmation: "pending_cpa",
      estimatedLiability: "273600.00",
      ledgerBalance2330: "270150.00",
      pointsExpenseInPeriod: "4860.00",
      source: "loyalty.expected_redemption_rate_pct",
    };
    expect(pointsLiabilityOf({ pointsLiability: memo })).toEqual(pointsLiabilityMemo.parse(memo));
    expect(pointsLiabilityOf({ lines: [] })).toBeNull();
  });
});
