import { afterEach, describe, expect, it } from "vitest";
import { uiFontFamily } from "./ui-font";

describe("uiFontFamily", () => {
  afterEach(() => document.documentElement.style.removeProperty("--font-sans"));

  it("reads the resolved --font-sans stack for canvas text", () => {
    document.documentElement.style.setProperty("--font-sans", '"Anuphan Latin", sans-serif');
    expect(uiFontFamily()).toBe('"Anuphan Latin", sans-serif');
  });

  it("falls back to the generic family when the stack is not set", () => {
    expect(uiFontFamily()).toBe("sans-serif");
  });
});
