import { describe, expect, it } from "vitest";

import { FUNNEL_EVENTS } from "./events";
import { pageTypeOf, toIngestEvent } from "./ingest";

const visitor = { anonymousId: "visitor0001", sessionId: "session0001" };
const now = new Date("2026-10-01T10:15:00+07:00");
const id = "0192f3a0-7c1e-7d2a-9b1f-000000610001";

describe("the analytics ingest mapping (store.analytics.ingest)", () => {
  it("sends only packio-api's five names, with the ids every event needs", () => {
    const names = new Set(
      FUNNEL_EVENTS.map((name) => toIngestEvent(name, { quantity: 500, orderGroupId: id }, visitor, now, id)).flatMap(
        (event) => (event ? [event.name] : []),
      ),
    );
    expect([...names].sort()).toEqual([
      "add_to_cart",
      "checkout_step",
      "configurator_step",
      "page_view",
      "quote_shown",
    ]);
    const event = toIngestEvent("checkout_started", {}, visitor, now, id)!;
    expect(event).toMatchObject({ eventId: id, anonymousId: "visitor0001", sessionId: "session0001" });
    expect(event.occurredAt).toBe("2026-10-01T03:15:00.000Z");
  });

  it("gives each event its closed properties", () => {
    expect(toIngestEvent("page_view", { route: "/products/[key]" }, visitor, now, id)).toMatchObject({
      name: "page_view",
      properties: { pageType: "product" },
      pagePath: "/products/[key]",
    });
    expect(
      toIngestEvent("quote_shown", { quantity: 1000, quoteMode: "instant", unitPrice: "4.25" }, visitor, now, id)
        ?.properties,
    ).toEqual({ quantity: 1000, instant: true, unitPrice: "4.25" });
    expect(toIngestEvent("order_placed", { orderGroupId: id }, visitor, now, id)?.properties).toEqual({
      step: "placed",
      orderGroupId: id,
    });
  });

  it("drops an event that lacks what packio-api requires, rather than send it wrong", () => {
    expect(toIngestEvent("quote_shown", { quoteMode: "instant" }, visitor, now, id)).toBeNull();
    expect(toIngestEvent("cart_item_added", {}, visitor, now, id)).toBeNull();
    expect(toIngestEvent("order_placed", {}, visitor, now, id)).toBeNull();
    expect(toIngestEvent("rfq_submitted", { quantity: 5 }, visitor, now, id)).toBeNull();
  });

  it("reads the page type off the route pattern, in both locales", () => {
    expect(pageTypeOf("/")).toBe("home");
    expect(pageTypeOf("/en")).toBe("home");
    expect(pageTypeOf("/en/configure/[slug]")).toBe("configurator");
    expect(pageTypeOf("/products")).toBe("category");
    expect(pageTypeOf("/account/orders/[orderId]")).toBe("account");
    expect(pageTypeOf(undefined)).toBe("other");
  });
});
