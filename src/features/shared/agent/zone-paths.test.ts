import { describe, expect, it } from "vitest";

import { agentZonePathFor, searchOf } from "./zone-paths";

describe("the /account/agent → getpack Agent redirect map (D-467)", () => {
  it.each([
    [[], "/"],
    [["customers"], "/customers"],
    [["leads"], "/leads"],
    [["commissions"], "/commissions"],
    [["statements"], "/statements"],
    [["statements", "0192f3a0-7c1e-7d2a-9b1f-0000000a6009"], "/statements/0192f3a0-7c1e-7d2a-9b1f-0000000a6009"],
    [["tax"], "/tax"],
    [["payout"], "/payout"],
  ] as const)("maps /account/agent/%s to %s", (segments, target) => {
    expect(agentZonePathFor(segments)).toBe(target);
  });

  it("keeps the query string", () => {
    expect(agentZonePathFor(["leads"], "?page=2")).toBe("/leads?page=2");
    expect(agentZonePathFor([], "page=3&x=1")).toBe("/?page=3&x=1");
    expect(agentZonePathFor(["tax"], "?")).toBe("/tax");
  });

  it("maps nothing it does not know, so an unknown path still 404s", () => {
    expect(agentZonePathFor(["apply"])).toBeNull();
    expect(agentZonePathFor(["leads", "x"])).toBeNull();
    expect(agentZonePathFor(["statements", "a", "b"])).toBeNull();
    expect(agentZonePathFor(["statements", "../../admin"])).toBeNull();
  });

  it("rebuilds a query string from page params", () => {
    expect(searchOf({ page: "2", tag: ["a", "b"], none: undefined })).toBe("?page=2&tag=a&tag=b");
    expect(searchOf({})).toBe("");
  });
});
