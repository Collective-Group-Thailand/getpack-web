// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken } from "../../../../mocks/support";
import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";

import { buildCalculateBody } from "../configurator/build";
import { fromContract } from "../configurator/from-contract";
import { initialState } from "../configurator/state";
import { parseReorderCsv } from "./csv";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// Built per call: a client made before `server.listen()` would hold the unpatched `fetch`.
const as = (persona: string) => ({ token: accessToken("customer", persona) });
const admin = as("companyadmin");
const buyer = as("companybuyer");
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
  const { data: published } = await api.GET("/v1/store/catalog/products/{slug}/configurator", {
    params: { path: { slug: "tuck-end-box" } },
  });
  const configurator = fromContract(published!, { unit: (unit) => unit });
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
  /** The member's company and their own membership in it, through the published contract. */
  async function membership(member: typeof admin) {
    const api = createApiClient({ baseUrl: "http://api.mock", accessToken: member.token });
    const [{ data: me }, { data: companies }] = await Promise.all([
      api.GET("/v1/store/me"),
      api.GET("/v1/store/companies"),
    ]);
    const company = companies![0]!;
    return { api, company, self: company.members.find((entry) => entry.user.id === me!.id)! };
  }

  it("shows each member what their roles open (the company's own `can` map)", async () => {
    const mine = await membership(admin);
    expect(mine.company.can).toMatchObject({ manageMembers: true, approveOrders: true, manageAssets: true });
    const theirs = await membership(buyer);
    expect(theirs.company.can).toMatchObject({
      manageMembers: false,
      approveOrders: false,
      manageAssets: false,
      order: true,
    });
    // Brand assets: every member reads them, only the Company Admin adds (D-227).
    const add = (member: typeof theirs) =>
      member.api.POST("/v1/store/companies/{companyId}/brand-assets", {
        params: { path: { companyId: member.company.id } },
        body: { fileId: uuid(), kind: "logo", name: "โลโก้" },
      });
    expect((await failure(add(theirs)))?.status).toBe(403);
    const { data: listed } = await theirs.api.GET("/v1/store/companies/{companyId}/brand-assets", {
      params: { path: { companyId: theirs.company.id } },
    });
    expect(listed!.length).toBeGreaterThan(0);
    const month = new Date().toISOString().slice(0, 7);
    expect(
      (
        await failure(
          theirs.api.GET("/v1/store/companies/{companyId}/statements", {
            params: { path: { companyId: theirs.company.id }, query: { month } },
          }),
        )
      )?.status,
    ).toBe(403);
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

    const approver = await membership(admin);
    const { data: pending } = await approver.api.GET("/v1/store/companies/{companyId}/approvals", {
      params: { path: { companyId: approver.company.id } },
    });
    const sent = pending!.find((approval) => approval.groupCode === group!.groupCode)!;
    expect(sent).toMatchObject({ amount: preview!.totals.grossAmount, poNumber: "PO-7788" });
    const decide = (member: Awaited<ReturnType<typeof membership>>, decision: "approve" | "reject") =>
      member.api.POST("/v1/store/companies/{companyId}/approvals/{approvalId}/actions/{decision}", {
        params: { path: { companyId: member.company.id, approvalId: sent.id, decision } },
        body: {},
      });
    expect((await failure(decide(await membership(buyer), "approve")))?.status).toBe(403);
    const { data: approved } = await decide(approver, "approve");
    expect(approved!.status).toBe("approved");
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
    const credit = async () =>
      (await api.GET("/v1/store/companies/{companyId}/credit", { params: { path: { companyId: company!.id } } })).data!;
    const before = await credit();
    const { data: group } = await api.POST("/v1/store/checkout", {
      params: { header: { "Idempotency-Key": uuid() } },
      body: { ...body, expectedGrossAmount: preview!.totals.grossAmount },
    });
    expect(group!.status).toBe("in_progress");
    const after = await credit();
    expect(Number(after.availableAmount)).toBeLessThan(Number(before.availableAmount));
  });

  it("signs a company up: apply with the postcode's ids, file the KYC documents, then submit (D-120)", async () => {
    const api = createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("customer", "founder") });
    const { data: areas } = await api.GET("/v1/store/catalog/geo/postcodes/{postcode}", {
      params: { path: { postcode: "10110" } },
    });
    const area = areas![0]!;
    const headOffice = {
      name: "สำนักงานใหญ่",
      line1: "1 ถนนทดสอบ",
      postcode: "10110",
      provinceId: area.province.id,
      subdistrictId: area.subdistrict.id,
    };
    const apply = (body: Partial<Schemas["ApplyCompanyDto"]>) =>
      api.POST("/v1/store/companies", {
        params: { header: { "Idempotency-Key": uuid() } },
        body: {
          legalName: "บริษัท ทดสอบหน่วย จำกัด",
          taxId: "0105556000017",
          isVatRegistered: false,
          headOffice,
          signatory: { name: "สมใจ ทดสอบ", position: "กรรมการ" },
          ...body,
        },
      });
    // Ids that are not the postcode's are refused.
    const wrong = await failure(apply({ headOffice: { ...headOffice, postcode: "50200" } }));
    expect(wrong?.status).toBe(422);
    const { data: company } = await apply({});
    expect(company).toMatchObject({ status: "applied", myRoles: ["company_admin"] });
    expect(company!.missingKyc).toEqual(["company_certificate", "signatory_id"]);
    expect(company!.branches[0]).toMatchObject({ branchCode: "00000", provinceNameTh: "กรุงเทพมหานคร" });
    const companyId = company!.id;
    const submit = () =>
      api.POST("/v1/store/companies/{companyId}/actions/submit-kyc", { params: { path: { companyId } } });
    expect((await failure(submit()))?.code).toBe("companies.kyc_incomplete");
    for (const docType of ["company_certificate", "signatory_id"] as const) {
      const { data: presigned } = await api.POST("/v1/store/files/presign", {
        body: { fileName: `${docType}.pdf`, mimeType: "application/pdf", sizeBytes: 1000, purpose: "evidence" },
      });
      await api.POST("/v1/store/companies/{companyId}/kyc-documents", {
        params: { path: { companyId } },
        body: { docType, fileId: presigned!.fileId, issuedOn: docType === "company_certificate" ? "2026-09-01" : null },
      });
    }
    const { data: submitted } = await submit();
    expect(submitted).toMatchObject({ status: "kyc_review", missingKyc: [] });
  });

  it("checks bulk reorder rows before anything reaches the cart (D-153)", async () => {
    const { data: groups } = await createApiClient({ baseUrl: "http://api.mock", accessToken: admin.token }).GET(
      "/v1/store/order-groups",
    );
    const code = groups!.data[0]!.orders[0]!.orderCode;
    const { api, company } = await membership(admin);
    const { data: preview } = await api.POST("/v1/store/companies/{companyId}/bulk-reorders/actions/preview", {
      params: { path: { companyId: company.id } },
      body: {
        rows: [
          { line: 1, orderCode: code, quantity: 2000 },
          { line: 2, orderCode: "PK-0000-00000", quantity: 1000 },
          { line: 3, orderCode: code, quantity: 10 },
        ],
      },
    });
    expect(preview!.okCount).toBe(1);
    expect(preview!.rows.map((row) => row.status)).toEqual(["ok", "refused", "refused"]);
    expect(preview!.rows[1]!.reason).toBe("orders.not_found");
    const { data: added } = await api.POST("/v1/store/companies/{companyId}/bulk-reorders", {
      params: { path: { companyId: company.id }, header: { "Idempotency-Key": uuid() } },
      body: { previewToken: preview!.previewToken! },
    });
    expect(added!.added).toHaveLength(1);

    // The last Company Admin keeps the role (409 `companies.last_admin`).
    const self = company.members.find((member) => member.roles.includes("company_admin"))!;
    const demote = await failure(
      api.PUT("/v1/store/companies/{companyId}/members/{memberId}/roles", {
        params: { path: { companyId: company.id, memberId: self.id } },
        body: { roles: ["company_buyer"] },
      }),
    );
    expect(demote?.code).toBe("companies.last_admin");
  });
});
