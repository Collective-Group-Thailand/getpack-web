/**
 * Packio for business, mocked (CONTRACT-REQUEST store.companies, store.company-members,
 * store.company-branches, store.company-assets, store.company-approvals, store.company-credit,
 * store.company-spend, store.company-reorder).
 *
 * Companies are the back office's rows (`../admin/companies`, F2 2.7): a sign-up here waits on
 * the KYC desk, and the members, branches and statements are the desk's. Two personas belong to
 * the first fake company (B2601): `companyadmin` (admin and approver) and `companybuyer` (buyer). The
 * company's orders are its customer's (`ownerIndex` 1). Checkout asks this mock about a member's
 * company (`setCheckoutCompany`) for the PO rule, the approval threshold and credit.
 */

import { http, HttpResponse } from "msw";
import type { z } from "zod";

import type { brandAsset } from "@/lib/api/requests/store-business";
import type { Schemas } from "@/lib/api/types";

import { baht, orders, satang } from "../admin/commerce";
import { companyStores, presentCompany, type CompanyStore } from "../admin/companies";
import { files, settingValue } from "../admin/platform";
import { mockRequest } from "../route";
import { bangkokIso, mockId, precondition, problem, versionTag, withEtag } from "../support";
import { placeChecked, price, setApprovalRequester, setCheckoutCompany } from "./checkout";
import {
  customerByPersona,
  customerOf,
  MOCK_CUSTOMER_PHONES,
  type CustomerPersona,
  type MockCustomer,
} from "./customers";
import { addReorderToCart, reorderOf } from "./fulfilment";
import type { CompanyApproval, Input, StoreCompany } from "./model";
import { ordersOf } from "./orders";

type Company = StoreCompany;
type Approval = CompanyApproval;
type BrandAsset = z.output<typeof brandAsset>;
type Member = CompanyStore["members"][number];
type Role = Member["roles"][number];

const DAY = 24 * 60;
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const noCompany = () => problem(404, "company.not_member", "บัญชีนี้ยังไม่ได้อยู่ในบริษัทใด");
const forbidden = () => problem(403, "company.forbidden", "บทบาทของคุณในบริษัททำรายการนี้ไม่ได้");

/* ------------------------------------------------------------------------------- membership */

const memberships = new Map<string, { companyId: string; memberId: string }>([
  ["companyadmin", { companyId: companyStores[0]!.company.id, memberId: companyStores[0]!.members[0]!.id }],
  ["companybuyer", { companyId: companyStores[0]!.company.id, memberId: companyStores[0]!.members[1]!.id }],
]);

function membershipOf(customer: MockCustomer): { store: CompanyStore; member: Member } | null {
  const link = memberships.get(customer.persona);
  if (!link) return null;
  const store = companyStores.find((candidate) => candidate.company.id === link.companyId);
  const member = store?.members.find((candidate) => candidate.id === link.memberId);
  return store && member && member.status === "active" ? { store, member } : null;
}

const has = (member: Member, ...roles: Role[]) => roles.some((role) => member.roles.includes(role));

function context(request: Request) {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const found = membershipOf(customer);
  return found ? { customer, ...found } : noCompany();
}

/* ------------------------------------------------------------------------------ the company */

const applications = new Map<string, NonNullable<Company["credit"]["application"]>>();
const assets = new Map<string, BrandAsset[]>([
  [
    companyStores[0]!.company.id,
    [
      {
        id: mockId("bas", 1),
        kind: "logo",
        name: "โลโก้หลัก (ข้อมูลจำลอง)",
        file: {
          id: mockId("fil", 9901),
          originalName: "logo-primary.ai",
          mimeType: "application/postscript",
          sizeBytes: 482_000,
          thumbnailUrl: null,
          url: "https://files.example.invalid/logo-primary.ai",
        },
        uploadedBy: companyStores[0]!.members[0]!.user.displayName,
        uploadedAt: bangkokIso(-40 * DAY),
      },
    ],
  ],
]);

/* ---------------------------------------------------------------------------- checkout link */

