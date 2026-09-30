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
  /** The published contract, for the operations this zone has migrated (U-F0.2). */
  api: () =>
    createApiClient({
      baseUrl: "http://api.mock",
      accessToken: persona === "guest" ? undefined : accessToken("customer", persona),
    }),
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
    expect(tracking!.steps).toEqual(progress!.steps);
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
    // CONTRACT-GAP store.orders — no tolerance outcome is published; the delivery says how many arrived.
    const item = shipments![0]!.items[0]!;
    expect(item.deliveredQuantity).toBeLessThan(item.quantity);

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
    const { data: progress } = await api.GET("/v1/store/orders/{orderId}/progress", {
      params: { path: { orderId: DELIVERED } },
    });
    expect(progress!.completedAt).toBeTruthy();
  });

  it("files a claim with both kinds of photo, and it reaches the desk (D-082)", async () => {
    const api = receiver.api();
    const form = await receiver.call("GET /v1/store/orders/{orderId}/claim-form", { path: { orderId: DELIVERED } });
    expect(form.open).toBe(true);
    expect(form.evidence.minCartonPhotos).toBeGreaterThan(0);

    const submit = (cartonPhotoFileIds: string[]) =>
      api.POST("/v1/store/orders/{orderId}/claims", {
        params: { path: { orderId: DELIVERED }, header: { "Idempotency-Key": uuid() } },
        body: {
          type: "damaged",
          shipmentId: form.shipments[0]!.id,
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

    // `store.claims.reorder` adds the line and answers with the cart (no preview token to hold).
    const { data: cart } = await returning.api().POST("/v1/store/orders/{orderId}/actions/reorder", {
      params: { path: { orderId: COMPLETED }, header: { "Idempotency-Key": uuid() } },
      body: { quantity: 2000, reuseArtwork: true },
    });
    const item = cart!.items.find((entry) => entry.quantity === 2000 && entry.reorderOf === null);
    expect(item?.productGrossAmount).toBe(preview.grossAmount);
  });
});
