import { describe, expect, it } from "vitest";

import { filterByUseCase, caseChipsOf, caseIdsOf } from "./useCases";

const cases = [
  { id: "ship", keys: ["a", "b"] },
  { id: "move", keys: ["c"] },
  { id: "ghost", keys: ["zz"] },
];

describe("use-case chips", () => {
  it("counts live and never draws a value with zero results", () => {
    expect(caseChipsOf(cases, ["a", "b", "c"])).toEqual([
      { id: "ship", count: 2 },
      { id: "move", count: 1 },
    ]);
  });

  it("hides the group when no value narrows the list", () => {
    expect(caseChipsOf([{ id: "all", keys: ["a", "b"] }], ["a", "b"])).toEqual([]);
    expect(caseChipsOf([], ["a"])).toEqual([]);
  });

  it("filters by the chosen use case; unknown keeps all", () => {
    const items = [{ key: "a" }, { key: "b" }, { key: "c" }];
    expect(filterByUseCase(items, cases, "move")).toEqual([{ key: "c" }]);
    expect(filterByUseCase(items, cases, "nope")).toHaveLength(3);
    expect(filterByUseCase(items, cases, null)).toHaveLength(3);
    expect(caseIdsOf(cases, "a")).toEqual(["ship"]);
  });
});