setCheckoutCompany(
  (customer) => {
    const found = membershipOf(customer);
    if (!found || found.store.company.status !== "active") return null;
    const presented = presentCompany(found.store);
    return {
      companyCode: presented.companyCode,
      legalName: presented.legalName,
      poNumberPolicy: presented.poNumberPolicy,
      threshold: presented.orderApprovalThreshold === null ? null : satang(presented.orderApprovalThreshold),
      canApprove: has(found.member, "company_approver"),
      creditActive: ["credit", "blocked_overdue"].includes(presented.creditStatus),
      creditAvailable: satang(presented.credit.availableAmount),
      creditBlocked: presented.receivables.creditOrdersBlocked,
      termDays: presented.credit.termDays,
    };
  },
  (customer, gross) => {
    const found = membershipOf(customer);
    if (!found) return;
    const receivables = found.store.company.receivables;
    receivables.openAmount = baht(satang(receivables.openAmount) + gross);
  },
);

/* -------------------------------------------------------------------------------- approvals */

interface StoredApproval {
  view: Approval;
  companyId: string;
  requester: CustomerPersona;
  input: Input;
}
const approvals: StoredApproval[] = [];
const placedBy = new Map<string, string>();

/* ------------------------------------------------------------------------------ bulk reorder */

const bulkPreviews = new Map<string, { persona: string; rows: { orderId: string; quantity: number }[] }>();

/* --------------------------------------------------------------------- the published company */

/** A company as the published contract has it (`CompanyDto`), from the back office's row. */
export function toCompanyDto(store: CompanyStore): Schemas["CompanyDto"] {
  const presented = presentCompany(store);
  return {
    id: presented.id,
    companyCode: presented.companyCode,
    legalName: presented.legalName,
    tradeName: null,
    taxId: presented.taxId,
    isVatRegistered: presented.isVatRegistered,
    status: presented.status,
    statusReason:
      presented.status === "suspended" ? "บัญชีบริษัทถูกระงับชั่วคราว กรุณาติดต่อทีมงาน (ข้อมูลจำลอง)" : null,
    creditStatus: presented.creditStatus,
    documentEmail: null,
    withholdsTax: false,
    poNumberPolicy: presented.poNumberPolicy,
    orderApprovalThreshold: presented.orderApprovalThreshold,
    createdAt: presented.createdAt,
    members: store.members.map((member) => ({
      id: member.id,
      // A persona's membership is linked by member id; the published member names its user, who is
      // the persona's customer.
      user: { id: personaUserOf(member.id) ?? member.user.id, displayName: member.user.displayName },
      roles: member.roles,
      status: member.status,
      joinedAt: member.joinedAt,
    })),
    branches: store.branches.map((branch) => ({
      id: branch.id,
      branchType: branch.branchType,
      branchCode: branch.branchCode,
      name: branch.name,
      line1: branch.address,
      line2: null,
      postcode: branch.address.match(/(\d{5})\s*$/)?.[1] ?? "10110",
      isDefault: branch.branchType === "head_office",
    })),
    kycDocuments: store.kyc.map((document) => ({
      id: document.id,
      docType: document.docType,
      fileId: document.file.id,
      issuedOn: document.issuedOn,
      note: document.note,
      status: document.status,
    })),
    missingKyc: [],
  };
}

function personaUserOf(memberId: string): string | undefined {
  const persona = [...memberships.entries()].find(([, link]) => link.memberId === memberId)?.[0];
  return persona ? customerByPersona(persona as CustomerPersona).id : undefined;
}

/** The stores of the companies a customer belongs to, whatever their status. */
function companiesOf(customer: MockCustomer): CompanyStore[] {
  const link = memberships.get(customer.persona);
  const store = link && companyStores.find((candidate) => candidate.company.id === link.companyId);
  return store ? [store] : [];
}

/** The member's company by id — a company they are not in is a 404, like the API's. */
function companyContext(request: Request, companyId: string) {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const found = membershipOf(customer);
  return found && found.store.company.id === companyId
    ? { customer, ...found }
    : problem(404, "http.not_found", "ไม่พบบริษัทนี้");
}

const companyTag = (store: CompanyStore) => versionTag(store.company.id, Date.parse(store.company.updatedAt) || 1);

