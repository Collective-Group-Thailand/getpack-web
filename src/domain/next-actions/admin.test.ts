import { describe, expect, it } from "vitest";

import {
  adminCampaignActions,
  adminCouponActions,
  adminOrderActions,
  adminPromotionActions,
  type AdminOrderFacts,
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
