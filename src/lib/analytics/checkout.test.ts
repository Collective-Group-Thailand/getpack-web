import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackCheckout } from "./checkout";
import { trackCheckout as fromBarrel } from "./index";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackCheckout (checkout redesign item 7)", () => {
  it("is the same function from the analytics barrel", () => {
    expect(fromBarrel).toBe(trackCheckout);
  });

  it("pushes the named events once analytics is accepted", () => {
    consent("a1m0");
    trackCheckout("checkout_step_view", { step: "address" });
    trackCheckout("checkout_payment_select", { method: "scb_qr", plan: "full_upfront" });
    trackCheckout("checkout_blocked", { step: "review", reason: "terms" });
    expect(layer()).toEqual([
      { event: "checkout_step_view", step: "address" },
      { event: "checkout_payment_select", method: "scb_qr", plan: "full_upfront" },
      { event: "checkout_blocked", step: "review", reason: "terms" },
    ]);
  });

  it("sends nothing without consent", () => {
    consent("a0m0");
    trackCheckout("checkout_confirm", { method: "scb_qr", plan: "full_upfront" });
    expect(layer()).toEqual([]);
  });
});
