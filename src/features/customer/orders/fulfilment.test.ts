// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken, mockId } from "../../../../mocks/support";
import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// Built per call: a client made before `server.listen()` would hold the unpatched `fetch`.
const as = (persona?: string) => ({
  api: () =>
    createApiClient({
      baseUrl: "http://api.mock",
      accessToken: persona === "guest" ? undefined : accessToken("customer", persona),
    }),
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
    const api = receiver.api();
    const path = { params: { path: { orderId: DELIVERED } } };
    const { data: progress } = await api.GET("/v1/store/orders/{orderId}/progress", path);
    expect(progress!.steps.map((step) => step.key)).toEqual([
      "ordered",
      "paid",
      "artwork",
      "production",
      "shipping",
      "completed",
    ]);
    expect(progress!.steps.find((step) => step.status === "in_progress")?.key).toBe("completed");

    const { data: link } = await api.POST("/v1/store/orders/{orderId}/tracking-links", {
      params: { path: { orderId: DELIVERED }, header: { "Idempotency-Key": uuid() } },
    });
    const { data: order } = await api.GET("/v1/store/orders/{orderId}", path);
    const { data: tracking } = await guest.api().GET("/v1/store/track/{token}", {
      params: { path: { token: link!.token } },
    });
    // The same steps as the order's own page (their times are the mock's clock, read twice).
    const stepsOf = (steps: { key: string; status: string }[]) => steps.map(({ key, status }) => ({ key, status }));
    expect(stepsOf(tracking!.steps)).toEqual(stepsOf(progress!.steps));
    const text = JSON.stringify(tracking);
    expect(text).not.toContain(order!.orderCode);
    for (const destination of order!.destinations) {
      expect(text).not.toContain(destination.address.recipientName);
      expect(text).not.toContain(destination.address.phone);
      expect(text).not.toContain(destination.address.line1);
    }
    expect(text).not.toContain(order!.totals.grossAmount);
    const missing = await failure(
      guest.api().GET("/v1/store/track/{token}", { params: { path: { token: "trk0000" } } }),
    );
    expect(missing?.status).toBe(404);
  });

  it("shows what was delivered and completes on confirmed receipt (D-080, D-081)", async () => {
    const api = receiver.api();
    const { data: shipments } = await api.GET("/v1/store/orders/{orderId}/shipments", {
      params: { path: { orderId: DELIVERED } },
    });
    const item = shipments![0]!.items[0]!;
    expect(item.deliveredQuantity).toBeLessThan(item.quantity);
    // The order says how that compares with what was ordered (D-021, D-080), and what it may do now.
    const { data: order } = await api.GET("/v1/store/orders/{orderId}", { params: { path: { orderId: DELIVERED } } });
    expect(order!.toleranceOutcome?.deliveredQuantity).toBe(item.deliveredQuantity);
    expect(order!.nextActions.map((action) => action.key)).toEqual(
      expect.arrayContaining(["order.confirm_receipt", "order.open_claim", "order.reorder"]),
    );

    const refused = await failure(
      api.POST("/v1/store/orders/{orderId}/actions/confirm-receipt", {
        params: { path: { orderId: DELIVERED }, header: { "Idempotency-Key": "" } },
      }),
    );
    expect(refused?.status).toBe(400);
    const { data: after } = await api.POST("/v1/store/orders/{orderId}/actions/confirm-receipt", {
      params: { path: { orderId: DELIVERED }, header: { "Idempotency-Key": uuid() } },
    });
    expect(after!.status).toBe("completed");
    expect(after!.receipt).toMatchObject({ completionMode: "customer_confirmed" });
    expect(after!.nextActions.map((action) => action.key)).not.toContain("order.confirm_receipt");
    const { data: progress } = await api.GET("/v1/store/orders/{orderId}/progress", {
      params: { path: { orderId: DELIVERED } },
    });
    expect(progress!.completedAt).toBeTruthy();
  });

  it("files a claim with both kinds of photo, and it reaches the desk (D-082)", async () => {
    const api = receiver.api();
    const { data: form } = await api.GET("/v1/store/orders/{orderId}/claim-form", {
      params: { path: { orderId: DELIVERED } },
    });
    expect(form!.open).toBe(true);
    expect(form!.evidence.cartonPhotosMin).toBeGreaterThan(0);

    const submit = (cartonPhotoFileIds: string[]) =>
      api.POST("/v1/store/orders/{orderId}/claims", {
        params: { path: { orderId: DELIVERED }, header: { "Idempotency-Key": uuid() } },
        body: {
          type: "damaged",
          shipmentId: form!.shipments[0]!.id,
          claimedQuantity: 20,
          description: "กล่องบุบ 20 ใบ ฝาฉีก",
          requestedResolution: "reprint",
          productPhotoFileIds: [uuid()],
          cartonPhotoFileIds,
        },
      });
    expect((await failure(submit([])))?.status).toBe(422);

    const { data: claim } = await submit([uuid()]);
    expect(claim!.status).toBe("submitted");
    expect(claim!.photos.carton).toHaveLength(1);
    expect(claim!.claimedQuantity).toBe(20);

    // `store.claims.respondInfo` answers only what the team asked for (status `need_info`).
    const early = await failure(
      api.POST("/v1/store/claims/{claimId}/info", {
        params: { path: { claimId: claim!.id }, header: { "Idempotency-Key": uuid() } },
        body: { response: "แนบรูปเพิ่มเติมแล้ว" },
      }),
    );
    expect(early?.status).toBe(409);

    const { data: listed } = await api.GET("/v1/store/claims", { params: { query: { orderId: DELIVERED } } });
    expect(listed!.data.map((entry) => entry.claimNo)).toContain(claim!.claimNo);
  });

  it("closes the claim window 7 days after receipt", async () => {
    const { data: form } = await returning.api().GET("/v1/store/orders/{orderId}/claim-form", {
      params: { path: { orderId: COMPLETED } },
    });
    expect(form).toMatchObject({ open: false, closedReason: "window_closed" });
  });

  it("reorders re-priced into the cart, held to the price it previewed (D-153)", async () => {
    const api = returning.api();
    const { data: preview } = await api.GET("/v1/store/orders/{orderId}/reorder", {
      params: { path: { orderId: COMPLETED }, query: { quantity: 2000 } },
    });
    expect(preview!.quantity).toBe(2000);
    expect(preview!.proofSkipped).toBe(true);

    // A token for another quantity is refused rather than putting a price nobody saw in the cart.
    const stale = await failure(
      api.POST("/v1/store/orders/{orderId}/actions/reorder", {
        params: { path: { orderId: COMPLETED }, header: { "Idempotency-Key": uuid() } },
        body: { quantity: 3000, reuseArtwork: true, previewToken: preview!.previewToken },
      }),
    );
    expect(stale?.code).toBe("orders.reorder_preview_expired");

    const { data: cart } = await api.POST("/v1/store/orders/{orderId}/actions/reorder", {
      params: { path: { orderId: COMPLETED }, header: { "Idempotency-Key": uuid() } },
      body: { quantity: 2000, reuseArtwork: true, previewToken: preview!.previewToken },
    });
    const item = cart!.items.find((entry) => entry.quantity === 2000 && entry.reorderOf?.orderId === COMPLETED);
    expect(item?.productGrossAmount).toBe(preview!.grossAmount);
  });
});
