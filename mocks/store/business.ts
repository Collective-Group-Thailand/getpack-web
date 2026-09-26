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

import type { z } from "zod";

import type { brandAsset, companyApproval, storeCompany } from "@/lib/api/requests/store-business";
import type { checkoutInput } from "@/lib/api/requests/store-checkout";

import { baht, orders, satang } from "../admin/commerce";
import { companyStores, presentCompany, registerCompany, type CompanyStore } from "../admin/companies";
import { files, settingValue } from "../admin/platform";
import { mockRequest } from "../route";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { checkPreview, forgetPreview, placeChecked, price, setCheckoutCompany } from "./checkout";
import { customerByPersona, customerOf, type CustomerPersona, type MockCustomer } from "./customers";
import { addReorderToCart, reorderOf } from "./fulfilment";
import { ordersOf } from "./orders";

type Company = z.output<typeof storeCompany>;
type Approval = z.output<typeof companyApproval>;
type BrandAsset = z.output<typeof brandAsset>;
type Member = CompanyStore["members"][number];
type Role = Member["roles"][number];
type Input = z.output<typeof checkoutInput>;

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

function noticesOf(store: CompanyStore, blocked: boolean): Company["notices"] {
  const now = Date.now();
  const notices: Company["notices"] = [];
  for (const statement of store.statements) {
    if (statement.status === "paid" || !statement.dueAt) continue;
    const days = Math.floor((now - Date.parse(statement.dueAt)) / 86_400_000);
    const kind =
      statement.status === "overdue" || days > 0
        ? "overdue"
        : days === 0
          ? "due_today"
          : days >= -7
            ? "due_soon"
            : null;
    if (kind)
      notices.push({
        kind,
        statementId: statement.id,
        period: statement.period,
        amount: statement.closingBalance,
        dueAt: statement.dueAt,
        daysOverdue: Math.max(0, days),
      });
  }
  if (blocked)
    notices.unshift({
      kind: "credit_blocked",
      statementId: null,
      period: null,
      amount: store.company.receivables.overdueAmount,
      dueAt: null,
      daysOverdue: store.company.receivables.oldestOverdueDays,
    });
  return notices;
}

function toCompany(store: CompanyStore, member: Member): Company {
  const presented = presentCompany(store);
  const { allowedDays } = settingValue<{ allowedDays: number[] }>("b2b.credit_terms");
  return {
    id: presented.id,
    companyCode: presented.companyCode,
    legalName: presented.legalName,
    taxId: presented.taxId,
    status: presented.status,
    isVatRegistered: presented.isVatRegistered,
    myRoles: member.roles,
    can: {
      manageMembers: has(member, "company_admin"),
      manageSettings: has(member, "company_admin"),
      approveOrders: has(member, "company_approver"),
      viewFinance: has(member, "company_admin", "company_accountant"),
      order: has(member, "company_admin", "company_buyer", "company_approver"),
    },
    poNumberPolicy: presented.poNumberPolicy,
    orderApprovalThreshold: presented.orderApprovalThreshold,
    discountPct: presented.discount?.pct ?? null,
    credit: {
      status: presented.creditStatus,
      limitAmount: presented.credit.limitAmount,
      availableAmount: presented.credit.availableAmount,
      termDays: presented.credit.termDays,
      eligible: presented.credit.eligible,
      paidOrdersCount: presented.paidOrdersCount,
      paidOrdersNeeded: settingValue<number>("b2b.credit_eligibility_paid_orders"),
      allowedTerms: allowedDays,
      application: applications.get(presented.id) ?? null,
    },
    receivables: presented.receivables,
    notices: noticesOf(store, presented.receivables.creditOrdersBlocked),
    kyc: store.kyc.map((document) => ({
      docType: document.docType,
      status: document.status,
      note: document.note,
      uploadedAt: document.uploadedAt,
    })),
    statusNote:
      presented.status === "kyc_review" || presented.status === "applied"
        ? "ทีมการเงินกำลังตรวจเอกสาร ใช้เวลาประมาณ 1–2 วันทำการ ระหว่างนี้สั่งซื้อแบบชำระก่อนได้ตามปกติ (ข้อมูลจำลอง)"
        : presented.status === "suspended"
          ? "บัญชีบริษัทถูกระงับชั่วคราว กรุณาติดต่อทีมงาน"
          : null,
  };
}

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

