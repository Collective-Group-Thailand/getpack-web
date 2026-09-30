import { describe, expect, it } from "vitest";

import {
  adminCompanyActions,
  adminOrderActions,
  type AdminOrderFacts,
  adminRfqActions,
  type AdminRfqFacts,
  adminCampaignActions,
  adminCouponActions,
  adminPromotionActions,
} from "./admin";

const everyone = () => true;
const nobody = () => false;
const keys = (facts: AdminOrderFacts, can: (permission: string) => boolean = everyone) =>
  adminOrderActions(facts, can).map((action) => action.key);

describe("adminOrderActions", () => {
  it("offers reminders, a recorded slip and cancelling while payment is awaited", () => {
    expect(keys({ status: "waiting_payment", artworkStatus: "awaiting_upload", slipToReview: false })).toEqual([
      "order.send_payment_reminder",
      "order.record_slip",
      "order.cancel",
    ]);
  });

  it("puts slip review first, and only for payments.verify_slip (D-061)", () => {
    const facts: AdminOrderFacts = { status: "waiting_payment", artworkStatus: "awaiting_upload", slipToReview: true };
    expect(keys(facts).slice(0, 2)).toEqual(["order.approve_slip", "order.reject_slip"]);
    expect(keys(facts, (permission) => permission !== "payments.verify_slip")).not.toContain("order.approve_slip");
  });

  it("offers a manual start as an exception, blocked until the artwork is approved (D-073)", () => {
    const approved = adminOrderActions(
      { status: "paid_for_production", artworkStatus: "approved", slipToReview: false },
      everyone,
    );
    expect(approved.find((action) => action.key === "order.start_production")).toEqual({
      key: "order.start_production",
      irreversible: true,
    });
    const pending = adminOrderActions(
      { status: "paid_for_production", artworkStatus: "in_review", slipToReview: false },
      everyone,
    );
    expect(pending.find((action) => action.key === "order.start_production")?.blockedBy).toBe("artwork_not_approved");
  });

  it("offers nothing once production started, and nothing without the permission", () => {
    expect(keys({ status: "in_production", artworkStatus: "approved", slipToReview: false })).toEqual([]);
    expect(keys({ status: "waiting_payment", artworkStatus: "awaiting_upload", slipToReview: true }, nobody)).toEqual(
      [],
    );
  });
});

describe("adminCompanyActions", () => {
  const companyKeys = (
    status: Parameters<typeof adminCompanyActions>[0],
    can: (permission: string) => boolean = everyone,
  ) => adminCompanyActions(status, can).map((action) => action.key);

  it("offers the KYC decision only while under review, and only for companies.kyc_review (D-120)", () => {
    expect(companyKeys("kyc_review")).toEqual(["approve-kyc", "reject-kyc", "close"]);
    expect(companyKeys("kyc_review", (permission) => permission === "companies.kyc_review")).toEqual([
      "approve-kyc",
      "reject-kyc",
    ]);
    expect(companyKeys("applied")).toEqual(["close"]);
  });

  it("suspends an active company and reactivates a suspended one, for companies.manage", () => {
    expect(companyKeys("active")).toEqual(["suspend", "close"]);
    expect(companyKeys("suspended")).toEqual(["reactivate", "close"]);
    expect(companyKeys("active", (permission) => permission === "companies.kyc_review")).toEqual([]);
  });

  it("asks a reason for everything but approving KYC, and offers nothing on a closed company", () => {
    const actions = adminCompanyActions("kyc_review", everyone);
    expect(actions.find((action) => action.key === "approve-kyc")?.needsReason).toBe(false);
    expect(actions.filter((action) => action.key !== "approve-kyc").every((action) => action.needsReason)).toBe(true);
    expect(adminCompanyActions("active", everyone).find((action) => action.key === "suspend")?.destructive).toBe(true);
    expect(companyKeys("closed")).toEqual([]);
    expect(companyKeys("kyc_review", nobody)).toEqual([]);
  });
});

