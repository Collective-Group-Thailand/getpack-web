// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken, mockId } from "../../../../mocks/support";
import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { createRequestClient } from "@/lib/api/requests/client";
import { REQUESTS } from "@/lib/api/requests/registry";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// Built per call: a client made before `server.listen()` would hold the unpatched `fetch`.
const as = (persona?: string) => ({
  call: ((...args: unknown[]) =>
    (
      createRequestClient(
        REQUESTS,
        createApiClient({
          baseUrl: "http://api.mock",
          accessToken: persona === "guest" ? undefined : accessToken("customer", persona),
        }) as unknown as Client<never>,
      ).call as (...a: unknown[]) => unknown
    )(...args)) as ReturnType<typeof createRequestClient<typeof REQUESTS>>["call"],
});
const receiver = as("receiver");
const returning = as();
const guest = as("guest");
const uuid = () => crypto.randomUUID();
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (isApiError(error) ? error : Promise.reject(error)),
  );

/** `mocks/admin/commerce.ts`: delivered yesterday, 3 % short (the receiver's); completed (the returning customer's). */
const DELIVERED = mockId("ord", 32);
const COMPLETED = mockId("ord", 37);

describe("after production, against the mock", () => {
  it("tracks publicly by token without anything personal", async () => {
    const order = await receiver.call("GET /v1/store/orders/{orderId}", { path: { orderId: DELIVERED } });
    expect(order.stages.map((stage) => stage.key)).toEqual([
      "ordered",
      "paid",
      "artwork",
      "production",
      "shipping",
      "completed",
    ]);
    expect(order.stages.find((stage) => stage.state === "current")?.key).toBe("completed");

    const tracking = await guest.call("GET /v1/store/tracking/{token}", { path: { token: order.trackingToken! } });
    expect(tracking.orderCode).toBe(order.orderCode);
    const text = JSON.stringify(tracking);
    for (const destination of order.destinations) {
      expect(text).not.toContain(destination.recipientName);
      expect(text).not.toContain(destination.phone);
      expect(text).not.toContain(destination.line1);
    }
    expect(text).not.toContain(order.grossAmount);
    expect((await failure(guest.call("GET /v1/store/tracking/{token}", { path: { token: "trk0000" } })))?.status).toBe(
      404,
    );
  });

  it("credits a shortage within tolerance and completes on confirmed receipt (D-080, D-081)", async () => {
    const before = await receiver.call("GET /v1/store/orders/{orderId}", { path: { orderId: DELIVERED } });
    expect(before.toleranceOutcome?.outcome).toBe("shortage_within");
    expect(Number(before.toleranceOutcome?.creditAmount)).toBeGreaterThan(0);
    expect(before.nextActions.map((action) => action.key)).toContain("order.confirm_receipt");

    const after = await receiver.call("POST /v1/store/orders/{orderId}/actions/confirm-receipt", {
      path: { orderId: DELIVERED },
      body: {},
      idempotencyKey: uuid(),
    });
    expect(after.status).toBe("completed");
    expect(after.receipt?.confirmedAt).toBeTruthy();
    expect(after.nextActions.map((action) => action.key)).not.toContain("order.confirm_receipt");
    expect(after.nextActions.map((action) => action.key)).toContain("order.open_claim");
  });

  it("files a claim with both kinds of photo, and the thread reaches the desk (D-082)", async () => {
    const form = await receiver.call("GET /v1/store/orders/{orderId}/claim-form", { path: { orderId: DELIVERED } });
    expect(form.open).toBe(true);
    expect(form.evidence.minCartonPhotos).toBeGreaterThan(0);

    const missing = await failure(
      receiver.call("POST /v1/store/orders/{orderId}/claims", {
        path: { orderId: DELIVERED },
        body: {
          type: "damaged",
          description: "กล่องบุบ 20 ใบ ฝาฉีก",
          requestedResolution: "reprint",
          productPhotoFileIds: [uuid()],
          cartonPhotoFileIds: [],
        },
        idempotencyKey: uuid(),
      }),
    );
    expect(missing?.status).toBe(422);

    const claim = await receiver.call("POST /v1/store/orders/{orderId}/claims", {
      path: { orderId: DELIVERED },
      body: {
        type: "damaged",
        shipmentId: form.shipments[0]!.id,
        affectedQuantity: 20,
        description: "กล่องบุบ 20 ใบ ฝาฉีก",
        requestedResolution: "reprint",
        productPhotoFileIds: [uuid()],
        cartonPhotoFileIds: [uuid()],
      },
      idempotencyKey: uuid(),
    });
    expect(claim.status).toBe("submitted");
    expect(claim.evidence.cartonPhotos).toHaveLength(1);
    expect(claim.messages[0]?.authorKind).toBe("customer");

    const replied = await receiver.call("POST /v1/store/orders/{orderId}/claims/{claimId}/messages", {
      path: { orderId: DELIVERED, claimId: claim.id },
      body: { body: "แนบรูปเพิ่มเติมแล้ว" },
    });
    expect(replied.messages).toHaveLength(2);

    const order = await receiver.call("GET /v1/store/orders/{orderId}", { path: { orderId: DELIVERED } });
    expect(order.claims.map((entry) => entry.claimNo)).toContain(claim.claimNo);
  });

  it("closes the claim window 7 days after receipt", async () => {
    const form = await returning.call("GET /v1/store/orders/{orderId}/claim-form", { path: { orderId: COMPLETED } });
    expect(form.open).toBe(false);
  });

  it("reorders re-priced, with reusable one-off costs waived, into the cart (D-153)", async () => {
    const preview = await returning.call("GET /v1/store/orders/{orderId}/reorder", {
      path: { orderId: COMPLETED },
      query: { quantity: 2000 },
    });
    expect(preview.quantity).toBe(2000);
    expect(preview.artwork).toMatchObject({ reused: true, proofSkipped: true });
    for (const line of preview.lines.filter((entry) => entry.oneOff)) {
      expect(line.grossAmount).toBe("0.00");
      expect(line.waivedReason).toMatch(/D-153/);
    }

    const stale = await failure(
      returning.call("POST /v1/store/orders/{orderId}/actions/reorder", {
        path: { orderId: COMPLETED },
        body: { quantity: 3000, previewToken: preview.previewToken },
        idempotencyKey: uuid(),
      }),
    );
    expect(stale?.status).toBe(409);

    const placed = await returning.call("POST /v1/store/orders/{orderId}/actions/reorder", {
      path: { orderId: COMPLETED },
      body: { quantity: 2000, previewToken: preview.previewToken },
      idempotencyKey: uuid(),
    });
    const cart = await returning.call("GET /v1/store/cart");
    const item = cart.items.find((entry) => entry.id === placed.cartItemId);
    expect(item?.quantity).toBe(2000);
    expect(item?.grossAmount).toBe(preview.grossAmount);
  });
});
