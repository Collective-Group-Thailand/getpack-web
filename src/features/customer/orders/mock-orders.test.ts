// @vitest-environment node
import { describe, expect, it } from "vitest";

import { orders } from "../../../../mocks/admin/commerce";
import { toStoreOrderDto } from "../../../../mocks/store/order-dto";

import { artworkNoteOf, isHeldByClaim, visibleActions } from "./order-state";

/** The mock's seeded orders, as the storefront serves them — the contract's rules hold on every one (account §2–§3). */
const dtos = orders.map(toStoreOrderDto);

describe("the seeded orders against the account contract", () => {
  it("covers a delivered order with an open claim", () => {
    expect(dtos.some((dto) => dto.customerStatus === "claim_in_review")).toBe(true);
  });

  it("a delivered order with an open claim reads claim_in_review, holds completion, offers no confirm-receipt and no auto-confirm date", () => {
    for (const dto of dtos.filter((row) => row.openClaims.length > 0 && row.receipt.deliveredAt)) {
      expect(dto.customerStatus).toBe("claim_in_review");
      expect(dto.receipt.autoCompleteAt).toBeNull();
      expect(isHeldByClaim(dto)).toBe(true);
      const keys = dto.nextActions.map((action) => action.key);
      expect(keys).not.toContain("order.confirm_receipt");
      expect(keys).not.toContain("order.open_claim");
    }
  });

  it("only a customer-owned artwork step offers the upload", () => {
    for (const dto of dtos) {
      const upload = dto.nextActions.some((action) => action.key === "order.upload_artwork");
      if (dto.artworkOwner !== "customer") expect(upload).toBe(false);
      expect(visibleActions(dto, dto.nextActions)).toEqual(dto.nextActions);
    }
  });

  it("unpaid orders say their dates follow payment", () => {
    const unpaid = dtos.filter((dto) => dto.customerStatus === "awaiting_payment");
    expect(unpaid.length).toBeGreaterThan(0);
    expect(unpaid.every((dto) => dto.deliveryDateBasis === "after_payment")).toBe(true);
  });

  it("explains the split artwork states in words", () => {
    expect(artworkNoteOf({ artworkOwner: "team", artworkStatus: "awaiting_template" })).toBe("team_dieline");
    expect(artworkNoteOf({ artworkOwner: "customer", artworkStatus: "awaiting_upload" })).toBe("customer_upload");
  });
});
