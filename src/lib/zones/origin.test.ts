import { describe, expect, it } from "vitest";

import { zoneOriginFor } from "./origin";

describe("zoneOriginFor (D-467)", () => {
  it("is https for a real host, whatever the request said", () => {
    expect(zoneOriginFor("agent.getpack.co", "https")).toBe("https://agent.getpack.co");
    expect(zoneOriginFor("agent.getpack.co", null)).toBe("https://agent.getpack.co");
    expect(zoneOriginFor("agent.getpack.co", "http")).toBe("https://agent.getpack.co");
  });

  it("follows the request on localhost names, http by default", () => {
    expect(zoneOriginFor("agent.localhost:3100", null)).toBe("http://agent.localhost:3100");
    expect(zoneOriginFor("localhost:3000", "https")).toBe("https://localhost:3000");
    expect(zoneOriginFor("127.0.0.1:3100", undefined)).toBe("http://127.0.0.1:3100");
  });
});
