import { describe, expect, it } from "vitest";

import {
  addressBlockers,
  blockersUpTo,
  cartBlockers,
  furthestStep,
  isSplit,
  nextStep,
  parseStep,
  paymentBlockers,
  reviewBlockers,
  sharedAddressId,
  stepHref,
} from "./steps";

const destination = (addressId: string | null, quantity: number) => ({
  id: `d-${addressId}-${quantity}`,
  addressId,
  quantity,
  address: {} as never,
});
const line = (over: Partial<Parameters<typeof cartBlockers>[0]["items"][number]> = {}) => ({
  id: "i1",
  quantity: 300,
  priceLocked: true,
  pendingReprice: null,
  destinations: [destination("a1", 300)],
  destinationsComplete: true,
  ...over,
});

describe("checkout steps (checkout redesign item 1)", () => {
  it("maps the four steps to /cart and /checkout?step=", () => {
    expect(stepHref("cart")).toBe("/cart");
    expect(stepHref("payment")).toBe("/checkout?step=payment");
    expect(parseStep("review")).toBe("review");
    expect(parseStep("anything")).toBe("address");
    expect(parseStep(null)).toBe("address");
    expect(nextStep("address")).toBe("payment");
    expect(nextStep("review")).toBeNull();
  });

  it("the cart needs confirmed prices only — no address (step 2's)", () => {
    expect(cartBlockers({ items: [line({ destinations: [], destinationsComplete: false })] })).toEqual([]);
    expect(cartBlockers({ items: [line({ priceLocked: false })] })).toEqual([
      { step: "cart", reason: "reprice", itemId: "i1" },
    ]);
    expect(cartBlockers({ items: [] })).toEqual([{ step: "cart", reason: "empty" }]);
  });

  it("a single-address order is complete without the allocation table", () => {
    const cart = { items: [line(), line({ id: "i2", quantity: 500, destinations: [destination("a1", 500)] })] };
    expect(isSplit(cart)).toBe(false);
    expect(sharedAddressId(cart)).toBe("a1");
    expect(addressBlockers(cart, false, null)).toEqual([]);
  });

  it("a split names the line whose rows do not add up; a missing address is asked for", () => {
    const short = line({ destinations: [destination("a1", 100), destination("a2", 150)], destinationsComplete: false });
    expect(isSplit({ items: [short] })).toBe(true);
    expect(addressBlockers({ items: [short] }, true, null)).toEqual([
      { step: "address", reason: "split_total", itemId: "i1" },
    ]);
    const none = line({ destinations: [], destinationsComplete: false });
    expect(addressBlockers({ items: [none] }, false, null)).toEqual([
      { step: "address", reason: "address", itemId: "i1" },
    ]);
    expect(addressBlockers({ items: [line()] }, false, "checkout.shipping_unavailable")).toEqual([
      { step: "address", reason: "shipping_unavailable" },
    ]);
  });

  it("payment needs a tax profile when one is asked for and the PO the company requires", () => {
    expect(
      paymentBlockers({ poRequired: true, poNumber: " ", taxInvoice: true, taxProfileId: null, previewReady: true }),
    ).toEqual([
      { step: "payment", reason: "tax_profile" },
      { step: "payment", reason: "po_required" },
    ]);
    expect(
      paymentBlockers({ poRequired: false, poNumber: "", taxInvoice: false, taxProfileId: null, previewReady: true }),
    ).toEqual([]);
  });

  it("forward only when every step before is valid; back always", () => {
    const all = [
      ...cartBlockers({ items: [line()] }),
      ...addressBlockers({ items: [line()] }, false, null),
      ...reviewBlockers(false),
    ];
    expect(furthestStep(all)).toBe("review");
    expect(blockersUpTo("payment", all)).toEqual([]);
    expect(blockersUpTo("review", all)).toEqual([{ step: "review", reason: "terms" }]);
    const noAddress = addressBlockers(
      { items: [line({ destinations: [], destinationsComplete: false })] },
      false,
      null,
    );
    expect(furthestStep(noAddress)).toBe("address");
  });
});
