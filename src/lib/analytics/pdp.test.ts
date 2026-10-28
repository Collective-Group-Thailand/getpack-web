import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackPdp as fromBarrel } from "./index";
import { trackPdp } from "./pdp";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackPdp (pdp redesign item 11)", () => {
  it("is the same function from the analytics barrel", () => {
    expect(fromBarrel).toBe(trackPdp);
  });

  it("pushes the typed events once analytics is accepted", () => {
    consent("a1m0");
    trackPdp("pdp_option_change", { product: "mailer-box", option: "size", value: "B" });
    trackPdp("pdp_cta", { product: "mailer-box", cta: "configure" });
    trackPdp("pdp_design_path", { product: "mailer-box", path: "studio" });
    expect(layer()).toEqual([
      { event: "pdp_option_change", product: "mailer-box", option: "size", value: "B" },
      { event: "pdp_cta", product: "mailer-box", cta: "configure" },
      { event: "pdp_design_path", product: "mailer-box", path: "studio" },
    ]);
  });

  it("sends nothing without consent", () => {
    consent("a0m0");
    trackPdp("pdp_size_table_pick", { product: "mailer-box", size: "A" });
    expect(layer()).toEqual([]);
  });
});
