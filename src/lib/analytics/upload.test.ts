import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackUpload as fromBarrel } from "./index";
import { trackUpload } from "./upload";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackUpload (upload redesign)", () => {
  it("is the same function from the analytics barrel", () => {
    expect(fromBarrel).toBe(trackUpload);
  });

  it("pushes typed events once analytics is accepted", () => {
    consent("a1m0");
    trackUpload("upload_start", { source: "drop", files: 2 });
    trackUpload("preflight_done", { errors: 1, warnings: 1, auto: 0 });
    trackUpload("add_to_cart_with_file", { versions: 1 });
    expect(layer()).toEqual([
      { event: "upload_start", source: "drop", files: 2 },
      { event: "preflight_done", errors: 1, warnings: 1, auto: 0 },
      { event: "add_to_cart_with_file", versions: 1 },
    ]);
  });

  it("sends nothing without consent", () => {
    trackUpload("upload_done", { size_mb: 4 });
    expect(layer()).toEqual([]);
  });
});
