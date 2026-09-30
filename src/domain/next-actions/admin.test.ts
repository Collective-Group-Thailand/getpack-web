import { describe, expect, it } from "vitest";

import {
  adminDesignActions,
  adminOrderActions,
  adminPrepressActions,
  adminSubmissionActions,
  type AdminOrderFacts,
  type AdminPrepressFacts,
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

describe("adminPrepressActions", () => {
  const facts = (overrides: Partial<AdminPrepressFacts>): AdminPrepressFacts => ({
    artworkStatus: "in_review",
    latestSubmission: null,
    latestProof: null,
    designService: null,
    ...overrides,
  });
  const prepressKeys = (given: AdminPrepressFacts, can: (permission: string) => boolean = everyone) =>
    adminPrepressActions(given, can).map((action) => action.key);

  it("offers a proof once the newest file is accepted and no proof waits (D-070)", () => {
    expect(prepressKeys(facts({ latestSubmission: "accepted_for_proof" }))[0]).toBe("prepress.upload_proof");
    expect(prepressKeys(facts({ latestSubmission: "accepted_for_proof", latestProof: "changes_requested" }))[0]).toBe(
      "prepress.upload_proof",
    );
    expect(
      prepressKeys(facts({ latestSubmission: "accepted_for_proof", latestProof: "pending_customer" })),
    ).not.toContain("prepress.upload_proof");
    expect(prepressKeys(facts({ latestSubmission: "submitted" }))).not.toContain("prepress.upload_proof");
  });

  it("offers the template while the order waits for it or for files", () => {
    expect(prepressKeys(facts({ artworkStatus: "awaiting_template" }))).toContain("prepress.send_template");
    expect(prepressKeys(facts({ artworkStatus: "awaiting_upload" }))).toContain("prepress.send_template");
    expect(prepressKeys(facts({ artworkStatus: "proof_sent" }))).not.toContain("prepress.send_template");
  });

  it("delivers a round in progress and requotes an open design, for design_services.manage (D-071)", () => {
    expect(prepressKeys(facts({ designService: "in_progress" }))).toEqual([
      "prepress.deliver_round",
      "prepress.assign",
      "prepress.draw_dieline",
      "prepress.requote_design",
    ]);
    expect(prepressKeys(facts({ designService: "revision_requested" }))).toContain("prepress.requote_design");
    expect(prepressKeys(facts({ designService: "approved" }))).not.toContain("prepress.requote_design");
    expect(
      prepressKeys(facts({ designService: "in_progress" }), (permission) => permission !== "design_services.manage"),
    ).toEqual(["prepress.assign", "prepress.draw_dieline"]);
  });

  it("draws the dieline for drawings.generate alone, and offers nothing without a permission", () => {
    expect(prepressKeys(facts({}), (permission) => permission === "drawings.generate")).toEqual([
      "prepress.draw_dieline",
    ]);
    expect(
      prepressKeys(facts({ latestSubmission: "accepted_for_proof", designService: "in_progress" }), nobody),
    ).toEqual([]);
  });
});

describe("adminSubmissionActions", () => {
  it("accepts or sends back a submitted file; a blocking or running preflight cannot be accepted", () => {
    expect(adminSubmissionActions({ status: "submitted", preflightStatus: "passed_with_warnings" }, everyone)).toEqual([
      { key: "submission.accept" },
      { key: "submission.reject" },
    ]);
    expect(adminSubmissionActions({ status: "submitted", preflightStatus: "blocked" }, everyone)[0]).toEqual({
      key: "submission.accept",
      blockedBy: "preflight_blocked",
    });
    expect(adminSubmissionActions({ status: "submitted", preflightStatus: "running" }, everyone)[0]?.blockedBy).toBe(
      "preflight_pending",
    );
  });

  it("offers nothing once decided, or without prepress.review", () => {
    expect(adminSubmissionActions({ status: "accepted_for_proof", preflightStatus: "passed" }, everyone)).toEqual([]);
    expect(adminSubmissionActions({ status: "submitted", preflightStatus: "passed" }, nobody)).toEqual([]);
  });
});

describe("adminDesignActions", () => {
  it("saves for catalog.manage and copies for prepress.review", () => {
    expect(adminDesignActions(everyone)).toEqual({ save: true, copy: true });
    expect(adminDesignActions((permission) => permission === "prepress.review")).toEqual({ save: false, copy: true });
    expect(adminDesignActions(nobody)).toEqual({ save: false, copy: false });
  });
});
