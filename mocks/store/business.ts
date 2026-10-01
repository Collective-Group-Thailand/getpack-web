/**
 * Packio for business, mocked at the published paths (`store.companies.*`, `store.companyAssets.*`,
 * `store.companyApprovals.*`, `store.companyCredit.*`, the bulk reorder of `store.claims.*`).
 *
 * Companies are the back office's rows (`../admin/companies`, F2 2.7): a sign-up here waits on
 * the KYC desk, and the members, branches and statements are the desk's. Two personas belong to
 * the first fake company (B2601): `companyadmin` (admin and approver) and `companybuyer` (buyer). The
 * company's orders are its customer's (`ownerIndex` 1). Checkout asks this mock about a member's
 * company (`setCheckoutCompany`) for the PO rule, the approval threshold and credit.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { baht, orders, satang } from "../admin/commerce";
import {
  companyStores,
  presentCompany,
  registerCompany,
  toCompanyBranchDto,
  toCreditEligibilityDto,
  type CompanyStore,
} from "../admin/companies";
import { files } from "../admin/platform";
import { bangkokIso, mockId, precondition, problem, versionTag, withEtag } from "../support";
import { placeChecked, price, setApprovalRequester, setCheckoutCompany } from "./checkout";
import {
  customerByPersona,
  customerOf,
  MOCK_CUSTOMER_PHONES,
  type CustomerPersona,
  type MockCustomer,
} from "./customers";
import { areaOfIds } from "./catalog";
import { addReorderToCart, reorderOf } from "./fulfilment";
import type { CompanyApproval, Input, StoreCompany } from "./model";
import { ordersOf } from "./orders";

type Company = StoreCompany;
type Approval = CompanyApproval;
type BrandAsset = Schemas["CompanyAssetDto"];
type Member = CompanyStore["members"][number];
type Role = Member["roles"][number];

const DAY = 24 * 60;
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
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
        fileId: mockId("fil", 9901),
        fileName: "logo-primary.ai",
        mimeType: "application/postscript",
        sizeBytes: 482_000,
        url: "https://files.example.invalid/logo-primary.ai",
        addedBy: { id: companyStores[0]!.members[0]!.id, displayName: companyStores[0]!.members[0]!.user.displayName },
        addedAt: bangkokIso(-40 * DAY),
      },
    ],
  ],
]);

/** What a sign-up gives that the back office's rows have no column for. */
const applicantDetails = new Map<
  string,
  { signatory: Schemas["CompanySignatoryDto"] | null; contactPhone: string | null; tradeName: string | null }
>();

/** D-120: the documents a company must have on file (not rejected) before review. */
function missingKycOf(store: CompanyStore): Schemas["CompanyKycDocType"][] {
  const have = new Set<string>(
    store.kyc.filter((document) => document.status !== "rejected").map((document) => document.docType),
  );
  const required: Schemas["CompanyKycDocType"][] = [
    "company_certificate",
    "signatory_id",
    ...(store.company.isVatRegistered ? (["vat_registration_pp20"] as const) : []),
  ];
  return required.filter((docType) => !have.has(docType));
}

/* ---------------------------------------------------------------------------- checkout link */

