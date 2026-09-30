import { describe, expect, it } from "vitest";

import { adminOrderActions, type AdminOrderFacts, adminRfqActions, type AdminRfqFacts } from "./admin";

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
