import { describe, expect, it } from "vitest";

import { artworkActions, orderActions, type ArtworkFacts, type OrderFacts } from "./store";

const facts = (overrides: Partial<OrderFacts>): OrderFacts => ({
  status: "in_production",
  artworkStatus: "approved",
  designOption: "own_file",
  delivered: false,
  instalmentDue: false,
  ...overrides,
});
const keys = (overrides: Partial<OrderFacts>) => orderActions(facts(overrides)).map((action) => action.key);

describe("the actions offered on an order until the API sends them", () => {
  it("offers paying while an instalment is due on an open order, never on a closed one", () => {
    expect(keys({ status: "waiting_payment", instalmentDue: true })).toContain("order.pay_instalment");
    expect(keys({ status: "cancelled", instalmentDue: true })).not.toContain("order.pay_instalment");
  });

  it("asks for artwork, or for the brief when Packio designs it", () => {
    expect(keys({ artworkStatus: "awaiting_upload" })).toEqual(["order.upload_artwork"]);
    expect(keys({ artworkStatus: "changes_requested", designOption: "hired_design" })).toEqual(["order.design_brief"]);
    expect(keys({ artworkStatus: "proof_sent" })).toEqual(["order.approve_proof"]);
  });

  it("offers receiving, claiming and reordering once a delivery arrived (D-081, D-082, D-153)", () => {
    expect(keys({ status: "shipping" })).toEqual([]);
    expect(keys({ status: "shipping", delivered: true })).toEqual([
      "order.confirm_receipt",
      "order.open_claim",
      "order.reorder",
    ]);
    expect(keys({ status: "completed", delivered: true })).toEqual(["order.open_claim", "order.reorder"]);
  });
});

describe("the artwork actions offered until the API sends them", () => {
  const base: ArtworkFacts = {
    artworkStatus: "awaiting_upload",
    designOption: "own_file",
    latest: null,
    proofPending: false,
    designServiceStatus: null,
  };

  it("asks for a file until one is accepted, again after a blocked preflight, never while a proof waits", () => {
    expect(artworkActions(base).upload).toBe(true);
    expect(artworkActions({ ...base, artworkStatus: "in_review" }).upload).toBe(false);
    expect(
      artworkActions({
        ...base,
        artworkStatus: "in_review",
        latest: { preflightStatus: "blocked", status: "rejected" },
      }).upload,
    ).toBe(true);
    expect(artworkActions({ ...base, artworkStatus: "proof_sent", proofPending: true })).toMatchObject({
      upload: false,
      reviewProof: true,
    });
  });

  it("walks hired design from the brief to the delivered design (D-071)", () => {
    const hired = { ...base, designOption: "hired_design" as const };
    expect(artworkActions({ ...hired, designServiceStatus: "brief_pending" })).toMatchObject({
      upload: false,
      submitBrief: true,
    });
    expect(artworkActions({ ...hired, designServiceStatus: "delivered", proofPending: true }).reviewDesign).toBe(true);
  });
});
