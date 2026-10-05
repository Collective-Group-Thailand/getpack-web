import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { actionHref, stepHref } from "./launchpad-paths";

const EMPTY: Schemas["LaunchpadDto"] = {
  designs: [],
  needsAction: [],
  reorderCandidates: [],
  nextStep: { kind: "start_configuration", target: null, targetId: null },
};

describe("the launchpad's next step (D-297)", () => {
  it("sends each order action to the page where it is done", () => {
    expect(actionHref({ action: "pay", subject: "order", id: "o1" })).toBe("/account/orders/o1#instalments");
    expect(actionHref({ action: "approve_proof", subject: "order", id: "o1" })).toBe("/account/orders/o1/proof");
    expect(actionHref({ action: "upload_artwork", subject: "order", id: "o1" })).toBe("/account/orders/o1/artwork");
    expect(actionHref({ action: "confirm_receipt", subject: "order", id: "o1" })).toBe("/account/orders/o1");
    // A group is paid from the orders list: there is no group page in the account.
    expect(actionHref({ action: "pay", subject: "order_group", id: "g1" })).toBe("/account/orders");
  });

  it("opens a reorder by the order, or the suggestion's order", () => {
    expect(stepHref({ kind: "reorder", target: "order_reorder", targetId: "o9" }, EMPTY)).toBe(
      "/account/orders/o9/reorder",
    );
    const withSuggestion: Schemas["LaunchpadDto"] = {
      ...EMPTY,
      reorderCandidates: [
        {
          source: "suggestion",
          suggestionId: "s1",
          orderId: "o7",
          orderCode: "PK-1",
          productType: { id: "t", code: "folding", nameTh: "กล่องพับ", nameEn: "Folding" },
          quantity: 1000,
          suggestedOn: "2026-10-10",
          suggestedQuantity: 1000,
          due: true,
        },
      ],
    };
    expect(stepHref({ kind: "reorder", target: "reorder_suggestion", targetId: "s1" }, withSuggestion)).toBe(
      "/account/orders/o7/reorder",
    );
    // An unknown suggestion still lands somewhere useful.
    expect(stepHref({ kind: "reorder", target: "reorder_suggestion", targetId: "zz" }, EMPTY)).toBe(
      "/account/replenishment",
    );
  });

  it("resumes a design in the studio and starts a configuration from the catalogue", () => {
    expect(stepHref({ kind: "resume_design", target: "design", targetId: "d1" }, EMPTY)).toMatch(/^\/studio\/d1\?/);
    expect(stepHref(EMPTY.nextStep, EMPTY)).toBe("/products");
  });
});