function toApprovalDto(view: Approval): Schemas["CompanyApprovalDto"] {
  return {
    id: view.id,
    status: view.status,
    groupId: view.id,
    groupCode: view.requestNo,
    poNumber: view.poNumber,
    amount: view.grossAmount,
    currency: "THB",
    requester: view.requestedBy,
    requestedAt: view.requestedAt,
  };
}

/* ---------------------------------------------------------------- approval at checkout (D-123) */

setApprovalRequester((customer, input, priced) => {
  const found = membershipOf(customer);
  if (!found) return problem(409, "companies.invalid_status", "บัญชีนี้ยังไม่ได้อยู่ในบริษัทใด");
  const company = priced.preview.company;
  const seq = approvals.length + 1;
  const view: Approval = {
    id: mockId("cap", seq),
    requestNo: `AP-2569-${String(seq).padStart(5, "0")}`,
    status: "pending",
    requestedBy: { id: found.member.id, displayName: found.member.user.displayName },
    requestedAt: bangkokIso(),
    grossAmount: priced.preview.totals.grossAmount,
    threshold: company?.approvalThreshold ?? "0.00",
    poNumber: input.poNumber ?? null,
    branch: priced.preview.taxInvoice?.branch ?? null,
    items: priced.preview.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      grossAmount: item.grossAmount,
    })),
    scheduleLabel:
      priced.preview.schedule.options.find((option) => option.key === priced.preview.schedule.selectedKey)?.label ?? "",
    note: input.note ?? null,
    decidedBy: null,
    decidedAt: null,
    reason: null,
    orders: [],
    expiresAt: bangkokIso(3 * DAY),
  };
  approvals.unshift({ view, companyId: found.store.company.id, requester: customer.persona, input });
  return { id: view.id, requestNo: view.requestNo };
});

/* --------------------------------------------------------------------------------- handlers */

