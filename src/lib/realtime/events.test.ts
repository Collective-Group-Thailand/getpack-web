import { describe, expect, it } from "vitest";

import { invalidationKeys, parseEvent } from "./events";

describe("parseEvent", () => {
  it("accepts the shape the contract describes", () => {
    expect(parseEvent({ type: "order.paid", id: "abc" })).toEqual({
      type: "order.paid",
      id: "abc",
      parentId: undefined,
    });
  });

  it("refuses anything else, rather than trusting the wire", () => {
    for (const raw of [null, undefined, 42, "order.paid", {}, { type: "" }, { type: 7 }, { id: "abc" }]) {
      expect(parseEvent(raw), JSON.stringify(raw)).toBeNull();
    }
  });

  it("drops fields that are not strings instead of passing them through", () => {
    // A payload carrying business data is a contract violation (api-conventions §6); dropping
    // the extras means a backend mistake cannot quietly become something a screen renders.
    const event = parseEvent({ type: "order.paid", id: 12, parentId: null, total: "1234.50" });
    expect(event).toEqual({ type: "order.paid", id: undefined, parentId: undefined });
    expect(event && "total" in event).toBe(false);
  });
});

describe("invalidationKeys", () => {
  it("invalidates the record and every list of its resource", () => {
    const keys = invalidationKeys("admin", { type: "order.paid", id: "o1" });

    expect(keys).toContainEqual(["admin", "order", "detail", "o1"]);
    expect(keys).toContainEqual(["admin", "order"]);
  });

  it("keeps the zone in every key, so one zone cannot clear another's cache", () => {
    for (const key of invalidationKeys("partner", { type: "job.accepted", id: "j1" })) {
      expect(key[0]).toBe("partner");
    }
  });

  it("handles an event about a resource the UI has never met", () => {
    // Harmless if nothing is cached under those keys, and correct if something is — better
    // than a lookup table that has to be updated every time the backend adds an event.
    expect(invalidationKeys("admin", { type: "widget.frobnicated" })).toContainEqual(["admin", "widget"]);
  });

  it("refreshes the notification count, which almost everything changes", () => {
    expect(invalidationKeys("admin", { type: "order.paid" })).toContainEqual(["admin", "notifications", "list", null]);
  });

  it("returns nothing for a type with no resource", () => {
    expect(invalidationKeys("admin", { type: "." })).toEqual([]);
  });
});
