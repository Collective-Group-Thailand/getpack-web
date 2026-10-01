import { describe, expect, it } from "vitest";

import {
  adminCampaignActions,
  adminCouponActions,
  adminPrepressActions,
  adminPromotionActions,
  adminSubmissionActions,
  type AdminPrepressFacts,
} from "./admin";

const everyone = () => true;
const nobody = () => false;

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
