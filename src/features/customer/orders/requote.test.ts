// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import {
  confirmBodyOf,
  confirmRequote,
  differenceDirection,
  isRequoteRequired,
  previewRequote,
  requoteFailureOf,
} from "./requote";

const GROUP = "0192f3a0-7c1e-7d2a-9b1f-0000000d0001";
const KEY = "5fe1ecce-1234-4abc-8def-2fb5e788f013";

/** The contract's example preview (mock data, in this test only). */
const preview: Schemas["RequotePreviewDto"] = {
  groupId: GROUP,
  groupCode: "OG-2610-00016",
  previousGrossAmount: "9284.96",
  newGrossAmount: "9457.10",
  differenceAmount: "172.14",
  newCashAmount: "9457.10",
  priceValidUntil: "2026-11-09T10:00:00+07:00",
  paymentDueAt: "2026-11-01T10:00:00+07:00",
  orders: [
    {
      orderId: "o1",
      orderCode: "OR-2610-00016",
      quoteId: "q1",
      quoteOptionId: "qo1",
      quantity: 300,
      previousGrossAmount: "4302.86",
      newGrossAmount: "4388.92",
      differenceAmount: "86.06",
      newUnitPrice: "14.629733",
      leadTimeDays: 5,
      promisedShipDate: "2026-11-03",
      estimatedDeliveryDate: "2026-11-05",
    },
    {
      orderId: "o2",
      orderCode: "OR-2610-00017",
      quoteId: "q2",
      quoteOptionId: "qo2",
      quantity: 300,
      previousGrossAmount: "4982.10",
      newGrossAmount: "5068.18",
      differenceAmount: "86.08",
      newUnitPrice: "15.784361",
      leadTimeDays: 5,
      promisedShipDate: "2026-11-03",
      estimatedDeliveryDate: "2026-11-05",
    },
  ],
};

const problem = (status: number, code: string) =>
  HttpResponse.json(
    { type: `https://errors.getpack/${code}`, title: code, status, code, detail: code, requestId: "req-1" },
    { status, headers: { "content-type": "application/problem+json" } },
  );

let seen: { url: string; key: string | null; body: unknown }[] = [];
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  seen = [];
});
afterAll(() => server.close());

const api = () => createApiClient({ baseUrl: "http://api.test" });

describe("the re-quote of an overdue group (D-436)", () => {
  it("previews first and writes nothing: only the requote endpoint is called", async () => {
    server.use(
      http.post("http://api.test/v1/store/order-groups/:groupId/actions/requote", ({ request }) => {
        seen.push({ url: new URL(request.url).pathname, key: request.headers.get("idempotency-key"), body: null });
        return HttpResponse.json(preview);
      }),
    );
    const result = await previewRequote(api(), GROUP);
    expect(result.differenceAmount).toBe("172.14");
    expect(seen.map((call) => call.url)).toEqual([`/v1/store/order-groups/${GROUP}/actions/requote`]);
  });

  it("confirms with the preview's quotations and total, and an Idempotency-Key", async () => {
    server.use(
      http.post("http://api.test/v1/store/order-groups/:groupId/actions/confirm-requote", async ({ request }) => {
        seen.push({
          url: new URL(request.url).pathname,
          key: request.headers.get("idempotency-key"),
          body: await request.json(),
        });
        return HttpResponse.json({ id: GROUP, paymentOverdue: false });
      }),
    );
    await confirmRequote(api(), GROUP, preview, KEY);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.key).toBe(KEY);
    expect(seen[0]!.body).toEqual({
      expectedGrossAmount: "9457.10",
      orders: [
        { orderId: "o1", quoteId: "q1", quoteOptionId: "qo1" },
        { orderId: "o2", quoteId: "q2", quoteOptionId: "qo2" },
      ],
    });
    expect(confirmBodyOf(preview).expectedGrossAmount).toBe(preview.newGrossAmount);
  });

  it.each([
    ["order.requote_unavailable", "unavailable"],
    ["order.requote_changed", "changed"],
    ["order.requote_not_due", "not_due"],
    ["concurrency.stale", "other"],
  ] as const)("reads %s as %s", async (code, expected) => {
    server.use(http.post("http://api.test/v1/store/order-groups/:groupId/actions/requote", () => problem(409, code)));
    const error = await previewRequote(api(), GROUP).catch((caught: unknown) => caught);
    expect(requoteFailureOf(error)).toBe(expected);
  });

  it("recognises a payment refused because the group must be re-quoted first", async () => {
    server.use(
      http.post("http://api.test/v1/store/order-groups/:groupId/actions/requote", () =>
        problem(409, "order.requote_required"),
      ),
    );
    const error = await previewRequote(api(), GROUP).catch((caught: unknown) => caught);
    expect(isRequoteRequired(error)).toBe(true);
    expect(isRequoteRequired(new Error("x"))).toBe(false);
  });

  it("reads the sign of a difference without doing arithmetic on money", () => {
    expect(differenceDirection("172.14")).toBe("up");
    expect(differenceDirection("-12.00")).toBe("down");
    expect(differenceDirection("0.00")).toBe("same");
  });
});
