import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readTray, TRAY_MAX, TRAY_STORAGE_KEY, trayStore, type TrayItem } from "./rfq-store";

const item = (key: string, kind: TrayItem["kind"] = "catalog"): TrayItem => ({
  kind,
  key,
  productTypeCode: "folding_carton",
  categoryCode: "folding_carton",
  nameTh: `สินค้า ${key}`,
  nameEn: `Product ${key}`,
});

beforeEach(() => {
  window.localStorage.clear();
  trayStore.reset();
});
afterEach(() => vi.restoreAllMocks());

describe("the RFQ tray (products redesign item 8)", () => {
  it("persists added items in this browser and reads them back", () => {
    trayStore.add(item("a"));
    trayStore.add(item("PKO-1", "stock"));
    trayStore.reset();
    expect(trayStore.items().map((i) => `${i.kind}:${i.key}`)).toEqual(["catalog:a", "stock:PKO-1"]);
    expect(JSON.parse(window.localStorage.getItem(TRAY_STORAGE_KEY)!)).toHaveLength(2);
  });

  it("adds an item once, removes and clears", () => {
    trayStore.add(item("a"));
    trayStore.add(item("a"));
    expect(trayStore.items()).toHaveLength(1);
    expect(trayStore.has({ kind: "catalog", key: "a" })).toBe(true);
    expect(trayStore.has({ kind: "stock", key: "a" })).toBe(false);
    trayStore.remove({ kind: "catalog", key: "a" });
    expect(trayStore.items()).toEqual([]);
    trayStore.add(item("b"));
    trayStore.clear();
    expect(trayStore.items()).toEqual([]);
  });

  it("refuses a 21st item (a draft basket holds 20)", () => {
    for (let i = 0; i < TRAY_MAX; i++) expect(trayStore.add(item(`p${i}`))).toBe(true);
    expect(trayStore.add(item("one-more"))).toBe(false);
    expect(trayStore.items()).toHaveLength(TRAY_MAX);
  });

  it("keeps working when storage throws (private window)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readTray()).toEqual([]);
    expect(trayStore.add(item("a"))).toBe(true);
    expect(trayStore.items()).toHaveLength(1);
  });

  it("ignores unreadable or foreign entries in storage", () => {
    window.localStorage.setItem(
      TRAY_STORAGE_KEY,
      JSON.stringify([item("ok"), { kind: "x", key: "bad" }, "nope", item("ok"), { ...item("y"), key: "" }]),
    );
    expect(readTray().map((i) => i.key)).toEqual(["ok"]);
    window.localStorage.setItem(TRAY_STORAGE_KEY, "{not json");
    expect(readTray()).toEqual([]);
  });
});
