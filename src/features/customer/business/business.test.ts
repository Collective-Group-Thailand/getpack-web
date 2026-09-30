// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken } from "../../../../mocks/support";
import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { createRequestClient } from "@/lib/api/requests/client";
import { REQUESTS } from "@/lib/api/requests/registry";
import type { Schemas } from "@/lib/api/types";

import { buildCalculateBody } from "../configurator/build";
import { initialState } from "../configurator/state";
import { parseReorderCsv } from "./csv";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// Built per call: a client made before `server.listen()` would hold the unpatched `fetch`.
const as = (persona: string) => ({
  token: accessToken("customer", persona),
  call: ((...args: unknown[]) =>
    (
      createRequestClient(
        REQUESTS,
        createApiClient({
          baseUrl: "http://api.mock",
          accessToken: accessToken("customer", persona),
        }) as unknown as Client<never>,
      ).call as (...a: unknown[]) => unknown
    )(...args)) as ReturnType<typeof createRequestClient<typeof REQUESTS>>["call"],
});
const admin = as("companyadmin");
const buyer = as("companybuyer");
const founder = as("founder");
const uuid = () => crypto.randomUUID();
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (isApiError(error) ? error : Promise.reject(error)),
  );

/** An empty cart, then one quotation of `quantity` in it — through the published cart. */
async function cartWith(customer: typeof admin, quantity: number) {
  const api = createApiClient({ baseUrl: "http://api.mock", accessToken: customer.token });
  const { data: cart } = await api.GET("/v1/store/cart");
  for (const item of cart!.items)
    await api.DELETE("/v1/store/cart/items/{itemId}", { params: { path: { itemId: item.id } } });
  const configurator = await customer.call("GET /v1/store/catalog/products/{slug}/configurator", {
    path: { slug: "tuck-end-box" },
  });
  const state = { ...initialState(configurator), quantities: [quantity], quantity };
  const { data: quote } = await api.POST("/v1/store/quotes", {
    body: buildCalculateBody(configurator, state) as unknown as Schemas["SaveQuoteDto"],
  });
  const { response } = await api.GET("/v1/store/cart");
  await api.POST("/v1/store/cart/items", {
    params: { header: { "If-Match": response.headers.get("etag")! } },
    body: { quoteId: quote!.id, quoteOptionId: quote!.options[0]!.id, designOption: "own_file" },
  });
}

describe("the bulk reorder CSV", () => {
  it("reads order numbers and quantities, with or without a header, and says which lines are wrong", () => {
    const parsed = parseReorderCsv("order,quantity\nPK-2569-00101,2000\n\nPK-2569-00113\nPK-2569-00125,abc\n");
    expect(parsed.rows).toEqual([
      { line: 2, orderCode: "PK-2569-00101", quantity: 2000 },
      { line: 4, orderCode: "PK-2569-00113", quantity: null },
    ]);
    expect(parsed.errors).toEqual([{ line: 5, value: "PK-2569-00125,abc" }]);
    expect(parseReorderCsv("\uFEFFPK-2569-00101;1000").rows).toEqual([
      { line: 1, orderCode: "PK-2569-00101", quantity: 1000 },
    ]);
  });
});

