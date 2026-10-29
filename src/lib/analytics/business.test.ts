import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackBusiness } from "./business";
import { trackBusiness as fromBarrel } from "./index";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackBusiness (business / contact / getpack Factory, C10)", () => {
  it("is the same function from the analytics barrel", () => {
    expect(fromBarrel).toBe(trackBusiness);
  });

  it("pushes the pack's event names with their properties once analytics is accepted", () => {
    consent("a1m0");
    trackBusiness("biz_cta", { target: "apply" });
    trackBusiness("biz_sim_change", { threshold: 20000 });
    trackBusiness("contact_submit", { intent: "order", channel: "line" });
    trackBusiness("fx_apply_submit", { capabilities: 2 });
    expect(layer()).toEqual([
      { event: "biz_cta", target: "apply" },
      { event: "biz_sim_change", threshold: 20000 },
      { event: "contact_submit", intent: "order", channel: "line" },
      { event: "fx_apply_submit", capabilities: 2 },
    ]);
  });

  it("sends nothing without consent", () => {
    trackBusiness("contact_track", { type: "ticket" });
    expect(layer()).toEqual([]);
  });
});
