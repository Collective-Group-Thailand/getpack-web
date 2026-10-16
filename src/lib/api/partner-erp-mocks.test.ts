// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { accessToken, mockId } from "../../../mocks/support";
import { createApiClient } from "./client";

/**
 * The getpack Factory ERP mock (getpack-api v0.44.0, D-316 – D-327) keeps the API's rules: the factory's own
 * data only, roles, idempotent stock posts, no negative stock, and purchase orders numbered when issued.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const F001 = "00000000-0000-4000-8000-0000000000f1";
const api = (persona: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("partner", persona) });
const path = { factoryId: F001 };

describe("getpack Factory ERP mock", () => {
  it("keeps another factory's ERP out of reach and checks roles (D-317, D-319)", async () => {
    await expect(
      api("owner").GET("/v1/partner/factories/{factoryId}/erp/items", {
        params: { path: { factoryId: mockId("fac", 6) } },
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      api("operator").GET("/v1/partner/factories/{factoryId}/erp/partners", { params: { path } }),
    ).rejects.toMatchObject({
      status: 403,
    });
    const { data } = await api("storekeeper").GET("/v1/partner/factories/{factoryId}/erp/items", { params: { path } });
    expect(data!.data.length).toBeGreaterThan(0);
  });

  it("issues at most what is in stock, and replays a post by its key (D-322)", async () => {
    const items = (
      await api("owner").GET("/v1/partner/factories/{factoryId}/erp/items", {
        params: { path, query: { q: "KA-350" } },
      })
    ).data!.data;
    const item = items[0]!;
    const key = "00000000-0000-4000-8000-00000000e999";
    const post = () =>
      api("owner").POST("/v1/partner/factories/{factoryId}/erp/stock/actions/issue", {
        params: { path, header: { "Idempotency-Key": key } },
        body: { kind: "issue", lines: [{ itemId: item.id, quantity: "500" }] },
      });
    const first = (await post()).data!;
    const again = (await post()).data!;
    expect(again.documentNo).toBe(first.documentNo);
    expect(first.movements[0]).toMatchObject({ kind: "issue", quantity: "-500.000" });
    await expect(
      api("owner").POST("/v1/partner/factories/{factoryId}/erp/stock/actions/issue", {
        params: { path, header: { "Idempotency-Key": "00000000-0000-4000-8000-00000000e998" } },
        body: { kind: "issue", lines: [{ itemId: item.id, quantity: "9999999" }] },
      }),
    ).rejects.toMatchObject({ status: 409, code: "erp.stock_insufficient" });
  });

  it("numbers a purchase order only when the owner issues it (D-323, D-325)", async () => {
    const suppliers = (
      await api("purchaser").GET("/v1/partner/factories/{factoryId}/erp/partners", {
        params: { path, query: { role: "supplier" } },
      })
    ).data!.data;
    const item = (await api("purchaser").GET("/v1/partner/factories/{factoryId}/erp/items", { params: { path } })).data!
      .data[0]!;
    const draft = (
      await api("purchaser").POST("/v1/partner/factories/{factoryId}/erp/purchase-orders", {
        params: { path },
        body: {
          supplierId: suppliers[0]!.id,
          vatMode: "exclusive",
          lines: [{ itemId: item.id, quantity: "2", unitPrice: "100" }],
        },
      })
    ).data!;
    expect(draft).toMatchObject({
      poNo: null,
      status: "draft",
      subtotal: "200.00",
      vatAmount: "14.00",
      total: "214.00",
    });
    expect(draft.nextActions.map((a) => a.key)).not.toContain("erp_po.issue");
    await expect(
      api("purchaser").POST("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}/actions/issue", {
        params: {
          path: { ...path, poId: draft.id },
          header: { "Idempotency-Key": "00000000-0000-4000-8000-00000000e997" },
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    const issued = (
      await api("owner").POST("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}/actions/issue", {
        params: {
          path: { ...path, poId: draft.id },
          header: { "Idempotency-Key": "00000000-0000-4000-8000-00000000e996" },
        },
      })
    ).data!;
    expect(issued.poNo).toMatch(/^PO-\d{4}-\d{4}$/);
    expect(issued.nextActions.map((a) => a.key)).toContain("erp_po.receive");
  });
});