describe("adminRfqActions", () => {
  const facts = (patch: Partial<AdminRfqFacts>): AdminRfqFacts => ({
    status: "submitted",
    hasDraft: false,
    draftBelowMarginFloor: false,
    hasSent: false,
    hasAcceptedQuotation: false,
    ...patch,
  });
  const rfqKeys = (rfq: AdminRfqFacts, can: (permission: string) => boolean = everyone) =>
    adminRfqActions(rfq, can).map((action) => action.key);

  it("starts a new request: review, assign, ask for information, or decline", () => {
    expect(rfqKeys(facts({}))).toEqual(["rfq.start_review", "rfq.assign", "rfq.request_info", "rfq.decline"]);
  });

  it("asks factories and composes a quote while in review, and leads with sending a draft", () => {
    expect(rfqKeys(facts({ status: "in_review" }))).toEqual([
      "rfq.request_factory_cost",
      "rfq.compose_quote",
      "rfq.request_info",
      "rfq.assign",
      "rfq.decline",
    ]);
    expect(rfqKeys(facts({ status: "need_info", hasDraft: true })).slice(0, 3)).toEqual([
      "rfq.send_quote",
      "rfq.request_factory_cost",
      "rfq.edit_quote",
    ]);
  });

  it("offers a draft under the margin floor blocked (D-012)", () => {
    const send = adminRfqActions(facts({ status: "in_review", hasDraft: true, draftBelowMarginFloor: true }), everyone);
    expect(send[0]).toEqual({ key: "rfq.send_quote", irreversible: true, blockedBy: "below_margin_floor" });
  });

  it("records an acceptance of a sent quote, and orders from the accepted quotation", () => {
    expect(rfqKeys(facts({ status: "quoted", hasSent: true }))).toEqual([
      "rfq.record_acceptance",
      "rfq.compose_quote",
      "rfq.assign",
      "rfq.decline",
    ]);
    expect(rfqKeys(facts({ status: "accepted", hasAcceptedQuotation: true }))).toEqual(["rfq.create_order"]);
    expect(
      rfqKeys(facts({ status: "accepted", hasAcceptedQuotation: true }), (permission) => permission === "rfqs.manage"),
    ).toEqual([]);
  });

  it("offers nothing on a closed request, and nothing without rfqs.manage", () => {
    expect(rfqKeys(facts({ status: "declined" }))).toEqual([]);
    expect(rfqKeys(facts({ status: "expired" }))).toEqual([]);
    expect(rfqKeys(facts({ status: "in_review" }), nobody)).toEqual([]);
  });
});

describe("adminCampaignActions", () => {
  const actions = (
    status: Parameters<typeof adminCampaignActions>[0],
    can: (permission: string) => boolean = everyone,
  ) => adminCampaignActions(status, can);

  it("activates a draft, pauses or ends a running campaign (D-154)", () => {
    expect(actions("draft")).toEqual([{ action: "activate" }]);
    expect(actions("scheduled")).toEqual([{ action: "pause" }, { action: "end" }]);
    expect(actions("active")).toEqual([{ action: "pause" }, { action: "end" }]);
  });

  it("resumes a paused campaign with activate, and only ends an exhausted one", () => {
    expect(actions("paused")).toEqual([{ action: "activate", resumes: true }, { action: "end" }]);
    expect(actions("exhausted")).toEqual([{ action: "end" }]);
    expect(actions("ended")).toEqual([]);
  });

  it("offers nothing without campaigns.manage", () => {
    expect(actions("active", (permission) => permission !== "campaigns.manage")).toEqual([]);
  });
});

describe("adminPromotionActions", () => {
  it("follows the promotion's status (D-053)", () => {
    expect(adminPromotionActions("draft", everyone)).toEqual([{ action: "activate" }]);
    expect(adminPromotionActions("active", everyone)).toEqual([{ action: "pause" }, { action: "end" }]);
    expect(adminPromotionActions("paused", everyone)).toEqual([
      { action: "activate", resumes: true },
      { action: "end" },
    ]);
    expect(adminPromotionActions("ended", everyone)).toEqual([]);
  });

  it("offers nothing without promotions.manage", () => {
    expect(adminPromotionActions("draft", (permission) => permission !== "promotions.manage")).toEqual([]);
  });
});

describe("adminCouponActions", () => {
  it("disables an active code and enables a disabled one", () => {
    expect(adminCouponActions({ status: "active" }, "active", everyone)).toEqual(["disable"]);
    expect(adminCouponActions({ status: "disabled" }, "active", everyone)).toEqual(["enable"]);
    expect(adminCouponActions({ status: "used_up" }, "active", everyone)).toEqual([]);
  });

  it("offers nothing on an ended promotion or without promotions.manage", () => {
    expect(adminCouponActions({ status: "active" }, "ended", everyone)).toEqual([]);
    expect(adminCouponActions({ status: "active" }, "active", nobody)).toEqual([]);
  });
});
