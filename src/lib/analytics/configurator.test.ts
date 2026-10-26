import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackConfigurator } from "./configurator";
import { trackConfigurator as fromBarrel } from "./index";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackConfigurator", () => {
  it("is the same function from the analytics barrel", () => {
    expect(fromBarrel).toBe(trackConfigurator);
  });

  it("pushes each typed event to the dataLayer once analytics is accepted", () => {
    consent("a1m0");
    trackConfigurator("cfg_option_change", { step: "material", option: "material", value: "KA125", delta: "+0.86" });
    trackConfigurator("cfg_size_mode", { mode: "custom" });
    trackConfigurator("cfg_qty_custom", { quantity: 2345 });
    trackConfigurator("cfg_target_price_set", {});
    trackConfigurator("cfg_postcode_set", { zone: "Bangkok" });
    trackConfigurator("cfg_design_path", { path: "own_file" });
    trackConfigurator("cfg_sample_toggle", { on: true });
    trackConfigurator("cfg_cta", { cta: "cart" });
    trackConfigurator("cfg_quote_only_shown", { size: "M", qty: 100 });
    expect(layer()).toEqual([
      { event: "cfg_option_change", step: "material", option: "material", value: "KA125", delta: "+0.86" },
      { event: "cfg_size_mode", mode: "custom" },
      { event: "cfg_qty_custom", quantity: 2345 },
      { event: "cfg_target_price_set" },
      { event: "cfg_postcode_set", zone: "Bangkok" },
      { event: "cfg_design_path", path: "own_file" },
      { event: "cfg_sample_toggle", on: true },
      { event: "cfg_cta", cta: "cart" },
      { event: "cfg_quote_only_shown", size: "M", qty: 100 },
    ]);
  });

  it("sends nothing before the visitor has answered or after analytics was refused, and never throws", () => {
    trackConfigurator("cfg_cta", { cta: "cart" });
    consent("a0m1");
    trackConfigurator("cfg_cta", { cta: "cart" });
    expect(layer()).toEqual([]);
    consent("a1m1");
    delete (window as unknown as Window).dataLayer;
    expect(() => trackConfigurator("cfg_cta", { cta: "cart" })).not.toThrow();
  });
});