export const storeBusinessHandlers = [
  // store.companies.listMine (published, U-F0.2): the companies a customer belongs to.
  http.get("*/v1/store/companies", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return HttpResponse.json(companiesOf(customer).map(toCompanyDto));
  }),

  http.get("*/v1/store/companies/:companyId", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    return found instanceof Response ? found : withEtag(toCompanyDto(found.store), companyTag(found.store));
  }),

  http.patch("*/v1/store/companies/:companyId", async ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const refused = precondition(request, companyTag(found.store));
    if (refused) return refused;
    const body = (await request.json().catch(() => ({}))) as Schemas["UpdateCompanySettingsDto"];
    const { company } = found.store;
    if (body.orderApprovalThreshold !== undefined) company.orderApprovalThreshold = body.orderApprovalThreshold;
    if (body.poNumberPolicy) company.poNumberPolicy = body.poNumberPolicy;
    company.updatedAt = bangkokIso();
    return withEtag(toCompanyDto(found.store), companyTag(found.store));
  }),

  // An invitation goes to someone who already has a Packio account, found by phone (E.164).
  http.post("*/v1/store/companies/:companyId/members", async ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const body = (await request.json().catch(() => ({}))) as Schemas["InviteMemberDto"];
    const local = body.phone?.startsWith("+66") ? `0${body.phone.slice(3)}` : body.phone;
    const persona = local ? MOCK_CUSTOMER_PHONES[local] : undefined;
    if (!persona) return problem(422, "companies.account_not_found", "ไม่พบบัญชี Packio ของเบอร์นี้");
    const invitee = customerByPersona(persona);
    if (found.store.members.some((member) => member.status !== "removed" && member.user.phone === local))
      return problem(409, "companies.already_member", "เบอร์นี้เป็นสมาชิกบริษัทอยู่แล้ว");
    found.store.members.push({
      id: mockId("cmm", 2000 + found.store.members.length + companyStores.indexOf(found.store) * 100),
      user: { id: invitee.id, displayName: invitee.displayName, email: invitee.email, phone: local! },
      roles: body.roles,
      status: "invited",
      joinedAt: null,
    });
    return HttpResponse.json(toCompanyDto(found.store), { status: 201 });
  }),

  mockRequest("PATCH /v1/store/me/company/members/{memberId}", ({ params, body, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const member = found.store.members.find(
      (candidate) => candidate.id === params.memberId && candidate.status !== "removed",
    );
    if (!member) return problem(404, "http.not_found", "ไม่พบสมาชิกนี้");
    const admins = found.store.members.filter(
      (candidate) => candidate.status === "active" && candidate.roles.includes("company_admin"),
    );
    if (member.roles.includes("company_admin") && !body.roles.includes("company_admin") && admins.length === 1)
      return problem(409, "company.last_admin", "ต้องมีผู้ดูแลบริษัทอย่างน้อยหนึ่งคน");
    member.roles = body.roles;
    return member;
  }),

  http.post("*/v1/store/companies/:companyId/members/:memberId/actions/remove", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const member = found.store.members.find(
      (candidate) => candidate.id === params.memberId && candidate.status !== "removed",
    );
    if (!member) return problem(404, "http.not_found", "ไม่พบสมาชิกนี้");
    if (member.id === found.member.id)
      return problem(409, "companies.cannot_remove_self", "นำตัวเองออกจากบริษัทไม่ได้");
    member.status = "removed";
    return HttpResponse.json(toCompanyDto(found.store));
  }),

  http.delete("*/v1/store/companies/:companyId/branches/:branchId", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const branch = found.store.branches.find((candidate) => candidate.id === params.branchId);
    if (!branch) return problem(404, "http.not_found", "ไม่พบสาขานี้");
    if (branch.branchType === "head_office")
      return problem(409, "companies.head_office_required", "ลบสำนักงานใหญ่ไม่ได้");
    found.store.branches.splice(found.store.branches.indexOf(branch), 1);
    return HttpResponse.json(toCompanyDto(found.store));
  }),

  mockRequest("GET /v1/store/me/company/brand-assets", ({ request }) => {
    const found = context(request);
    return found instanceof Response ? found : { data: assets.get(found.store.company.id) ?? [] };
  }),

  mockRequest("POST /v1/store/me/company/brand-assets", ({ body, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    const file = files.get(body.fileId);
    const list = assets.get(found.store.company.id) ?? [];
    const asset: BrandAsset = {
      id: mockId("bas", 100 + list.length + companyStores.indexOf(found.store) * 100),
      kind: body.kind,
      name: body.name,
      file: {
        id: body.fileId,
        originalName: file?.originalName ?? body.name,
        mimeType: file?.mimeType ?? "application/octet-stream",
        sizeBytes: file?.sizeBytes ?? 0,
        thumbnailUrl: null,
        url: null,
      },
      uploadedBy: found.member.user.displayName,
      uploadedAt: bangkokIso(),
    };
    assets.set(found.store.company.id, [asset, ...list]);
    return asset;
  }),

  mockRequest("DELETE /v1/store/me/company/brand-assets/{assetId}", ({ params, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    const list = assets.get(found.store.company.id) ?? [];
    if (!list.some((asset) => asset.id === params.assetId)) return problem(404, "http.not_found", "ไม่พบไฟล์นี้");
    assets.set(
      found.store.company.id,
      list.filter((asset) => asset.id !== params.assetId),
    );
    return { removed: true as const };
  }),

  // The pending ones only (the published list has no decided history).
  http.get("*/v1/store/companies/:companyId/approvals", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    const mine = approvals
      .filter((entry) => entry.companyId === found.store.company.id && entry.view.status === "pending")
      .filter(
        (entry) => has(found.member, "company_approver", "company_admin") || entry.requester === found.customer.persona,
      )
      .map((entry) => toApprovalDto(entry.view));
    return HttpResponse.json(mine);
  }),

  http.post("*/v1/store/companies/:companyId/approvals/:approvalId/actions/:decision", async ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_approver")) return forbidden();
    const entry = approvals.find(
      (candidate) => candidate.view.id === params.approvalId && candidate.companyId === found.store.company.id,
    );
    if (!entry) return problem(404, "http.not_found", "ไม่พบคำขออนุมัตินี้");
    if (entry.view.status !== "pending") return problem(409, "approval.not_pending", "คำขอนี้ตัดสินไปแล้ว");
    const body = (await request.json().catch(() => ({}))) as Schemas["CompanyApprovalDecisionDto"];
    if (params.decision === "reject") {
      entry.view.status = "rejected";
      entry.view.reason = body.comment ?? null;
    } else {
      const requester = customerByPersona(entry.requester);
      const priced = price(requester, entry.input);
      if (priced instanceof Response) return priced;
      const placed = placeChecked(requester, entry.input, priced);
      for (const order of placed.orders) placedBy.set(order.id, entry.view.requestedBy.displayName);
      entry.view.status = "approved";
      entry.view.orders = placed.orders;
    }
    entry.view.decidedBy = { id: found.member.id, displayName: found.member.user.displayName };
    entry.view.decidedAt = bangkokIso();
    return HttpResponse.json(toApprovalDto(entry.view));
  }),

  mockRequest("POST /v1/store/me/company/credit-applications", ({ body, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin", "company_accountant")) return forbidden();
    const presented = presentCompany(found.store);
    if (presented.status !== "active")
      return problem(409, "company.not_active", "ขอวงเงินได้หลังบัญชีบริษัทผ่านการตรวจเอกสาร");
    const { allowedDays } = settingValue<{ allowedDays: number[] }>("b2b.credit_terms");
    if (!allowedDays.includes(body.termDays))
      return problem(422, "validation.failed", "ระยะเวลาเครดิตไม่อยู่ในค่าที่อนุญาต", [
        { path: "termDays", code: "oneOf", message: allowedDays.join(", ") },
      ]);
    if (body.basis === "paid_orders" && !presented.credit.eligible)
      return problem(
        409,
        "company.not_eligible",
        "ยังไม่ครบ 3 คำสั่งซื้อที่ชำระแล้ว แนบงบการเงินเพื่อขอพิจารณาได้ (D-121)",
      );
    if (body.basis === "financial_review" && !body.financialStatementFileIds?.length)
      return problem(422, "validation.failed", "กรุณาแนบงบการเงิน", [
        { path: "financialStatementFileIds", code: "required", message: "required" },
      ]);
    if (applications.get(presented.id)?.status === "submitted")
      return problem(409, "company.credit_pending", "มีคำขอวงเงินที่รอพิจารณาอยู่แล้ว");
    applications.set(presented.id, {
      id: mockId("cca", applications.size + 1),
      status: "submitted",
      requestedLimit: body.requestedLimit,
      termDays: body.termDays,
      basis: body.basis,
      submittedAt: bangkokIso(),
      decidedAt: null,
      note:
        satang(body.requestedLimit) > 10_000_000
          ? "วงเงินเกิน ฿100,000 พิจารณาโดยผู้บริหาร (D-121)"
          : "ฝ่ายการเงินพิจารณา (D-121)",
      approvedLimit: null,
    });
    return applications.get(presented.id)!;
  }),

  http.get("*/v1/store/companies/:companyId/credit", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    const presented = presentCompany(found.store);
    const application = applications.get(presented.id);
    const credit: Schemas["CompanyCreditDto"] = {
      creditStatus: presented.creditStatus,
      limitAmount: presented.credit.limitAmount,
      availableAmount: presented.credit.availableAmount,
      exposureAmount: presented.receivables.openAmount,
      termDays: presented.credit.termDays,
      currency: "THB",
      pendingRequest:
        application?.status === "submitted"
          ? {
              limitAmount: application.requestedLimit,
              termDays: application.termDays,
              requestedAt: application.submittedAt,
            }
          : null,
    };
    return HttpResponse.json(credit);
  }),

  http.get("*/v1/store/companies/:companyId/statements", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin", "company_accountant")) return forbidden();
    const month = new URL(request.url).searchParams.get("month");
    const statement = found.store.statements.find((candidate) => candidate.period === month);
    if (!statement) return problem(404, "http.not_found", "ไม่มีใบแจ้งยอดของเดือนนี้");
    const dto: Schemas["CompanyStatementDto"] = {
      id: statement.id,
      month: statement.period,
      opening: statement.openingBalance,
      invoiced: statement.invoicedAmount,
      credited: "0.00",
      paid: statement.paidAmount,
      closing: statement.closingBalance,
      currency: "THB",
      pdfReady: true,
    };
    return HttpResponse.json(dto);
  }),

  http.get("*/v1/store/companies/:companyId/statements/:month/pdf", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    const statement = found.store.statements.find((candidate) => candidate.period === params.month);
    if (!statement) return problem(404, "http.not_found", "ไม่พบใบแจ้งยอดนี้");
    return HttpResponse.json({
      url: `https://files.example.invalid/signed/statement-${statement.period}.pdf?sig=mock`,
      expiresAt: bangkokIso(15),
    });
  }),

  mockRequest("GET /v1/store/me/company/spend", ({ query, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    const months = query.months ?? 12;
    const since = Date.now() - months * 30 * 86_400_000;
    const rows = ordersOf(found.customer).filter(
      (order) => order.status !== "cancelled" && Date.parse(order.createdAt) >= since,
    );
    const sum = (list: typeof rows) => list.reduce((total, order) => total + satang(order.grossAmount), 0);
    const group = <K extends string>(key: (order: (typeof rows)[number]) => K) => {
      const map = new Map<K, typeof rows>();
      for (const order of rows) map.set(key(order), [...(map.get(key(order)) ?? []), order]);
      return [...map.entries()];
    };
    const admin = found.store.members.find((member) => member.roles.includes("company_admin"))?.user.displayName ?? "-";
    return {
      months,
      total: baht(sum(rows)),
      ordersCount: rows.length,
      byMonth: group((order) => order.createdAt.slice(0, 7))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, list]) => ({ month, amount: baht(sum(list)) })),
      byMember: group((order) => placedBy.get(order.id) ?? admin).map(([name, list]) => ({
        name,
        amount: baht(sum(list)),
        orders: list.length,
      })),
      byBranch: [{ name: found.store.branches[0]?.name ?? "สำนักงานใหญ่", amount: baht(sum(rows)) }],
      byProductType: group((order) => order.productType.name).map(([name, list]) => ({
        name,
        amount: baht(sum(list)),
      })),
    };
  }),

  mockRequest("POST /v1/store/me/company/bulk-reorders/actions/preview", ({ body, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    const mine = ordersOf(found.customer);
    const accepted: { orderId: string; quantity: number }[] = [];
    let gross = 0;
    const rows = body.rows.map((row) => {
      const order = mine.find((candidate) => candidate.orderCode === row.orderCode.trim().toUpperCase());
      const fail = (message: string) => ({
        line: row.line,
        orderCode: row.orderCode,
        quantity: row.quantity,
        status: "error" as const,
        message,
        product: order?.productType.name ?? null,
        grossAmount: null,
      });
      if (!order) return fail("ไม่พบคำสั่งซื้อนี้ในบริษัท");
      if (order.status === "cancelled") return fail("คำสั่งซื้อนี้ถูกยกเลิก สั่งซ้ำไม่ได้");
      const quantity = row.quantity ?? order.quantity;
      if (!Number.isInteger(quantity) || quantity < 500) return fail("จำนวนขั้นต่ำ 500");
      const priced = reorderOf(order, quantity);
      const rowGross = priced.net + priced.vatAmount;
      gross += rowGross;
      accepted.push({ orderId: order.id, quantity });
      return {
        line: row.line,
        orderCode: order.orderCode,
        quantity,
        status: "ok" as const,
        message: null,
        product: order.productType.name,
        grossAmount: baht(rowGross),
      };
    });
    const token = `blk${Math.random().toString(36).slice(2, 12)}`;
    bulkPreviews.set(token, { persona: found.customer.persona, rows: accepted });
    return {
      rows,
      okCount: accepted.length,
      errorCount: rows.length - accepted.length,
      grossAmount: baht(gross),
      previewToken: token,
    };
  }),

  mockRequest("POST /v1/store/me/company/bulk-reorders", ({ body, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    const preview = bulkPreviews.get(body.previewToken);
    if (!preview || preview.persona !== found.customer.persona)
      return problem(409, "reorder.repriced", "ผลตรวจหมดอายุแล้ว กรุณาตรวจไฟล์อีกครั้ง");
    bulkPreviews.delete(body.previewToken);
    const ids = preview.rows.map((row) => {
      const order = orders.find((candidate) => candidate.id === row.orderId)!;
      return addReorderToCart(found.customer, order, row.quantity).cartItemId;
    });
    return { cartItemIds: ids };
  }),
];