describe("business accounts, against the mock", () => {
  it("shows each member what their roles allow", async () => {
    const mine = await admin.call("GET /v1/store/me/company");
    expect(mine.can).toMatchObject({ manageMembers: true, approveOrders: true });
    const theirs = await buyer.call("GET /v1/store/me/company");
    expect(theirs.can).toMatchObject({ manageMembers: false, approveOrders: false, order: true });
    expect((await failure(buyer.call("GET /v1/store/me/company/statements")))?.status).toBe(403);
  });

  it("places a buyer's order over the threshold as waiting for the approver, who places it (D-123, D-125)", async () => {
    await cartWith(buyer, 10_000);
    const api = createApiClient({ baseUrl: "http://api.mock", accessToken: buyer.token });
    const [company] = (await api.GET("/v1/store/companies")).data!;
    const body = (poNumber?: string): Schemas["CheckoutDto"] => ({
      taxProfileId: null,
      companyId: company!.id,
      ...(poNumber ? { poNumber } : {}),
    });

    const withoutPo = await failure(api.POST("/v1/store/checkout/actions/preview", { body: body() }));
    expect(withoutPo?.code).toBe("companies.po_required");
    const { data: preview } = await api.POST("/v1/store/checkout/actions/preview", { body: body("PO-7788") });
    expect(preview!.notices.map((notice) => notice.code)).toContain("company.approval_required");

    const { data: group } = await api.POST("/v1/store/checkout", {
      params: { header: { "Idempotency-Key": uuid() } },
      body: { ...body("PO-7788"), expectedGrossAmount: preview!.totals.grossAmount },
    });
    expect(group).toMatchObject({ status: "pending_company_approval", poNumber: "PO-7788" });

    const pending = await admin.call("GET /v1/store/me/company/approvals", { query: { status: "pending" } });
    const sent = pending.data.find((approval) => approval.requestNo === group!.groupCode)!;
    expect(sent.grossAmount).toBe(preview!.totals.grossAmount);
    expect(
      (
        await failure(
          buyer.call("POST /v1/store/me/company/approvals/{approvalId}/actions/approve", {
            path: { approvalId: sent.id },
            idempotencyKey: uuid(),
          }),
        )
      )?.status,
    ).toBe(403);
    const approved = await admin.call("POST /v1/store/me/company/approvals/{approvalId}/actions/approve", {
      path: { approvalId: sent.id },
      idempotencyKey: uuid(),
    });
    expect(approved.status).toBe("approved");
    expect(approved.orders.length).toBeGreaterThan(0);
  });

  it("puts a company with credit on its term by rule, with nothing to pay today (D-020, D-121)", async () => {
    await cartWith(admin, 1000);
    const api = createApiClient({ baseUrl: "http://api.mock", accessToken: admin.token });
    const [company] = (await api.GET("/v1/store/companies")).data!;
    const body: Schemas["CheckoutDto"] = { taxProfileId: null, companyId: company!.id, poNumber: "PO-1" };
    const { data: preview } = await api.POST("/v1/store/checkout/actions/preview", { body });
    expect(preview!.paymentSchedule!.instalments.map((instalment) => instalment.dueTrigger)).toEqual([
      "days_after_delivery",
    ]);
    expect(preview!.notices.map((notice) => notice.code)).toContain("company.credit_order");
    const before = await admin.call("GET /v1/store/me/company");
    const { data: group } = await api.POST("/v1/store/checkout", {
      params: { header: { "Idempotency-Key": uuid() } },
      body: { ...body, expectedGrossAmount: preview!.totals.grossAmount },
    });
    expect(group!.status).toBe("in_progress");
    const after = await admin.call("GET /v1/store/me/company");
    expect(Number(after.credit.availableAmount)).toBeLessThan(Number(before.credit.availableAmount));
  });

  it("signs a company up only with fresh KYC documents (D-120)", async () => {
    const body = {
      legalName: "บริษัท ทดสอบ จำกัด",
      taxId: "0105569000011",
      isVatRegistered: true,
      headOffice: { address: "99 ถนนทดสอบ แขวงทดสอบ เขตทดสอบ กรุงเทพมหานคร 10110" },
      signatory: { name: "สมใจ ทดสอบ", position: "กรรมการผู้จัดการ" },
      contactPhone: "0889012345",
    };
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const missing = await failure(
      founder.call("POST /v1/store/companies", {
        body: {
          ...body,
          documents: [
            { docType: "company_certificate", fileId: uuid(), issuedOn: today },
            { docType: "signatory_id", fileId: uuid() },
          ],
        },
        idempotencyKey: uuid(),
      }),
    );
    expect(missing?.code).toBe("company.kyc_missing");
    const stale = await failure(
      founder.call("POST /v1/store/companies", {
        body: {
          ...body,
          documents: [
            { docType: "company_certificate", fileId: uuid(), issuedOn: old },
            { docType: "vat_registration_pp20", fileId: uuid() },
            { docType: "signatory_id", fileId: uuid() },
          ],
        },
        idempotencyKey: uuid(),
      }),
    );
    expect(stale?.code).toBe("company.certificate_too_old");
    const created = await founder.call("POST /v1/store/companies", {
      body: {
        ...body,
        documents: [
          { docType: "company_certificate", fileId: uuid(), issuedOn: today },
          { docType: "vat_registration_pp20", fileId: uuid() },
          { docType: "signatory_id", fileId: uuid() },
        ],
      },
      idempotencyKey: uuid(),
    });
    expect(created).toMatchObject({ status: "kyc_review", myRoles: expect.arrayContaining(["company_admin"]) });
    expect(created.statusNote).toBeTruthy();
  });

  it("checks bulk reorder rows before anything reaches the cart (D-153)", async () => {
    const orders = await admin.call("GET /v1/store/orders", { query: { view: "active" } });
    const code = orders.data[0]!.orderCode;
    const preview = await admin.call("POST /v1/store/me/company/bulk-reorders/actions/preview", {
      body: {
        rows: [
          { line: 1, orderCode: code, quantity: 2000 },
          { line: 2, orderCode: "PK-0000-00000", quantity: 1000 },
          { line: 3, orderCode: code, quantity: 10 },
        ],
      },
    });
    expect(preview.okCount).toBe(1);
    expect(preview.rows.map((row) => row.status)).toEqual(["ok", "error", "error"]);
    const added = await admin.call("POST /v1/store/me/company/bulk-reorders", {
      body: { previewToken: preview.previewToken },
      idempotencyKey: uuid(),
    });
    expect(added.cartItemIds).toHaveLength(1);
  });
});