/* --------------------------------------------------------------------------------- handlers */

export const storeBusinessHandlers = [
  mockRequest("POST /v1/store/companies", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (membershipOf(customer)) return problem(409, "company.already_member", "บัญชีนี้อยู่ในบริษัทแล้ว");
    if (companyStores.some((store) => store.company.taxId === body.taxId))
      return problem(
        409,
        "company.exists",
        "เลขประจำตัวผู้เสียภาษีนี้มีบัญชีบริษัทแล้ว ขอให้ผู้ดูแลบริษัทเชิญคุณเข้าร่วม",
      );
    const needed = ["company_certificate", "signatory_id", ...(body.isVatRegistered ? ["vat_registration_pp20"] : [])];
    const missing = needed.filter((docType) => !body.documents.some((document) => document.docType === docType));
    if (missing.length > 0)
      return problem(
        422,
        "company.kyc_missing",
        "กรุณาแนบเอกสารให้ครบ (D-120)",
        missing.map((docType) => ({ path: `documents.${docType}`, code: "required", message: docType })),
      );
    const certificate = body.documents.find((document) => document.docType === "company_certificate");
    if (!certificate?.issuedOn || Date.parse(certificate.issuedOn) < Date.now() - 183 * 86_400_000)
      return problem(422, "company.certificate_too_old", "หนังสือรับรองบริษัทต้องออกไม่เกิน 6 เดือน (D-120)", [
        { path: "documents.company_certificate.issuedOn", code: "max_age", message: "6 months" },
      ]);
    const store = registerCompany({
      legalName: body.legalName,
      taxId: body.taxId,
      isVatRegistered: body.isVatRegistered,
      address: body.headOffice.address,
      applicant: {
        id: customer.id,
        displayName: `${body.signatory.name} (${body.signatory.position})`,
        email: customer.email,
        phone: body.contactPhone,
      },
      documents: body.documents.map((document) => {
        const file = files.get(document.fileId);
        return {
          docType: document.docType,
          issuedOn: document.issuedOn ?? null,
          file: {
            id: document.fileId,
            originalName: file?.originalName ?? `${document.docType}.pdf`,
            mimeType: file?.mimeType ?? "application/pdf",
            sizeBytes: file?.sizeBytes ?? 0,
            thumbnailUrl: null,
            url: null,
          },
        };
      }),
    });
    memberships.set(customer.persona, { companyId: store.company.id, memberId: store.members[0]!.id });
    return toCompany(store, store.members[0]!);
  }),

  mockRequest("GET /v1/store/me/company", ({ request }) => {
    const found = context(request);
    return found instanceof Response ? found : toCompany(found.store, found.member);
  }),

  mockRequest("PATCH /v1/store/me/company", ({ body, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const { company } = found.store;
    if (body.orderApprovalThreshold !== undefined) company.orderApprovalThreshold = body.orderApprovalThreshold;
    if (body.poNumberPolicy) company.poNumberPolicy = body.poNumberPolicy;
    company.updatedAt = bangkokIso();
    return toCompany(found.store, found.member);
  }),

  mockRequest("GET /v1/store/me/company/members", ({ request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    return { data: found.store.members.filter((member) => member.status !== "removed") };
  }),

  mockRequest("POST /v1/store/me/company/members", ({ body, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    if (found.store.members.some((member) => member.status !== "removed" && member.user.phone === body.phone))
      return problem(409, "company.member_exists", "เบอร์นี้เป็นสมาชิกบริษัทอยู่แล้ว");
    const member: Member = {
      id: mockId("cmm", 2000 + found.store.members.length + companyStores.indexOf(found.store) * 100),
      user: {
        id: mockId("usr", 9000 + found.store.members.length),
        displayName: body.name,
        email: body.email ?? null,
        phone: body.phone,
      },
      roles: body.roles,
      status: "invited",
      joinedAt: null,
    };
    found.store.members.push(member);
    return member;
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

  mockRequest("DELETE /v1/store/me/company/members/{memberId}", ({ params, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const member = found.store.members.find(
      (candidate) => candidate.id === params.memberId && candidate.status !== "removed",
    );
    if (!member) return problem(404, "http.not_found", "ไม่พบสมาชิกนี้");
    if (member.id === found.member.id) return problem(409, "company.remove_self", "นำตัวเองออกจากบริษัทไม่ได้");
    member.status = "removed";
    return { removed: true as const };
  }),

  mockRequest("GET /v1/store/me/company/branches", ({ request }) => {
    const found = context(request);
    return found instanceof Response ? found : { data: found.store.branches };
  }),

  mockRequest("POST /v1/store/me/company/branches", ({ body, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    if (found.store.branches.some((branch) => branch.branchCode === body.branchCode))
      return problem(409, "company.branch_exists", "รหัสสาขานี้มีอยู่แล้ว");
    const branch = {
      id: mockId("cbr", 3000 + found.store.branches.length + companyStores.indexOf(found.store) * 100),
      branchType: "branch" as const,
      branchCode: body.branchCode,
      name: body.name,
      address: body.address,
    };
    found.store.branches.push(branch);
    return branch;
  }),

  mockRequest("DELETE /v1/store/me/company/branches/{branchId}", ({ params, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const branch = found.store.branches.find((candidate) => candidate.id === params.branchId);
    if (!branch) return problem(404, "http.not_found", "ไม่พบสาขานี้");
    if (branch.branchType === "head_office") return problem(409, "company.head_office", "ลบสำนักงานใหญ่ไม่ได้");
    found.store.branches.splice(found.store.branches.indexOf(branch), 1);
    return { removed: true as const };
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

  mockRequest("POST /v1/store/me/company/approvals", ({ body, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    const { previewToken, ...input } = body;
    const priced = checkPreview(found.customer, previewToken, input);
    if (priced instanceof Response) return priced;
    const company = priced.preview.company;
    if (!company?.needsApproval)
      return problem(409, "company.approval_not_needed", "คำสั่งซื้อนี้สั่งได้เลยโดยไม่ต้องอนุมัติ");
    forgetPreview(previewToken);
    const seq = approvals.length + 1;
    const view: Approval = {
      id: mockId("cap", seq),
      requestNo: `AP-2569-${String(seq).padStart(5, "0")}`,
      status: "pending",
      requestedBy: { id: found.member.id, displayName: found.member.user.displayName },
      requestedAt: bangkokIso(),
      grossAmount: priced.preview.totals.grossAmount,
      threshold: company.approvalThreshold ?? "0.00",
      poNumber: input.poNumber ?? null,
      branch: priced.preview.taxInvoice?.branch ?? null,
      items: priced.preview.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        grossAmount: item.grossAmount,
      })),
      scheduleLabel:
        priced.preview.schedule.options.find((option) => option.key === priced.preview.schedule.selectedKey)?.label ??
        "",
      note: input.note ?? null,
      decidedBy: null,
      decidedAt: null,
      reason: null,
      orders: [],
      expiresAt: bangkokIso(3 * DAY),
    };
    approvals.unshift({ view, companyId: found.store.company.id, requester: found.customer.persona, input });
    return view;
  }),

  mockRequest("GET /v1/store/me/company/approvals", ({ query, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    const mine = approvals
      .filter((entry) => entry.companyId === found.store.company.id)
      .filter(
        (entry) => has(found.member, "company_approver", "company_admin") || entry.requester === found.customer.persona,
      )
      .map((entry) => entry.view)
      .filter((view) =>
        query.status === "pending"
          ? view.status === "pending"
          : query.status === "decided"
            ? view.status !== "pending"
            : true,
      );
    return paginate(mine, { page: query.page, perPage: 20 });
  }),

  mockRequest("POST /v1/store/me/company/approvals/{approvalId}/actions/approve", ({ params, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    if (!has(found.member, "company_approver")) return forbidden();
    const entry = approvals.find(
      (candidate) => candidate.view.id === params.approvalId && candidate.companyId === found.store.company.id,
    );
    if (!entry) return problem(404, "http.not_found", "ไม่พบคำขออนุมัตินี้");
    if (entry.view.status === "approved") return entry.view;
    if (entry.view.status !== "pending") return problem(409, "approval.closed", "คำขอนี้ตัดสินไปแล้ว");
    const requester = customerByPersona(entry.requester);
    const priced = price(requester, entry.input);
    if (priced instanceof Response) return priced;
    if (baht(priced.gross) !== entry.view.grossAmount) {
      entry.view.status = "expired";
      return problem(409, "approval.repriced", "ตะกร้าของผู้ขอเปลี่ยนไปแล้ว ต้องส่งขออนุมัติใหม่");
    }
    const placed = placeChecked(requester, entry.input, priced);
    for (const order of placed.orders) placedBy.set(order.id, entry.view.requestedBy.displayName);
    entry.view.status = "approved";
    entry.view.decidedBy = { id: found.member.id, displayName: found.member.user.displayName };
    entry.view.decidedAt = bangkokIso();
    entry.view.orders = placed.orders;
    return entry.view;
  }),

  mockRequest("POST /v1/store/me/company/approvals/{approvalId}/actions/reject", ({ params, body, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    if (!has(found.member, "company_approver")) return forbidden();
    const entry = approvals.find(
      (candidate) => candidate.view.id === params.approvalId && candidate.companyId === found.store.company.id,
    );
    if (!entry) return problem(404, "http.not_found", "ไม่พบคำขออนุมัตินี้");
    if (entry.view.status !== "pending") return problem(409, "approval.closed", "คำขอนี้ตัดสินไปแล้ว");
    entry.view.status = "rejected";
    entry.view.reason = body.reason;
    entry.view.decidedBy = { id: found.member.id, displayName: found.member.user.displayName };
    entry.view.decidedAt = bangkokIso();
    return entry.view;
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
    return toCompany(found.store, found.member);
  }),

  mockRequest("GET /v1/store/me/company/statements", ({ request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin", "company_accountant")) return forbidden();
    const presented = presentCompany(found.store);
    const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    for (const statement of found.store.statements) {
      if (statement.status === "paid" || !statement.dueAt) continue;
      const days = Math.floor((Date.now() - Date.parse(statement.dueAt)) / 86_400_000);
      const amount = satang(statement.closingBalance);
      if (days <= 0) buckets.current += amount;
      else if (days <= 30) buckets.days1to30 += amount;
      else if (days <= 60) buckets.days31to60 += amount;
      else if (days <= 90) buckets.days61to90 += amount;
      else buckets.over90 += amount;
    }
    return {
      data: found.store.statements,
      aging: {
        current: baht(buckets.current),
        days1to30: baht(buckets.days1to30),
        days31to60: baht(buckets.days31to60),
        days61to90: baht(buckets.days61to90),
        over90: baht(buckets.over90),
      },
      receivables: presented.receivables,
    };
  }),

  mockRequest("POST /v1/store/me/company/statements/{statementId}/actions/download", ({ params, request }) => {
    const found = context(request);
    if (found instanceof Response) return found;
    const statement = found.store.statements.find((candidate) => candidate.id === params.statementId);
    if (!statement) return problem(404, "http.not_found", "ไม่พบใบแจ้งยอดนี้");
    return {
      url: `https://files.example.invalid/signed/statement-${statement.period}.pdf?sig=mock`,
      expiresAt: bangkokIso(15),
    };
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
