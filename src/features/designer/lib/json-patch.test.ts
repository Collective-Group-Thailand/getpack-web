import { describe, expect, it } from "vitest";

import { apply, canonicalJson, diff, MAX_PATCH_BYTES, patchBytes, sameJson, type JsonValue } from "./json-patch";

const doc = (elements: JsonValue[], extra: Record<string, JsonValue> = {}): JsonValue => ({
  spec: { styleId: "tuck-end", values: { length: 70, width: 40, height: 150 } },
  content: { elements, pattern: { kind: "none" }, ...extra },
});

describe("JSON Patch autosave (D-276)", () => {
  it("sends only what changed and round-trips", () => {
    const before = doc([{ id: "a", x: 10, text: "getpack" }]);
    const after = doc([{ id: "a", x: 12, text: "getpack" }]);
    const ops = diff(before, after);
    expect(ops).toEqual([{ op: "replace", path: "/content/elements/0/x", value: 12 }]);
    expect(apply(before, ops)).toEqual(after);
  });

  it("replaces an array whose length changed, adds and removes keys", () => {
    const before = doc([{ id: "a" }], { old: true });
    const after = doc([{ id: "a" }, { id: "b" }], { fresh: "yes" });
    const ops = diff(before, after);
    expect(ops).toContainEqual({ op: "replace", path: "/content/elements", value: [{ id: "a" }, { id: "b" }] });
    expect(ops).toContainEqual({ op: "remove", path: "/content/old" });
    expect(ops).toContainEqual({ op: "add", path: "/content/fresh", value: "yes" });
    expect(apply(before, ops)).toEqual(after);
  });

  it("escapes keys as JSON Pointer segments", () => {
    const ops = diff({ "a/b": 1, "c~d": 1 }, { "a/b": 2, "c~d": 2 });
    expect(ops.map((op) => op.path)).toEqual(["/a~1b", "/c~0d"]);
    expect(apply({ "a/b": 1, "c~d": 1 }, ops)).toEqual({ "a/b": 2, "c~d": 2 });
  });

  it("is empty for an equal document and measures its size as the API does", () => {
    expect(diff(doc([{ id: "a" }]), doc([{ id: "a" }]))).toEqual([]);
    const ops = diff(doc([]), doc([{ id: "x", text: "ก".repeat(10) }]));
    expect(patchBytes(ops)).toBe(new TextEncoder().encode(JSON.stringify(ops)).length);
    expect(MAX_PATCH_BYTES).toBe(262_144);
  });

  it("compares field sets whatever their key order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: undefined } })).toBe('{"a":{"d":2},"b":1}');
    expect(sameJson({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(sameJson({ a: 1 }, null)).toBe(false);
  });
});
