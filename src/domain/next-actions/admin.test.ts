import { describe, expect, it } from "vitest";

import { adminOrderActions, type AdminOrderFacts } from "./admin";

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