setCheckoutCompany(
  (customer) => {
    const found = membershipOf(customer);
    if (!found || found.store.company.status !== "active") return null;
    const presented = presentCompany(found.store);
    const branch =
      found.store.branches.find((candidate) => candidate.branchType === "head_office") ?? found.store.branches[0]!;
    return {
      companyId: presented.id,
      branchId: branch.id,
      creditStatus: presented.creditStatus,
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

const bulkPreviews = new Map<
  string,
  { persona: string; rows: { orderId: string; quantity: number; line: number; orderCode: string }[] }
>();

/** `CompanyCreditDto` from the back office's row and the application waiting, if any. */
function creditOf(store: CompanyStore): Schemas["CompanyCreditDto"] {
  const presented = presentCompany(store);
  const application = applications.get(presented.id);
  return {
    creditStatus: presented.creditStatus,
    limitAmount: presented.credit.limitAmount,
    availableAmount: presented.credit.availableAmount,
    exposureAmount: presented.receivables.openAmount,
    termDays: presented.credit.termDays,
    currency: "THB",
    eligibility: toCreditEligibilityDto(store),
    pendingRequest:
      application?.status === "submitted"
        ? {
            limitAmount: application.requestedLimit,
            termDays: application.termDays,
            requestedAt: application.submittedAt,
          }
        : null,
  };
}

/* --------------------------------------------------------------------- the published company */

/** What a member's roles allow, as the API answers `can` (D-140; brand assets D-227). */
function capabilitiesOf(member: Member | undefined): Schemas["CompanyCapabilitiesDto"] {
  const has = (...wanted: Role[]) => wanted.some((role) => member?.roles.includes(role) ?? false);
  return {
    order: has("company_admin", "company_buyer", "company_approver"),
    approveOrders: has("company_approver"),
    manageMembers: has("company_admin"),
    manageSettings: has("company_admin"),
    manageAssets: has("company_admin"),
    viewFinance: has("company_admin", "company_accountant"),
  };
}

/**
 * A company as the published contract has it (`CompanyDto`), from the back office's row; `me` is
 * the caller's membership, whose roles `myRoles` and `can` answer.
 */
export function toCompanyDto(store: CompanyStore, me?: Member): Schemas["CompanyDto"] {
  const presented = presentCompany(store);
  return {
    id: presented.id,
    companyCode: presented.companyCode,
    legalName: presented.legalName,
    tradeName: applicantDetails.get(presented.id)?.tradeName ?? null,
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
    branches: store.branches.map(toCompanyBranchDto),
    kycDocuments: store.kyc.map((document) => ({
      id: document.id,
      docType: document.docType,
      fileId: document.file.id,
      issuedOn: document.issuedOn,
      note: document.note,
      status: document.status,
    })),
    missingKyc: missingKycOf(store),
    discountPct: presented.discount?.pct ?? null,
    // The rows keep no contact phone or signatory; a storefront sign-up's are kept beside them.
    contactPhone: applicantDetails.get(presented.id)?.contactPhone ?? null,
    signatory: applicantDetails.get(presented.id)?.signatory ?? null,
    myRoles: me?.roles ?? [],
    can: capabilitiesOf(me),
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
    // Each priced cart item is one order of the group.
    ordersCount: view.items.length,
    branchName: view.branch,
    threshold: view.threshold,
    expiresAt: view.expiresAt,
    decidedAt: view.decidedAt,
    decidedBy: view.decidedBy,
    decisionComment: view.reason,
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
    const mine = membershipOf(customer);
    return HttpResponse.json(
      companiesOf(customer).map((store) => toCompanyDto(store, store === mine?.store ? mine.member : undefined)),
    );
  }),

  // store.companies.apply (D-120, D-121): the company and its head office, with me as its admin;
  // it waits as `applied` until its KYC documents are in and submitted.
  http.post("*/v1/store/companies", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (membershipOf(customer)) return problem(409, "companies.already_member", "บัญชีนี้อยู่ในบริษัทแล้ว");
    const body = (await request.json().catch(() => null)) as Schemas["ApplyCompanyDto"] | null;
    if (!body?.legalName?.trim() || !/^\d{13}$/.test(body.taxId ?? ""))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "taxId", code: "taxId", message: "not a valid Thai tax id" },
      ]);
    if (companyStores.some((store) => store.company.taxId === body.taxId && store.company.status !== "closed"))
      return problem(
        409,
        "companies.tax_id_taken",
        "เลขประจำตัวผู้เสียภาษีนี้มีบัญชีบริษัทแล้ว ขอให้ผู้ดูแลบริษัทเชิญคุณเข้าร่วม",
      );
    const office = body.headOffice;
    const area = areaOfIds(office.postcode, office.provinceId, office.subdistrictId);
    if (!area)
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "headOffice.postcode", code: "invalid", message: "does not match the subdistrict" },
      ]);
    const store = registerCompany({
      legalName: body.legalName.trim(),
      taxId: body.taxId,
      isVatRegistered: body.isVatRegistered,
      address: [office.line1, office.line2, area.province, office.postcode].filter(Boolean).join(" "),
      applicant: { id: customer.id, displayName: customer.displayName, email: customer.email, phone: customer.phone },
      documents: [],
    });
    // The API's sign-up starts `applied` with its applicant as Company Admin only.
    store.company.status = "applied";
    store.members[0]!.roles = ["company_admin"];
    applicantDetails.set(store.company.id, {
      signatory: body.signatory ? { name: body.signatory.name.trim(), position: body.signatory.position.trim() } : null,
      contactPhone: body.contactPhone ?? null,
      tradeName: body.tradeName?.trim() || null,
    });
    memberships.set(customer.persona, { companyId: store.company.id, memberId: store.members[0]!.id });
    return HttpResponse.json(toCompanyDto(store, store.members[0]!), { status: 201 });
  }),

  http.post("*/v1/store/companies/:companyId/kyc-documents", async ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const { company } = found.store;
    if (!["applied", "kyc_review", "active"].includes(company.status))
      return problem(409, "companies.invalid_status", "สถานะบัญชีบริษัทนี้แนบเอกสารไม่ได้");
    const body = (await request.json().catch(() => null)) as Schemas["AddCompanyKycDocumentDto"] | null;
    const file = body?.fileId ? files.get(body.fileId) : undefined;
    // The back office's rows hold the four named document types only.
    if (!body || !file || body.docType === "other")
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "fileId", code: "fileReady", message: "not an uploaded file of yours" },
      ]);
    const docType = body.docType;
    found.store.kyc.push({
      id: mockId("ckd", 5000 + found.store.kyc.length + companyStores.indexOf(found.store) * 100),
      docType,
      status: "pending",
      file: {
        id: body.fileId,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        thumbnailUrl: null,
        url: null,
      },
      issuedOn: body.issuedOn ?? null,
      note: null,
      reviewedBy: null,
      reviewedAt: null,
      uploadedAt: bangkokIso(),
    });
    company.updatedAt = bangkokIso();
    return HttpResponse.json(toCompanyDto(found.store, found.member), { status: 201 });
  }),

  http.post("*/v1/store/companies/:companyId/actions/submit-kyc", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const { company } = found.store;
    if (company.status !== "applied") return problem(409, "companies.invalid_status", "ใบสมัครนี้ส่งตรวจแล้ว");
    const missing: string[] = missingKycOf(found.store);
    if (!applicantDetails.get(company.id)?.signatory) missing.push("signatory details");
    if (missing.length > 0) return problem(409, "companies.kyc_incomplete", `เอกสารยังไม่ครบ: ${missing.join(", ")}`);
    company.status = "kyc_review";
    company.updatedAt = bangkokIso();
    return HttpResponse.json(toCompanyDto(found.store, found.member));
  }),

  http.post("*/v1/store/companies/:companyId/branches", async ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const body = (await request.json().catch(() => null)) as Schemas["CompanyBranchInputDto"] | null;
    if (!body?.name?.trim() || body.branchType === "head_office" || !/^\d{5}$/.test(body.branchCode ?? ""))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "branchCode", code: "pattern", message: "five digits; the head office exists already" },
      ]);
    if (found.store.branches.some((branch) => branch.branchCode === body.branchCode))
      return problem(409, "companies.branch_exists", "มีสาขาเลขนี้แล้ว");
    const area = areaOfIds(body.postcode, body.provinceId, body.subdistrictId);
    if (!area)
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "postcode", code: "invalid", message: "does not match the subdistrict" },
      ]);
    found.store.branches.push({
      id: mockId("cbr", 5000 + found.store.branches.length + companyStores.indexOf(found.store) * 100),
      branchType: "branch",
      branchCode: body.branchCode!,
      name: body.name.trim(),
      address: [body.line1, body.line2, area.province, body.postcode].filter(Boolean).join(" "),
    });
    found.store.company.updatedAt = bangkokIso();
    return HttpResponse.json(toCompanyDto(found.store, found.member), { status: 201 });
  }),

  http.get("*/v1/store/companies/:companyId", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    return found instanceof Response
      ? found
      : withEtag(toCompanyDto(found.store, found.member), companyTag(found.store));
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
    return withEtag(toCompanyDto(found.store, found.member), companyTag(found.store));
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
    return HttpResponse.json(toCompanyDto(found.store, found.member), { status: 201 });
  }),

  // store.companies.changeMemberRoles: the roles replace the member's; the last admin keeps the role.
  http.put("*/v1/store/companies/:companyId/members/:memberId/roles", async ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const body = (await request.json().catch(() => null)) as Schemas["ChangeMemberRolesDto"] | null;
    if (!body?.roles?.length)
      return problem(422, "validation.failed", "เลือกบทบาทอย่างน้อยหนึ่งบทบาท", [
        { path: "roles", code: "min", message: "1" },
      ]);
    const member = found.store.members.find(
      (candidate) => candidate.id === params.memberId && candidate.status !== "removed",
    );
    if (!member) return problem(404, "http.not_found", "ไม่พบสมาชิกนี้");
    const admins = found.store.members.filter(
      (candidate) => candidate.status === "active" && candidate.roles.includes("company_admin"),
    );
    if (member.roles.includes("company_admin") && !body.roles.includes("company_admin") && admins.length === 1)
      return problem(409, "companies.last_admin", "ต้องมีผู้ดูแลบริษัทอย่างน้อยหนึ่งคน");
    member.roles = body.roles;
    return HttpResponse.json(toCompanyDto(found.store, found.member));
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
    return HttpResponse.json(toCompanyDto(found.store, found.member));
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
    return HttpResponse.json(toCompanyDto(found.store, found.member));
  }),

  // store.companyAssets.list (D-227): every member sees them, with signed URLs.
  http.get("*/v1/store/companies/:companyId/brand-assets", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    return found instanceof Response ? found : HttpResponse.json(assets.get(found.store.company.id) ?? []);
  }),

  // store.companyAssets.add: Company Admin only (D-227); 409 when the file is in the library already.
  http.post("*/v1/store/companies/:companyId/brand-assets", async ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const body = (await request.json().catch(() => null)) as Schemas["AddCompanyAssetDto"] | null;
    if (!body?.fileId || !body.name?.trim()) return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง");
    const list = assets.get(found.store.company.id) ?? [];
    if (list.some((asset) => asset.fileId === body.fileId))
      return problem(409, "companies.asset_exists", "ไฟล์นี้อยู่ในคลังแล้ว");
    const file = files.get(body.fileId);
    const asset: BrandAsset = {
      id: mockId("bas", 100 + list.length + companyStores.indexOf(found.store) * 100),
      kind: body.kind,
      name: body.name,
      fileId: body.fileId,
      fileName: file?.originalName ?? body.name,
      mimeType: file?.mimeType ?? "application/octet-stream",
      sizeBytes: file?.sizeBytes ?? 0,
      url: `data:text/plain;charset=utf-8,${encodeURIComponent(`${file?.originalName ?? body.name} (ข้อมูลจำลอง)`)}`,
      addedBy: { id: found.member.id, displayName: found.member.user.displayName },
      addedAt: bangkokIso(),
    };
    assets.set(found.store.company.id, [asset, ...list]);
    return HttpResponse.json(asset, { status: 201 });
  }),

  // store.companyAssets.remove: Company Admin only; the file itself is kept.
  http.delete("*/v1/store/companies/:companyId/brand-assets/:assetId", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const list = assets.get(found.store.company.id) ?? [];
    if (!list.some((asset) => asset.id === params.assetId)) return problem(404, "http.not_found", "ไม่พบไฟล์นี้");
    assets.set(
      found.store.company.id,
      list.filter((asset) => asset.id !== params.assetId),
    );
    return new HttpResponse(null, { status: 204 });
  }),

  // store.companyApprovals.list: pending (oldest first) or the decided history (newest first).
  http.get("*/v1/store/companies/:companyId/approvals", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    const status = new URL(request.url).searchParams.get("status") ?? "pending";
    const wanted = (entry: StoredApproval) =>
      status === "all" || (status === "pending" ? entry.view.status === "pending" : entry.view.status !== "pending");
    const mine = approvals
      .filter((entry) => entry.companyId === found.store.company.id && wanted(entry))
      .filter(
        (entry) => has(found.member, "company_approver", "company_admin") || entry.requester === found.customer.persona,
      )
      .map((entry) => toApprovalDto(entry.view));
    return HttpResponse.json(status === "pending" ? mine.reverse() : mine);
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
    if (params.decision === "reject" && !body.comment?.trim())
      return problem(422, "validation.failed", "กรุณาระบุเหตุผล", [
        { path: "comment", code: "required", message: "required" },
      ]);
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

  // store.companyCredit.apply (D-121): Company Admin; one of the allowed terms; one request at a time.
  http.post("*/v1/store/companies/:companyId/credit-applications", async ({ params, request }) => {
    if (!request.headers.get("idempotency-key"))
      return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้");
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin")) return forbidden();
    const body = (await request.json().catch(() => null)) as Schemas["ApplyForCreditDto"] | null;
    if (!body || !/^\d{1,12}(\.\d{1,2})?$/.test(body.limitAmount ?? ""))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "limitAmount", code: "pattern", message: "THB" },
      ]);
    const presented = presentCompany(found.store);
    if (presented.status !== "active")
      return problem(409, "companies.invalid_status", "ขอวงเงินได้หลังบัญชีบริษัทผ่านการตรวจเอกสาร");
    const eligibility = toCreditEligibilityDto(found.store);
    const termDays = body.termDays ?? eligibility.defaultTermDays;
    if (!eligibility.allowedTermDays.includes(termDays))
      return problem(422, "validation.failed", "ระยะเวลาเครดิตไม่อยู่ในค่าที่อนุญาต", [
        { path: "termDays", code: "oneOf", message: eligibility.allowedTermDays.join(", ") },
      ]);
    const statementOnFile = found.store.kyc.some((document) => document.docType === "financial_statement");
    if (body.basis === "paid_orders" && !presented.credit.eligible)
      return problem(
        409,
        "companies.credit_not_eligible",
        "ยังไม่ครบคำสั่งซื้อที่ชำระแล้ว แนบงบการเงินเพื่อขอพิจารณาได้ (D-121)",
      );
    if (body.basis === "financial_statement" && !statementOnFile)
      return problem(409, "companies.credit_not_eligible", "กรุณาแนบงบการเงินในเอกสารของบริษัทก่อน");
    if (applications.get(presented.id)?.status === "submitted")
      return problem(409, "approval.already_pending", "มีคำขอวงเงินที่รอพิจารณาอยู่แล้ว");
    const limit = body.limitAmount.includes(".")
      ? body.limitAmount.padEnd(body.limitAmount.indexOf(".") + 3, "0")
      : `${body.limitAmount}.00`;
    applications.set(presented.id, {
      id: mockId("cca", applications.size + 1),
      status: "submitted",
      requestedLimit: limit,
      termDays,
      basis: body.basis,
      submittedAt: bangkokIso(),
      decidedAt: null,
      note: body.note || null,
      approvedLimit: null,
    });
    return HttpResponse.json(creditOf(found.store), { status: 201 });
  }),

  http.get("*/v1/store/companies/:companyId/credit", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    return found instanceof Response ? found : HttpResponse.json(creditOf(found.store));
  }),

  // store.companyCredit.receivables (D-122): aging, the next due date and the notices.
  http.get("*/v1/store/companies/:companyId/receivables", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin", "company_accountant")) return forbidden();
    const presented = presentCompany(found.store);
    const receivables = presented.receivables;
    const overdue = receivables.overdueAmount !== "0.00";
    const dto: Schemas["CompanyReceivablesDto"] = {
      asOf: bangkokIso().slice(0, 10),
      currency: "THB",
      openAmount: receivables.openAmount,
      overdueAmount: receivables.overdueAmount,
      oldestOverdueDays: overdue ? receivables.oldestOverdueDays : null,
      nextDueAt: receivables.nextDueAt ?? null,
      creditOrdersBlocked: receivables.creditOrdersBlocked,
      aging: {
        current: overdue ? "0.00" : receivables.openAmount,
        d1_30: overdue && receivables.oldestOverdueDays <= 30 ? receivables.overdueAmount : "0.00",
        d31_60:
          overdue && receivables.oldestOverdueDays > 30 && receivables.oldestOverdueDays <= 60
            ? receivables.overdueAmount
            : "0.00",
        d61_90:
          overdue && receivables.oldestOverdueDays > 60 && receivables.oldestOverdueDays <= 90
            ? receivables.overdueAmount
            : "0.00",
        over_90: overdue && receivables.oldestOverdueDays > 90 ? receivables.overdueAmount : "0.00",
      },
      notices: [
        ...(receivables.creditOrdersBlocked
          ? [{ code: "credit_blocked" as const, amount: receivables.overdueAmount, dueAt: null, groupCode: null }]
          : overdue
            ? [
                {
                  code: "overdue" as const,
                  amount: receivables.overdueAmount,
                  dueAt: receivables.nextDueAt ?? null,
                  groupCode: null,
                },
              ]
            : []),
      ],
    };
    return HttpResponse.json(dto);
  }),

  // store.companyCredit.listStatements (D-125): issued so far, newest first.
  http.get("*/v1/store/companies/:companyId/issued-statements", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin", "company_accountant")) return forbidden();
    const list: Schemas["IssuedStatementDto"][] = [...found.store.statements]
      .sort((a, b) => b.period.localeCompare(a.period))
      .map((statement) => ({
        id: statement.id,
        month: statement.period,
        openingAmount: statement.openingBalance,
        invoicedAmount: statement.invoicedAmount,
        creditedAmount: "0.00",
        paidAmount: statement.paidAmount,
        closingAmount: statement.closingBalance,
        currency: "THB",
        pdfReady: true,
        generatedAt: `${statement.period}-28T09:00:00+07:00`,
        sentAt: null,
      }));
    return HttpResponse.json(list);
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

  // store.companies.spend (D-125): Company Admin / Accountant; cancelled and waiting orders left out.
  http.get("*/v1/store/companies/:companyId/spend", ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin", "company_accountant")) return forbidden();
    const months = Number(new URL(request.url).searchParams.get("months") ?? 12);
    const since = Date.now() - months * 30 * 86_400_000;
    const rows = ordersOf(found.customer).filter(
      (order) => order.status !== "cancelled" && Date.parse(order.createdAt) >= since,
    );
    const amounts = (list: typeof rows) => {
      const gross = list.reduce((total, order) => total + satang(order.grossAmount), 0);
      const vat = list.reduce((total, order) => total + satang(order.vatAmount), 0);
      return { grossAmount: baht(gross), vatAmount: baht(vat), netAmount: baht(gross - vat), orders: list.length };
    };
    const group = <K extends string>(key: (order: (typeof rows)[number]) => K) => {
      const map = new Map<K, typeof rows>();
      for (const order of rows) map.set(key(order), [...(map.get(key(order)) ?? []), order]);
      return [...map.entries()];
    };
    const admin = found.store.members.find((member) => member.roles.includes("company_admin"))!;
    const branch = found.store.branches[0];
    const spend: Schemas["CompanySpendDto"] = {
      currency: "THB",
      from: new Date(since).toISOString().slice(0, 10),
      to: bangkokIso().slice(0, 10),
      total: amounts(rows),
      byMonth: group((order) => order.createdAt.slice(0, 7))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, list]) => ({ month, ...amounts(list) })),
      byMember: group((order) => placedBy.get(order.id) ?? admin.user.displayName).map(([name, list]) => ({
        user: {
          id: found.store.members.find((member) => member.user.displayName === name)?.id ?? admin.id,
          displayName: name,
        },
        ...amounts(list),
      })),
      byBranch: [
        {
          branchId: branch?.id ?? null,
          branchCode: branch?.branchCode ?? null,
          name: branch?.name ?? null,
          ...amounts(rows),
        },
      ],
      byProductType: group((order) => order.productType.code).map(([productTypeCode, list]) => ({
        productTypeCode,
        ...amounts(list),
      })),
    };
    return HttpResponse.json(spend);
  }),

  // store.claims.previewBulkReorder (D-153): each row priced at today's cost, or refused with a code.
  http.post("*/v1/store/companies/:companyId/bulk-reorders/actions/preview", async ({ params, request }) => {
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    if (!has(found.member, "company_admin", "company_buyer", "company_approver")) return forbidden();
    const body = (await request.json().catch(() => null)) as Schemas["BulkReorderPreviewRequestDto"] | null;
    if (!body?.rows?.length) return problem(422, "validation.failed", "ไม่มีรายการ");
    const mine = ordersOf(found.customer);
    const accepted: { orderId: string; quantity: number; line: number; orderCode: string }[] = [];
    let gross = 0;
    const rows: Schemas["BulkReorderPreviewRowDto"][] = body.rows.map((row) => {
      const order = mine.find((candidate) => candidate.orderCode === row.orderCode.trim().toUpperCase());
      const refuse = (reason: string): Schemas["BulkReorderPreviewRowDto"] => ({
        line: row.line,
        orderCode: row.orderCode,
        orderId: order?.id ?? null,
        quantity: row.quantity ?? null,
        status: "refused",
        reason,
        grossAmount: null,
        unitPrice: null,
        proofSkipped: false,
      });
      if (!order) return refuse("orders.not_found");
      if (order.status === "cancelled") return refuse("orders.reorder_unavailable");
      const quantity = row.quantity ?? order.quantity;
      if (!Number.isInteger(quantity) || quantity < 500) return refuse("validation.failed");
      const priced = reorderOf(order, quantity);
      const rowGross = priced.net + priced.vatAmount;
      gross += rowGross;
      accepted.push({ orderId: order.id, quantity, line: row.line, orderCode: order.orderCode });
      return {
        line: row.line,
        orderCode: order.orderCode,
        orderId: order.id,
        quantity,
        status: "ok",
        reason: null,
        grossAmount: baht(rowGross),
        unitPrice: priced.unitPrice.toFixed(6),
        proofSkipped: order.artworkStatus === "approved",
      };
    });
    const token = accepted.length ? `blk${Math.random().toString(36).slice(2, 12)}` : null;
    if (token) bulkPreviews.set(token, { persona: found.customer.persona, rows: accepted });
    const preview: Schemas["BulkReorderPreviewDto"] = {
      currency: "THB",
      rows,
      okCount: accepted.length,
      refusedCount: rows.length - accepted.length,
      grossAmount: baht(gross),
      previewToken: token,
      previewExpiresAt: token ? bangkokIso(30) : null,
    };
    return HttpResponse.json(preview);
  }),

  // store.claims.bulkReorder: the accepted rows into my cart; a stale token is refused.
  http.post("*/v1/store/companies/:companyId/bulk-reorders", async ({ params, request }) => {
    if (!request.headers.get("idempotency-key"))
      return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้");
    const found = companyContext(request, String(params.companyId));
    if (found instanceof Response) return found;
    const body = (await request.json().catch(() => null)) as Schemas["BulkReorderAddDto"] | null;
    const preview = body?.previewToken ? bulkPreviews.get(body.previewToken) : undefined;
    if (!preview || preview.persona !== found.customer.persona)
      return problem(409, "orders.reorder_preview_expired", "ผลตรวจหมดอายุแล้ว กรุณาตรวจไฟล์อีกครั้ง");
    bulkPreviews.delete(body!.previewToken);
    const added = preview.rows.map((row) => {
      const order = orders.find((candidate) => candidate.id === row.orderId)!;
      return {
        line: row.line,
        orderCode: row.orderCode,
        cartItemId: addReorderToCart(found.customer, order, row.quantity).cartItemId,
      };
    });
    return HttpResponse.json({ added, failed: [] } satisfies Schemas["BulkReorderResultDto"], { status: 201 });
  }),
];
