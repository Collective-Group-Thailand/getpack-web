import { describe, expect, it } from "vitest";

import { AGENT_APP_COLOURS, manifestFor } from "./manifest";

describe("web-app manifest per zone (D-467)", () => {
  it("installs getpack Agent as its own standalone app on the agent host", () => {
    const manifest = manifestFor("agent");
    expect(manifest.name).toBe("getpack Agent");
    expect(manifest.short_name).toBe("getpack Agent");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("takes its colours from the light tokens, never a dark surface", () => {
    const manifest = manifestFor("agent");
    expect(manifest.background_color).toBe(AGENT_APP_COLOURS.background);
    expect(manifest.theme_color).toBe(AGENT_APP_COLOURS.theme);
    for (const hex of [manifest.background_color!, manifest.theme_color!]) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      // Light: every channel well above mid-grey.
      const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
      expect(Math.min(...channels)).toBeGreaterThan(200);
    }
  });

  it("names a 192 and a 512 icon and a maskable one, which installability needs", () => {
    const icons = manifestFor("agent").icons ?? [];
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    expect(icons.every((icon) => icon.src.startsWith("/agent-app/"))).toBe(true);
  });

  it("keeps the other zones as they were", () => {
    expect(manifestFor("partner").name).toBe("getpack Partner");
    expect(manifestFor("partner").display).toBe("standalone");
    expect(manifestFor("customer").display).toBe("browser");
    expect(manifestFor("admin").display).toBe("browser");
  });
});
