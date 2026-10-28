import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackEditor } from "./editor";
import { trackEditor as fromBarrel } from "./index";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackEditor (editor redesign Phase 1 item 6)", () => {
  it("is the same function from the analytics barrel", () => {
    expect(fromBarrel).toBe(trackEditor);
  });

  it("pushes the typed events once analytics is accepted", () => {
    consent("a1m0");
    trackEditor("editor_open", { mode: "easy" });
    trackEditor("editor_mode_switch", { from: "easy", to: "pro" });
    trackEditor("editor_autofix", { rule: "safe_zone", count: 2 });
    trackEditor("editor_order_click", { errors: 0 });
    expect(layer()).toEqual([
      { event: "editor_open", mode: "easy" },
      { event: "editor_mode_switch", from: "easy", to: "pro" },
      { event: "editor_autofix", rule: "safe_zone", count: 2 },
      { event: "editor_order_click", errors: 0 },
    ]);
  });

  it("pushes nothing without consent", () => {
    trackEditor("editor_tool", { tool: "rect" });
    expect(layer()).toEqual([]);
  });
});
