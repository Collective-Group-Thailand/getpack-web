import { afterEach, describe, expect, it } from "vitest";

import { giveHandoff, takeHandoff } from "./handoff";

afterEach(() => window.sessionStorage.clear());

describe("studio hand-off (C7)", () => {
  it("is taken once", () => {
    giveHandoff({ brand: "Somchai Coffee", logo: null, print: "one" });
    expect(takeHandoff()).toEqual({ brand: "Somchai Coffee", logo: null, print: "one" });
    expect(takeHandoff()).toBeNull();
  });

  it("survives a reload through the tab's storage", () => {
    window.sessionStorage.setItem(
      "getpack.studio.handoff",
      JSON.stringify({ brand: null, logo: { src: "data:image/png;base64,AA==", name: "logo.png" }, print: "full" }),
    );
    expect(takeHandoff()?.logo?.name).toBe("logo.png");
  });

  it("carries nothing when there is no brand and no logo", () => {
    giveHandoff({ brand: "  ", logo: null, print: "one" });
    expect(takeHandoff()).toBeNull();
  });
});
