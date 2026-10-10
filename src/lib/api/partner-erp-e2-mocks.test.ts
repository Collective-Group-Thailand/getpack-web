// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";

/**
 * The Packio Factory ERP E2 mock (packio-api v0.45, D-333 – D-342) keeps the rules a screen shows: a request
 * waits for an approver, an invoice priced off the order needs approval before it can be paid, and a released
 * production order holds its material and lists what is short.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const F001 = "00000000-0000-4000-8000-0000000000f1";
const api = (persona: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("partner", persona) });
const path = { factoryId: F001 };
const key = (n: number) => ({ "Idempotency-Key": `00000000-0000-4000-8000-0000000e2${String(n).padStart(3, "0")}` });

describe("Packio Factory ERP E2 mock", () => {
  it("links the usual supplier and keeps quoted prices (D-333, D-334)", async () => {
    const items = (await api("owner").GET("/v1/partner/factories/{factoryId}/erp/items", { params: { path } })).data!;
    const paper = items.data.find((i) => i.defaultSupplier)!;
    const links = (
      await api("owner").GET("/v1/partner/factories/{factoryId}/erp/items/{itemId}/suppliers", {
        params: { path: { ...path, itemId: paper.id } },
      })
    ).data!;
    expect(links[0]).toMatchObject({ preferred: true, supplier: { id: paper.defaultSupplier!.id } });
    const price = (
      await api("owner").POST("/v1/partner/factories/{factoryId}/erp/items/{itemId}/prices", {
        params: { path: { ...path, itemId: paper.id } },
        body: { supplierId: paper.defaultSupplier!.id, source: "quotation", unitPrice: "1500" },
      })
    ).data!;
    expect(price).toMatchObject({ source: "quotation", unitPrice: "1500.000000" });
    const history = (
      await api("owner").GET("/v1/partner/factories/{factoryId}/erp/items/{itemId}/prices", {
        params: { path: { ...path, itemId: paper.id } },
      })
    ).data!;
    expect(history.data[0]!.id).toBe(price.id);
  });

  it("makes a storekeeper's request wait for the owner (D-336)", async () => {
    const items = (await api("owner").GET("/v1/partner/factories/{factoryId}/erp/items", { params: { path } })).data!;
    const pr = (
      await api("storekeeper").POST("/v1/partner/factories/{factoryId}/erp/purchase-requests", {
        params: { path },
        body: { lines: [{ itemId: items.data[0]!.id, quantity: "1000" }] },
      })
    ).data!;
    expect(pr.prNo).toMatch(/^PR-\d{4}-\d{4}$/);
    const submitted = (
      await api("storekeeper").POST("/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}/actions/submit", {
        params: { path: { ...path, prId: pr.id }, header: key(1) },
      })
    ).data!;
    expect(submitted.status).toBe("submitted");
    expect(submitted.nextActions.map((a) => a.key)).not.toContain("erp_pr.approve");
    const asOwner = (
      await api("owner").GET("/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}", {
        params: { path: { ...path, prId: pr.id } },
      })
    ).data!;
    expect(asOwner.nextActions.map((a) => a.key)).toContain("erp_pr.approve");
  });

  it("holds an invoice priced off the order until it is approved (D-337)", async () => {
    const supplier = (
      await api("owner").GET("/v1/partner/factories/{factoryId}/erp/partners", { params: { path } })
    ).data!.data.find((p) => p.kind === "supplier")!;
    const invoice = (
      await api("owner").POST("/v1/partner/factories/{factoryId}/erp/supplier-invoices", {
        params: { path },
        body: {
          supplierId: supplier.id,
          invoiceNo: "IV-MOCK-1",
          invoiceDate: "2026-10-12",
          lines: [{ description: "ค่าขนส่ง (จำลอง)", quantity: "1", unitPrice: "500" }],
        },
      })
    ).data!;
    expect(invoice).toMatchObject({ status: "variance", lines: [{ variance: "unordered" }] });
    await expect(
      api("owner").POST("/v1/partner/factories/{factoryId}/erp/supplier-payments", {
        params: { path, header: key(2) },
        body: {
          supplierId: supplier.id,
          method: "transfer",
          allocations: [{ supplierInvoiceId: invoice.id, amount: "100" }],
        },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
