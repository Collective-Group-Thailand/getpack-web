import { describe, expect, it } from "vitest";

import { orderActions, type OrderFacts } from "./store";

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
