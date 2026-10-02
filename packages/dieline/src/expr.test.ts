import { describe, expect, it } from "vitest";

import { callsOf, compile, evaluate, evalNumber, ExprError, namesOf, type ExprValue, type Scope } from "./expr";

const scope = (vars: Record<string, ExprValue>): Scope => ({
  get: (n) => vars[n],
  fn: { min: (...xs) => Math.min(...(xs as number[])), double: (x) => (typeof x === "number" ? 2 * x : undefined) },
});
const run = (src: string, vars: Record<string, ExprValue> = {}) => evaluate(compile(src), scope(vars));

describe("the recipe expression language", () => {
  it("does arithmetic left to right with the usual precedence", () => {
    expect(run("1 + 2 * 3 - 4 / 2")).toBe(5);
    expect(run("(1 + 2) * 3")).toBe(9);
    expect(run("-x + 1", { x: 3 })).toBe(-2);
    expect(run("10 - 4 - 3")).toBe(3);
    expect(run("1.5e1 + .5")).toBe(15.5);
  });

  it("reads dotted names and calls only the functions it is given", () => {
    expect(run("a.panel + t", { "a.panel": 0.45, t: 0.45 })).toBeCloseTo(0.9, 12);
    expect(run("double(min(4, 3))")).toBe(6);
    expect(() => run("nope(1)")).toThrow(ExprError);
  });

  it("compares numbers and strings, and is unknown (null) when an operand is missing", () => {
    expect(run("x < 5", { x: 4 })).toBe(true);
    expect(run("kind == 'euro'", { kind: "euro" })).toBe(true);
    expect(run("x < 5")).toBeNull();
    expect(run("x == 'a'")).toBeNull();
  });

  it("follows Kleene logic, so a rule over an unset value never fires", () => {
    expect(run("not (x > 1 and y > 1)", { y: 0 })).toBe(true);
    expect(run("x > 1 and y > 1", { y: 2 })).toBeNull();
    expect(run("x > 1 or y > 1", { y: 2 })).toBe(true);
    expect(run("not x > 1")).toBeNull();
    expect(run("!(1 < 2) || 2 >= 2")).toBe(true);
  });

  it("defaults with ?? when the left side is missing or not a finite number", () => {
    expect(run("depth ?? 15")).toBe(15);
    expect(run("depth ?? 15", { depth: 20 })).toBe(20);
    expect(run("depth ?? 15", { depth: Number.NaN })).toBe(15);
    expect(run("(lid == 'full' ? h : d ?? 9)", { lid: "partial", h: 50 })).toBe(9);
  });

  it("rejects malformed sources with the source in the message", () => {
    for (const bad of ["1 +", "(1", "a b", "'open", "1 # 2", "f(1,"])
      expect(() => compile(bad), bad).toThrow(ExprError);
  });

  it("lists the names and calls it reads", () => {
    expect(namesOf("(tuckDepth ?? tuckDepthFor(length)) < depth - 5").sort()).toEqual(["depth", "length", "tuckDepth"]);
    expect(callsOf("min(a, max(b, 1)) > 1 and not (c > 1)").sort()).toEqual(["max", "min"]);
    expect(() => compile("1 + not (c > 1)")).toThrow(ExprError);
    expect(evalNumber("'x'", scope({}))).toBeNaN();
  });
});
