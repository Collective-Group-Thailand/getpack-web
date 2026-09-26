import { afterEach, describe, expect, it, vi } from "vitest";

import { clientEnvSchema, parseEnv } from "./schema";

/**
 * The browser reads the public values without zod (so zod stays out of every page); the server
 * checks them with the schema at boot. The two must agree on what a value becomes.
 */
describe("clientEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("normalises the inlined values the way the schema does", async () => {
    vi.stubEnv("NEXT_PUBLIC_ASSET_BASE_URL", " https://cdn.example.com/ ");
    vi.stubEnv("NEXT_PUBLIC_REALTIME_HOST", "RT.Example.com");
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
    vi.stubEnv("NEXT_PUBLIC_ENV_BADGE", "uat");
    const { clientEnv } = await import("./client");
    const { publicEnvSource } = await import("./public");
    const checked = parseEnv(clientEnvSchema(), publicEnvSource(), "client");

    expect(clientEnv.NEXT_PUBLIC_ASSET_BASE_URL).toBe("https://cdn.example.com");
    expect(clientEnv.NEXT_PUBLIC_REALTIME_HOST).toBe("rt.example.com");
    expect(clientEnv.NEXT_PUBLIC_GTM_ID).toBeUndefined();
    expect(clientEnv).toEqual(checked);
  });
});
