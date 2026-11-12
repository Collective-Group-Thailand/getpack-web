import { describe, expect, it } from "vitest";

import { countVisit, shouldOffer, type KeyValue } from "./install-visits";

function store(): KeyValue {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

describe("install prompt timing (D-467)", () => {
  it("counts a visit once per session", () => {
    const local = store();
    const first = store();
    expect(countVisit(local, first)).toBe(1);
    expect(countVisit(local, first)).toBe(1);
    expect(countVisit(local, store())).toBe(2);
  });

  it("offers from the second visit, never once dismissed or installed", () => {
    expect(shouldOffer({ visits: 1, dismissed: false, installed: false })).toBe(false);
    expect(shouldOffer({ visits: 2, dismissed: false, installed: false })).toBe(true);
    expect(shouldOffer({ visits: 5, dismissed: true, installed: false })).toBe(false);
    expect(shouldOffer({ visits: 5, dismissed: false, installed: true })).toBe(false);
  });
});
