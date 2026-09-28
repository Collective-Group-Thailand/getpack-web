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

import { buildConfiguration } from "../configurator/build";
import { initialState } from "../configurator/state";
import { parseReorderCsv } from "./csv";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// Built per call: a client made before `server.listen()` would hold the unpatched `fetch`.
const as = (persona: string) => ({
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

async function cartWith(customer: typeof admin, quantity: number) {
  const cart = await customer.call("GET /v1/store/cart");
  for (const item of cart.items)
    await customer.call("DELETE /v1/store/cart/items/{itemId}", { path: { itemId: item.id } });
  const configurator = await customer.call("GET /v1/store/catalog/products/{slug}/configurator", {
    path: { slug: "tuck-end-box" },
  });
  const state = { ...initialState(configurator), quantities: [quantity], quantity };
  const quote = await customer.call("POST /v1/store/quotes", {
    body: {
      productTypeCode: configurator.productTypeCode,
      catalogProductSlug: configurator.slug,
      configuration: buildConfiguration(configurator, state) as unknown as Record<string, unknown>,
      quantity,
      designOption: "own_file",
      mockupOption: "none",
    },
  });
  await customer.call("POST /v1/store/cart/items", { body: { quoteId: quote.id } });
}

const input = (poNumber?: string) => ({
  contact: { name: "ฝ่ายจัดซื้อ", phone: "0878901234", email: "seed.companybuyer@packio.invalid" },
  delivery: { mode: "per_item" as const },
  taxProfileId: null,
  couponCodes: [],
  pointsToRedeem: 0,
  ...(poNumber ? { poNumber } : {}),
});

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

  it("sends a buyer's order over the threshold to the approver, who places it (D-123, D-125)", async () => {
    await cartWith(buyer, 10_000);
    const blocked = await buyer.call("POST /v1/store/checkout/actions/preview", { body: input() });
    expect(blocked.company?.needsApproval).toBe(true);
    expect(blocked.blockers.map((blocker) => blocker.code)).toContain("po_required");

    const preview = await buyer.call("POST /v1/store/checkout/actions/preview", { body: input("PO-7788") });
    expect(preview.blockers).toEqual([]);
    const refused = await failure(
      buyer.call("POST /v1/store/checkout", {
        body: { ...input("PO-7788"), previewToken: preview.previewToken },
        idempotencyKey: uuid(),
      }),
    );
    expect(refused?.code).toBe("company.approval_required");

    const sent = await buyer.call("POST /v1/store/me/company/approvals", {
      body: { ...input("PO-7788"), previewToken: preview.previewToken },
      idempotencyKey: uuid(),
    });
    expect(sent).toMatchObject({ status: "pending", poNumber: "PO-7788", grossAmount: preview.totals.grossAmount });

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
    const pending = await admin.call("GET /v1/store/me/company/approvals", { query: { status: "pending" } });
    expect(pending.data.map((approval) => approval.requestNo)).toContain(sent.requestNo);
    const approved = await admin.call("POST /v1/store/me/company/approvals/{approvalId}/actions/approve", {
      path: { approvalId: sent.id },
      idempotencyKey: uuid(),
    });
    expect(approved.status).toBe("approved");
    expect(approved.orders.length).toBeGreaterThan(0);
  });

  it("offers the credit term within available credit, with nothing to pay today (D-121)", async () => {
    await cartWith(admin, 1000);
    const preview = await admin.call("POST /v1/store/checkout/actions/preview", { body: input("PO-1") });
    const credit = preview.schedule.options.find((option) => option.kind === "credit_term");
    expect(credit?.creditDays).toBe(30);
    const before = await admin.call("GET /v1/store/me/company");
    const chosen = await admin.call("POST /v1/store/checkout/actions/preview", {
      body: { ...input("PO-1"), scheduleKey: credit!.key, paymentMethod: "credit_term_transfer" },
    });
    const placed = await admin.call("POST /v1/store/checkout", {
      body: {
        ...input("PO-1"),
        scheduleKey: credit!.key,
        paymentMethod: "credit_term_transfer",
        previewToken: chosen.previewToken,
      },
      idempotencyKey: uuid(),
    });
    expect(placed.firstInstalment).toBeNull();
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
