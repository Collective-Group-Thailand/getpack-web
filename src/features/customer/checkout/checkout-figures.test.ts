import { describe, expect, it } from "vitest";

import { placeBody, previewFigures } from "./CheckoutView";

/** The figures as the API's preview gives them (mock-shaped: goods − discount + shipping = total). */
const preview = {
  display: {
    goodsGrossAmount: "5178.00",
    discountGrossAmount: "258.90",
    shippingGrossAmount: "235.40",
    vatAmount: "337.21",
    grossAmount: "5154.50",
  },
  totals: {
    netAmount: "4817.29",
    discountAmount: "241.96",
    shippingNetAmount: "220.00",
    vatAmount: "337.21",
    grossAmount: "5154.50",
    whtAmount: "0.00",
    cashAmount: "5154.50",
    currency: "THB",
  },
};

describe("checkout totals (checkout redesign acceptance)", () => {
  it("the total every step shows is the total the order is placed with", () => {
    const figures = previewFigures(preview);
    const body = placeBody({ taxProfileId: null }, preview);
    expect(figures.total).toBe(preview.totals.grossAmount);
    expect(figures.total).toBe(preview.display.grossAmount);
    expect(body.expectedGrossAmount).toBe(figures.total);
  });

  it("shows the API's rows as they are, a zero discount left out", () => {
    expect(previewFigures(preview)).toMatchObject({ goods: "5178.00", discount: "258.90", shipping: "235.40" });
    expect(
      previewFigures({ ...preview, display: { ...preview.display, discountGrossAmount: "0.00" } }).discount,
    ).toBeNull();
  });
});
