import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackStudioHub as fromBarrel } from "./index";
import { trackStudioHub } from "./studio-hub";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackStudioHub (studio redesign item 9)", () => {
  it("is the same function from the analytics barrel", () => {
    expect(fromBarrel).toBe(trackStudioHub);
  });

  it("pushes the typed events once analytics is accepted", () => {
    consent("a1m0");
    trackStudioHub("studio_hero_interact", { field: "size" });
    trackStudioHub("studio_finder_submit", { unit: "cm", use: "parcel" });
    trackStudioHub("studio_finder_pick", { style: "rsc", rank: 1 });
    expect(layer()).toEqual([
      { event: "studio_hero_interact", field: "size" },
      { event: "studio_finder_submit", unit: "cm", use: "parcel" },
      { event: "studio_finder_pick", style: "rsc", rank: 1 },
    ]);
  });

  it("pushes nothing without consent", () => {
    trackStudioHub("studio_try_sample", {});
    expect(layer()).toEqual([]);
  });
});
