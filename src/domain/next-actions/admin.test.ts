import { describe, expect, it } from "vitest";

import {
  adminClaimActions,
  adminClaimResolutions,
  adminOrderActions,
  adminShipmentActions,
  type AdminClaimFacts,
  type AdminOrderFacts,
  type AdminShipmentFacts,
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

describe("adminShipmentActions", () => {
  const ready: AdminShipmentFacts = { status: "ready", carrier: "factory_fleet", hasPod: false, podReviewed: false };
  const shipmentKeys = (facts: AdminShipmentFacts, can: (permission: string) => boolean = everyone) =>
    adminShipmentActions(facts, can).map((action) => action.key);

  it("splits and books a fallback carrier while the shipment waits at the factory (D-013, D-114)", () => {
    expect(shipmentKeys(ready)).toEqual(["shipment.split", "shipment.book_carrier"]);
    expect(shipmentKeys({ ...ready, carrier: "flash_express" })).toEqual(["shipment.split"]);
    expect(shipmentKeys({ ...ready, status: "draft" })).toEqual(["shipment.split"]);
  });

  it("resolves a failed or returned delivery", () => {
    expect(shipmentKeys({ ...ready, status: "failed" })).toEqual(["shipment.resolve_exception"]);
    expect(shipmentKeys({ ...ready, status: "returned" })).toEqual(["shipment.resolve_exception"]);
  });

  it("reviews a recorded POD once", () => {
    const delivered: AdminShipmentFacts = { ...ready, status: "delivered", hasPod: true };
    expect(shipmentKeys(delivered)).toEqual(["shipment.accept_pod", "shipment.reject_pod"]);
    expect(shipmentKeys({ ...delivered, podReviewed: true })).toEqual([]);
    expect(shipmentKeys({ ...delivered, hasPod: false })).toEqual([]);
  });

  it("offers nothing on the road, and nothing without shipments.manage", () => {
    expect(shipmentKeys({ ...ready, status: "in_transit" })).toEqual([]);
    expect(shipmentKeys(ready, nobody)).toEqual([]);
  });
});

describe("adminClaimActions", () => {
  const claimKeys = (status: AdminClaimFacts["status"], can: (permission: string) => boolean = everyone) =>
    adminClaimActions({ status }, can).map((action) => action.key);

  it("follows the D-082 flow, one published operation per step", () => {
    expect(claimKeys("submitted")).toEqual(["claim.review", "claim.reject", "claim.override_liability"]);
    expect(claimKeys("under_review")).toEqual([
      "claim.request_info",
      "claim.send_to_factory",
      "claim.approve",
      "claim.reject",
      "claim.override_liability",
    ]);
    expect(claimKeys("need_info")).toEqual(["claim.review", "claim.reject", "claim.override_liability"]);
    expect(claimKeys("factory_review")).toEqual(["claim.approve", "claim.reject", "claim.override_liability"]);
    expect(claimKeys("closed")).toEqual([]);
  });

  it("resolves an approved claim with claims.resolve, and closes it with claims.manage", () => {
    expect(claimKeys("approved")).toEqual(["claim.resolve", "claim.close"]);
    expect(claimKeys("approved", (permission) => permission !== "claims.resolve")).toEqual(["claim.close"]);
    expect(claimKeys("resolved")).toEqual(["claim.close"]);
  });

  it("overrides liability only before the decision, with its own permission (D-083)", () => {
    expect(claimKeys("approved")).not.toContain("claim.override_liability");
    expect(claimKeys("under_review", (permission) => permission === "claims.override_liability")).toEqual([
      "claim.override_liability",
    ]);
    expect(claimKeys("under_review", nobody)).toEqual([]);
  });
});

describe("adminClaimResolutions", () => {
  it("offers what the liable party's mechanism allows (D-083)", () => {
    expect(adminClaimResolutions("factory")).toContain("factory_deduction");
    expect(adminClaimResolutions("carrier")).toContain("carrier_recovery");
    expect(adminClaimResolutions("undetermined")).toEqual(["refund", "credit_note", "store_credit"]);
  });
});
