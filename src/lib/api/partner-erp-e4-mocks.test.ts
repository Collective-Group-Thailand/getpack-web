// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";

/**
 * The Packio Factory ERP E4 mock (packio-api v0.47, D-359 – D-371) keeps what the screens show: a quotation sent
 * with a link the customer accepts, the order, a delivery note, the invoice and its receipt — and who may do what.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const F001 = "00000000-0000-4000-8000-0000000000f1";
const api = (persona: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("partner", persona) });
const anon = () => createApiClient({ baseUrl: "http://api.mock" });
const path = { factoryId: F001 };
const key = (n: number) => ({ "Idempotency-Key": `00000000-0000-4000-8000-0000000e4${String(n).padStart(3, "0")}` });

describe("Packio Factory ERP E4 mock", () => {
  it("runs a sale from quotation to cash (D-360 – D-365)", async () => {
    const customer = (
      await api("owner").GET("/v1/partner/factories/{factoryId}/erp/partners", {
        params: { path, query: { role: "customer" } },
      })
    ).data!.data[0]!;
    const item = (await api("owner").GET("/v1/partner/factories/{factoryId}/erp/items", { params: { path } })).data!
      .data[0]!;
    const qt = (
      await api("sales").POST("/v1/partner/factories/{factoryId}/erp/quotations", {
        params: { path },
        body: {
          customerId: customer.id,
          lines: [
            { itemId: item.id, quantity: "10", unitPrice: "100" },
            { description: "ค่าออกแบบ", quantity: "1", unit: "set", unitPrice: "500" },
          ],
        },
      })
    ).data!;
    expect(qt).toMatchObject({ status: "draft", subtotal: "1500.00", total: "1605.00" });
    expect(qt.nextActions.map((a) => a.key)).toContain("erp_quote.send");

    const sent = (
      await api("sales").POST("/v1/partner/factories/{factoryId}/erp/quotations/{quotationId}/actions/send", {
        params: { path: { ...path, quotationId: qt.id }, header: key(1) },
      })
    ).data!;
    const token = sent.url.split("/q/")[1]!;
    const view = (await anon().GET("/v1/store/quote-links/{token}", { params: { path: { token } } })).data!;
    expect(view).toMatchObject({ quoteNo: qt.quoteNo, total: "1605.00", status: "sent" });
    await anon().POST("/v1/store/quote-links/{token}/actions/accept", {
      params: { path: { token } },
      body: { name: "คุณลูกค้า", agree: true },
    });

    const so = (
      await api("sales").POST("/v1/partner/factories/{factoryId}/erp/quotations/{quotationId}/actions/order", {
        params: { path: { ...path, quotationId: qt.id }, header: key(2) },
      })
    ).data!;
    expect(so.lines.map((l) => l.fulfilment)).toEqual(["stock", "service"]);
    await api("sales").POST("/v1/partner/factories/{factoryId}/erp/sales-orders/{salesOrderId}/actions/confirm", {
      params: { path: { ...path, salesOrderId: so.id }, header: key(3) },
      body: {},
    });

    const dn = (
      await api("storekeeper").POST("/v1/partner/factories/{factoryId}/erp/delivery-notes", {
        params: { path },
        body: { salesOrderId: so.id },
      })
    ).data!;
    await api("storekeeper").POST("/v1/partner/factories/{factoryId}/erp/delivery-notes/{deliveryNoteId}/actions/issue", {
      params: { path: { ...path, deliveryNoteId: dn.id }, header: key(4) },
    });
    const after = (
      await api("sales").GET("/v1/partner/factories/{factoryId}/erp/sales-orders/{salesOrderId}", {
        params: { path: { ...path, salesOrderId: so.id } },
      })
    ).data!;
    expect(after.status).toBe("delivered");

    const iv = (
      await api("accountant").POST("/v1/partner/factories/{factoryId}/erp/sales-invoices", {
        params: { path },
        body: { customerId: customer.id, salesOrderId: so.id, deliveryNoteIds: [dn.id] },
      })
    ).data!;
    expect(iv.total).toBe("1605.00");
    const issued = (
      await api("accountant").POST("/v1/partner/factories/{factoryId}/erp/sales-invoices/{invoiceId}/actions/issue", {
        params: { path: { ...path, invoiceId: iv.id }, header: key(5) },
        body: {},
      })
    ).data!;
    expect(issued.invoiceNo).toBeTruthy();
    await api("accountant").POST("/v1/partner/factories/{factoryId}/erp/receipts", {
      params: { path, header: key(6) },
      body: {
        customerId: customer.id,
        receivedOn: issued.issueDate,
        method: "transfer",
        amount: "1605.00",
        allocations: [{ invoiceId: iv.id, amount: "1605.00" }],
      },
    });
    const paid = (
      await api("accountant").GET("/v1/partner/factories/{factoryId}/erp/sales-invoices/{invoiceId}", {
        params: { path: { ...path, invoiceId: iv.id } },
      })
    ).data!;
    expect(paid).toMatchObject({ status: "paid", openAmount: "0.00" });
  });

  it("keeps sales, receivables and tax to their roles (D-371)", async () => {
    await expect(
      api("operator").GET("/v1/partner/factories/{factoryId}/erp/quotations", { params: { path } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      api("storekeeper").GET("/v1/partner/factories/{factoryId}/erp/sales-invoices", { params: { path } }),
    ).rejects.toMatchObject({ status: 403 });
    const leads = (await api("sales").GET("/v1/partner/factories/{factoryId}/erp/leads", { params: { path } })).data!;
    expect(leads.data[0]?.nextActions.map((a) => a.key)).toContain("erp_lead.convert");
  });
});
