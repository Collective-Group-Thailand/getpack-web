/**
 * B2B companies on the published contract (`admin.companies.*`, `admin.companyCredit.*`,
 * `admin.receivables.companyStatement*`): KYC and its review (D-120), members and branches inline
 * on the company (D-125), credit — prepaid until a limit is approved by the `credit_limit` policy
 * (D-121) — with its versions, receivables and aging (D-122), and the issued monthly statements
 * with their PDF. The company carries an `ETag`; staff actions honour an optional `If-Match`
 * (v0.5.0).
 *
 * The companies are the commerce mock's juristic customers, kept in their own model
 * (`./company-model`) with the receivables and the credit history; the storefront's business mock
 * reads and changes the same rows. The limits, terms and
 * overdue rules are read from the settings the backend reads (`b2b.credit_terms`,
 * `b2b.credit_eligibility_paid_orders`, `b2b.overdue_rules`).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS } from "../personas";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy, versionTag } from "../support";
import { baht, customers } from "./commerce";
import type {
  CompanyBranchRow,
  CompanyKycRow,
  CompanyMemberRow,
  CompanyRow,
  CompanyStatementRow,
} from "./company-model";
import { postcodeArea, provinceRefOf } from "../store/catalog";
import { registerQueue } from "./console";
import { onApprovalDecided, openApproval, settingValue } from "./platform";

type Company = CompanyRow;
type Kyc = CompanyKycRow;
type Member = CompanyMemberRow;
type Branch = CompanyBranchRow;
type Statement = CompanyStatementRow;

const DAY = 24 * 60;
const FINANCE = PERSONAS.find((persona) => persona.key === "finance")!;
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const notFound = () => problem(404, "http.not_found", "ไม่พบบริษัทนี้");
const pdf = (n: number, name: string) => ({
  id: mockId("fil", 7000 + n),
  originalName: name,
  mimeType: "application/pdf",
  sizeBytes: 182_000 + n * 1000,
  thumbnailUrl: null,
  url: `https://files.example.invalid/${name}`,
});
const today = () => bangkokIso().slice(0, 10);
const daysAgo = (days: number) => bangkokIso(-days * DAY).slice(0, 10);

type Seed = {
  customer: number;
  status: Company["status"];
  creditStatus: Company["creditStatus"];
  paidOrders: number;
  limit: number;
  termDays: number | null;
  open: number;
  overdue: number;
  overdueDays: number;
  threshold: number | null;
};

const SEEDS: Seed[] = [
  {
    customer: 1,
    status: "active",
    creditStatus: "credit",
    paidOrders: 14,
    limit: 200000,
    termDays: 30,
    open: 84000,
    overdue: 0,
    overdueDays: 0,
    threshold: 50000,
  },
  {
    customer: 2,
    status: "active",
    creditStatus: "eligible",
    paidOrders: 4,
    limit: 0,
    termDays: null,
    open: 0,
    overdue: 0,
    overdueDays: 0,
    threshold: null,
  },
  {
    customer: 5,
    status: "kyc_review",
    creditStatus: "prepaid",
    paidOrders: 0,
    limit: 0,
    termDays: null,
    open: 0,
    overdue: 0,
    overdueDays: 0,
    threshold: null,
  },
  {
    customer: 7,
    status: "active",
    creditStatus: "blocked_overdue",
    paidOrders: 9,
    limit: 80000,
    termDays: 30,
    open: 61500,
    overdue: 38200,
    overdueDays: 12,
    threshold: 30000,
  },
  {
    customer: 10,
    status: "applied",
    creditStatus: "prepaid",
    paidOrders: 0,
    limit: 0,
    termDays: null,
    open: 0,
    overdue: 0,
    overdueDays: 0,
    threshold: null,
  },
];

/** What each status action (`admin.companies.setStatus`) moves the company from and to. */
const TRANSITIONS: Record<Schemas["CompanyAction"], { from: Company["status"][]; to: Company["status"] }> = {
  suspend: { from: ["active"], to: "suspended" },
  reactivate: { from: ["suspended"], to: "active" },
  close: { from: ["applied", "kyc_review", "active", "suspended"], to: "closed" },
};

const stores = SEEDS.map((seed, index) => {
  const customer = customers[seed.customer]!;
  const id = mockId("cmy", index + 1);
  const legalName = customer.companyName ?? customer.displayName;
  const taxId = customer.taxProfiles[0]?.taxId ?? `0105${String(570000000 + index * 4321).slice(0, 9)}`;
  const company: Company = {
    id,
    companyCode: `B${String(2601 + index)}`,
    legalName,
    taxId,
    status: seed.status,
    creditStatus: seed.creditStatus,
    membersCount: 0,
    paidOrdersCount: seed.paidOrders,
    receivables: {
      openAmount: baht(seed.open * 100),
      overdueAmount: baht(seed.overdue * 100),
      oldestOverdueDays: seed.overdueDays,
      nextDueAt: seed.open > 0 ? bangkokIso(9 * DAY) : null,
      creditOrdersBlocked: false,
    },
    createdAt: bangkokIso(-(200 - index * 30) * DAY),
    isVatRegistered: index !== 4,
    poNumberPolicy: index === 0 ? "required" : "optional",
    orderApprovalThreshold: seed.threshold === null ? null : baht(seed.threshold * 100),
    kycApprovedAt: ["active", "suspended"].includes(seed.status) ? bangkokIso(-(180 - index * 30) * DAY) : null,
    credit: {
      limitAmount: baht(seed.limit * 100),
      termDays: seed.termDays,
      availableAmount: "0.00",
      eligible: false,
      eligibleReason: "not_yet",
      versions:
        seed.limit > 0
          ? [
              {
                versionNo: 1,
                limitAmount: baht(seed.limit * 100),
                termDays: seed.termDays!,
                status: "approved",
                basis: "financial_statement",
                reason: "งบการเงินปีล่าสุดผ่านเกณฑ์ (ข้อมูลจำลอง)",
                effectiveFrom: bangkokIso(-(120 - index * 10) * DAY),
                approvalRequestId: null,
                requestedBy: { id: FINANCE.id, displayName: FINANCE.displayName },
                createdAt: bangkokIso(-(121 - index * 10) * DAY),
              },
            ]
          : [],
    },
    discount:
      index === 0
        ? {
            pct: "3.0000",
            discountMemoId: mockId("dmo", 30),
            memoCode: "DM-2569-0030",
            effectiveFrom: bangkokIso(-60 * DAY),
            validTo: null,
          }
        : null,
    statusReason: null,
    updatedAt: bangkokIso(-3 * DAY),
  };
  const members: Member[] = [
    {
      id: mockId("cmm", index * 10 + 1),
      user: { id: customer.id, displayName: customer.displayName, email: customer.email, phone: customer.phone },
      roles: ["company_admin", "company_approver"],
      status: "active",
      joinedAt: company.createdAt,
    },
    ...(index < 2
      ? [
          {
            id: mockId("cmm", index * 10 + 2),
            user: {
              id: mockId("usr", 8800 + index),
              displayName: `ฝ่ายจัดซื้อ ${legalName.split(" ")[1] ?? ""} (ข้อมูลจำลอง)`,
              email: `buyer${index + 1}@example.invalid`,
              phone: null,
            },
            roles: ["company_buyer" as const],
            status: "active" as const,
            joinedAt: bangkokIso(-(90 - index * 10) * DAY),
          },
          {
            id: mockId("cmm", index * 10 + 3),
            user: {
              id: mockId("usr", 8900 + index),
              displayName: `ฝ่ายบัญชี ${legalName.split(" ")[1] ?? ""} (ข้อมูลจำลอง)`,
              email: `ap${index + 1}@example.invalid`,
              phone: null,
            },
            roles: ["company_accountant" as const],
            status: "invited" as const,
            joinedAt: null,
          },
        ]
      : []),
  ];
  const branches: Branch[] = [
    {
      id: mockId("cbr", index * 10 + 1),
      branchType: "head_office",
      branchCode: "00000",
      name: "สำนักงานใหญ่",
      address:
        customer.taxProfiles[0]?.address ??
        `${customer.addresses[0]?.line1 ?? ""} ${customer.addresses[0]?.province ?? ""}`,
    },
    ...(index === 0
      ? [
          {
            id: mockId("cbr", index * 10 + 2),
            branchType: "branch" as const,
            branchCode: "00001",
            name: "สาขาบางนา (ข้อมูลจำลอง)",
            address: "88 ถนนบางนา-ตราด แขวงบางนา เขตบางนา กรุงเทพมหานคร 10260",
          },
        ]
      : []),
  ];
  const reviewing = seed.status === "kyc_review" || seed.status === "applied";
  const kyc: Kyc[] = (
    [
      ["company_certificate", reviewing ? (index === 2 ? 40 : 250) : 150],
      ["vat_registration_pp20", 400],
      ["signatory_id", 30],
      ...(seed.limit > 0 ? ([["financial_statement", 200]] as const) : []),
    ] as const
  ).map(([docType, age], at) => ({
    id: mockId("ckd", index * 10 + at + 1),
    docType,
    status: reviewing ? "pending" : "verified",
    file: pdf(index * 10 + at, `${docType}-${index + 1}.pdf`),
    issuedOn: daysAgo(age),
    note: null,
    reviewedBy: reviewing ? null : { id: FINANCE.id, displayName: FINANCE.displayName },
    reviewedAt: reviewing ? null : bangkokIso(-(170 - index * 30) * DAY),
    uploadedAt: bangkokIso(-(age > 60 ? 20 : age) * DAY),
  }));
  const statements: Statement[] =
    seed.limit > 0
      ? [3, 2, 1].map((back, at) => {
          const date = new Date(Date.now() + 7 * 3_600_000);
          date.setUTCDate(1);
          date.setUTCMonth(date.getUTCMonth() - back);
          const period = date.toISOString().slice(0, 7);
          const invoiced = 42000 + at * 9100 + index * 1300;
          const late = seed.overdue > 0 && back === 2;
          return {
            id: mockId("cst", index * 10 + at + 1),
            period,
            openingBalance: baht((at === 0 ? 0 : 42000 + (at - 1) * 9100) * 100),
            invoicedAmount: baht(invoiced * 100),
            paidAmount: baht((back === 1 || late ? 0 : invoiced) * 100),
            closingBalance: baht((back === 1 || late ? invoiced : 0) * 100),
            dueAt: bangkokIso(-(back - 1) * 30 * DAY + (seed.termDays ?? 30) * DAY - 30 * DAY),
            status: back === 1 ? "open" : late ? "overdue" : "paid",
            file: pdf(500 + index * 10 + at, `statement-${period}.pdf`),
            issuedAt: bangkokIso(-(back * 30 - 1) * DAY),
          };
        })
      : [];
  return { company, members, branches, kyc, statements };
});

/** The company as the API reports it: credit figures, D-121 eligibility, the D-122 block. */
function present(store: (typeof stores)[number]): Company {
  const { company } = store;
  const paidOrdersNeeded = settingValue<number>("b2b.credit_eligibility_paid_orders");
  const { blockCreditOrdersAfterDaysOverdue } = settingValue<{ blockCreditOrdersAfterDaysOverdue: number }>(
    "b2b.overdue_rules",
  );
  const blocked = company.receivables.oldestOverdueDays > blockCreditOrdersAfterDaysOverdue;
  const reviewed = store.kyc.some((doc) => doc.docType === "financial_statement" && doc.status === "verified");
  const eligible = company.paidOrdersCount >= paidOrdersNeeded || reviewed;
  const available = Math.max(0, Number(company.credit.limitAmount) - Number(company.receivables.openAmount));
  return {
    ...company,
    membersCount: store.members.filter((member) => member.status !== "removed").length,
    creditStatus:
      Number(company.credit.limitAmount) > 0
        ? blocked
          ? "blocked_overdue"
          : "credit"
        : eligible
          ? "eligible"
          : "prepaid",
    receivables: { ...company.receivables, creditOrdersBlocked: blocked },
    credit: {
      ...company.credit,
      availableAmount: baht(available * 100),
      eligible,
      eligibleReason:
        company.paidOrdersCount >= paidOrdersNeeded ? "paid_orders" : reviewed ? "financial_statement" : "not_yet",
    },
  };
}

/** The KYC documents D-120 requires: the certificate, the signatory, and the PP20 when VAT-registered. */
const requiredKyc = (company: Company): Kyc["docType"][] =>
  company.isVatRegistered
    ? ["company_certificate", "vat_registration_pp20", "signatory_id"]
    : ["company_certificate", "signatory_id"];

/** A branch, its area looked up from the postcode its one-line address ends with. */
export function toCompanyBranchDto(branch: Branch): Schemas["CompanyBranchDto"] {
  const postcode = branch.address.match(/(\d{5})\s*$/)?.[1] ?? "10110";
  const area = postcodeArea(postcode);
  const province = provinceRefOf(postcode, "");
  return {
    id: branch.id,
    branchType: branch.branchType,
    branchCode: branch.branchCode,
    name: branch.name,
    line1: branch.address,
    line2: null,
    subdistrictNameTh: null,
    subdistrictNameEn: null,
    districtNameTh: area?.district.nameTh ?? null,
    districtNameEn: area?.district.nameEn ?? null,
    provinceId: province.id,
    provinceNameTh: province.nameTh,
    provinceNameEn: province.nameEn,
    postcode,
    isDefault: branch.branchType === "head_office",
  };
}

export const toCompanyKycDocumentDto = (doc: Kyc): Schemas["CompanyKycDocumentDto"] => ({
  id: doc.id,
  docType: doc.docType,
  fileId: doc.file.id,
  issuedOn: doc.issuedOn,
  note: doc.note,
  status: doc.status,
});

/** The back office's view of a KYC document: the file and the review stamps the row keeps. */
const toAdminKycDocumentDto = (doc: Kyc): Schemas["AdminKycDocumentDto"] => ({
  ...toCompanyKycDocumentDto(doc),
  fileName: doc.file.originalName,
  fileUrl: doc.file.url,
  uploadedAt: doc.uploadedAt,
  reviewedAt: doc.reviewedAt,
  reviewedBy: doc.reviewedBy,
});

/** Whether the company may apply for credit (D-121), from the settings the backend reads. */
export function toCreditEligibilityDto(store: (typeof stores)[number]): Schemas["CreditEligibilityDto"] {
  const company = present(store);
  const { allowedDays, defaultDays } = settingValue<{ allowedDays: number[]; defaultDays: number }>("b2b.credit_terms");
  return {
    eligible: company.credit.eligible,
    reason: company.credit.eligibleReason === "not_yet" ? null : company.credit.eligibleReason,
    paidOrdersCount: company.paidOrdersCount,
    paidOrdersNeeded: settingValue<number>("b2b.credit_eligibility_paid_orders"),
    financialStatementOnFile: store.kyc.some(
      (doc) => doc.docType === "financial_statement" && ["pending", "verified"].includes(doc.status),
    ),
    allowedTermDays: allowedDays,
    defaultTermDays: defaultDays,
  };
}

/** A company as `admin.companies.*` answers it: members, branches and KYC documents inline. */
export function toAdminCompanyDto(store: (typeof stores)[number]): Schemas["AdminCompanyDto"] {
  const company = present(store);
  return {
    id: company.id,
    companyCode: company.companyCode,
    legalName: company.legalName,
    tradeName: null,
    taxId: company.taxId,
    isVatRegistered: company.isVatRegistered,
    status: company.status,
    statusReason: company.statusReason,
    creditStatus: company.creditStatus,
    documentEmail: null,
    withholdsTax: false,
    poNumberPolicy: company.poNumberPolicy,
    orderApprovalThreshold: company.orderApprovalThreshold,
    kycApprovedAt: company.kycApprovedAt,
    paidOrdersCount: company.paidOrdersCount,
    createdAt: company.createdAt,
    members: store.members.map((member) => ({
      id: member.id,
      user: {
        id: member.user.id,
        displayName: member.user.displayName,
        email: member.user.email,
        phone: member.user.phone,
      },
      roles: member.roles,
      status: member.status,
      joinedAt: member.joinedAt,
    })),
    branches: store.branches.map(toCompanyBranchDto),
    kycDocuments: store.kyc.map(toAdminKycDocumentDto),
    missingKyc: requiredKyc(company).filter(
      (type) => !store.kyc.some((doc) => doc.docType === type && ["pending", "verified"].includes(doc.status)),
    ),
    membersCount: company.membersCount,
    receivables: {
      openAmount: company.receivables.openAmount,
      overdueAmount: company.receivables.overdueAmount,
      oldestOverdueDays: company.receivables.oldestOverdueDays,
      nextDueAt: company.receivables.nextDueAt,
      creditOrdersBlocked: company.receivables.creditOrdersBlocked,
      currency: "THB",
    },
    discountPct: company.discount?.pct ?? null,
    discount: company.discount
      ? {
          discountMemoId: company.discount.discountMemoId,
          pct: company.discount.pct,
          effectiveFrom: company.discount.effectiveFrom,
          validTo: company.discount.validTo,
        }
      : null,
    // The rows keep no contact phone or signatory (the signatory's ID is a KYC file only).
    contactPhone: null,
    signatory: null,
    // A staff view: no company roles, nothing the roles allow.
    myRoles: [],
    can: {
      order: false,
      approveOrders: false,
      manageMembers: false,
      manageSettings: false,
      manageAssets: false,
      viewFinance: false,
    },
  };
}

/** The company's credit as `admin.companyCredit.*` answers it: figures, eligibility, every limit version. */
function toCompanyCreditDto(store: (typeof stores)[number]): Schemas["AdminCompanyCreditDto"] {
  const company = present(store);
  const pending = company.credit.versions.find((version) => version.status === "proposed");
  return {
    creditStatus: company.creditStatus,
    limitAmount: Number(company.credit.limitAmount) > 0 ? company.credit.limitAmount : null,
    termDays: company.credit.termDays,
    availableAmount: company.credit.availableAmount,
    exposureAmount: company.receivables.openAmount,
    currency: "THB",
    eligibility: toCreditEligibilityDto(store),
    pendingRequest: pending
      ? {
          versionNo: pending.versionNo,
          limitAmount: pending.limitAmount,
          termDays: pending.termDays,
          requestedAt: pending.createdAt,
          approvalId: pending.approvalRequestId,
        }
      : null,
    versions: company.credit.versions.map((version) => ({
      id: mockId("clv", stores.indexOf(store) * 100 + version.versionNo),
      versionNo: version.versionNo,
      limitAmount: version.limitAmount,
      termDays: version.termDays,
      basis: version.basis,
      reason: version.reason,
      status: version.status,
      effectiveFrom: version.effectiveFrom,
      requestedAt: version.createdAt,
      requestedBy: version.requestedBy,
      decidedAt: version.status === "proposed" ? null : version.effectiveFrom,
      approvalId: version.approvalRequestId,
    })),
  };
}

/** Open receivables by days past due, with the D-122 notices (`admin.companyCredit.receivables`). */
function toCompanyReceivablesDto(store: (typeof stores)[number]): Schemas["CompanyReceivablesDto"] {
  const { receivables } = present(store);
  const overdue = Number(receivables.overdueAmount);
  const days = receivables.oldestOverdueDays;
  const bucket = (from: number, to: number) => baht(overdue > 0 && days >= from && days <= to ? overdue * 100 : 0);
  const notices: Schemas["CreditNoticeDto"][] = [
    ...(overdue > 0
      ? [{ code: "overdue" as const, amount: receivables.overdueAmount, dueAt: null, groupCode: null }]
      : []),
    ...(receivables.creditOrdersBlocked
      ? [{ code: "credit_blocked" as const, amount: null, dueAt: null, groupCode: null }]
      : []),
    ...(receivables.nextDueAt && Date.parse(receivables.nextDueAt) - Date.now() < 7 * DAY * 60_000
      ? [{ code: "due_soon" as const, amount: null, dueAt: receivables.nextDueAt, groupCode: null }]
      : []),
  ];
  return {
    asOf: today(),
    openAmount: receivables.openAmount,
    overdueAmount: receivables.overdueAmount,
    oldestOverdueDays: overdue > 0 ? days : null,
    nextDueAt: receivables.nextDueAt,
    creditOrdersBlocked: receivables.creditOrdersBlocked,
    currency: "THB",
    aging: {
      current: baht((Number(receivables.openAmount) - overdue) * 100),
      d1_30: bucket(1, 30),
      d31_60: bucket(31, 60),
      d61_90: bucket(61, 90),
      over_90: bucket(91, Number.MAX_SAFE_INTEGER),
    },
    notices,
  };
}

/** The statements issued so far, newest first (`admin.companyCredit.listStatements`, at most 24). */
function toIssuedStatements(store: (typeof stores)[number]): Schemas["IssuedStatementDto"][] {
  return [...store.statements]
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 24)
    .map((statement) => ({
      id: statement.id,
      month: statement.period,
      openingAmount: statement.openingBalance,
      invoicedAmount: statement.invoicedAmount,
      creditedAmount: "0.00",
      paidAmount: statement.paidAmount,
      closingAmount: statement.closingBalance,
      currency: "THB",
      pdfReady: statement.file !== null,
      generatedAt: statement.issuedAt,
      sentAt: statement.issuedAt,
    }));
}

/**
 * One month's statement (`admin.receivables.companyStatement`). A month the fixture did not seed is
 * "generated on first request", as the API does: nothing invoiced, the balance carried over.
 */
function toCompanyStatementDto(store: (typeof stores)[number], month: string): Schemas["CompanyStatementDto"] {
  const seeded = store.statements.find((statement) => statement.period === month);
  if (seeded) {
    return {
      id: seeded.id,
      month,
      opening: seeded.openingBalance,
      invoiced: seeded.invoicedAmount,
      credited: "0.00",
      paid: seeded.paidAmount,
      closing: seeded.closingBalance,
      currency: "THB",
      pdfReady: seeded.file !== null,
    };
  }
  const before = store.statements.filter((statement) => statement.period < month).at(-1);
  const carried = before?.closingBalance ?? "0.00";
  const n = stores.indexOf(store) * 100 + (Number(month.replace("-", "")) % 10_000);
  return {
    id: mockId("cst", 5000 + n),
    month,
    opening: carried,
    invoiced: "0.00",
    credited: "0.00",
    paid: "0.00",
    closing: carried,
    currency: "THB",
    pdfReady: true,
  };
}

/** The staff persona when it holds the operation's `x-required-permissions`, and the company. */
function access(request: Request, companyId: string | undefined, permission: string) {
  const who = staffPersonaOf(request);
  if (!who || !can(who, permission)) return forbidden();
  const store = stores.find((candidate) => candidate.company.id === companyId);
  if (companyId !== undefined && !store) return notFound();
  return { who, store: store! };
}

async function reasonOf(request: Request): Promise<string | Response> {
  const body = (await request.json().catch(() => null)) as Partial<Schemas["ReasonDto"]> | null;
  const reason = body?.reason?.trim() ?? "";
  if (reason.length < 3 || reason.length > 500)
    return problem(422, "validation.failed", "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร", [
      { path: "reason", code: "min", message: "อย่างน้อย 3 ตัวอักษร" },
    ]);
  return reason;
}

const invalidStatus = () => problem(409, "companies.invalid_status", "ทำรายการนี้กับบริษัทในสถานะนี้ไม่ได้");

/** The company's `ETag`: its last change, as the API versions the aggregate. */
const etagOf = (store: (typeof stores)[number]) =>
  versionTag(store.company.id, Date.parse(store.company.updatedAt) || 0);

/** An optional `If-Match` (v0.5.0): when sent, it must name the company as it is now. */
function stale(request: Request, store: (typeof stores)[number]): Response | null {
  const match = request.headers.get("if-match");
  return match && match !== etagOf(store)
    ? problem(412, "concurrency.stale", "ข้อมูลนี้ถูกแก้ไขไปแล้ว กรุณาโหลดใหม่")
    : null;
}

const answer = (store: (typeof stores)[number]) =>
  HttpResponse.json(toAdminCompanyDto(store), { headers: { ETag: etagOf(store) } });

/** A requested limit's replay by `Idempotency-Key` (optional on `requestLimit`, v0.5.0). */
const limitReplays = new Map<string, Schemas["AdminCompanyCreditDto"]>();

onApprovalDecided("credit_limit", (approval, outcome) => {
  const store = stores.find((candidate) => candidate.company.id === approval.subjectId);
  const version = store?.company.credit.versions.find((item) => item.approvalRequestId === approval.id);
  if (!store || !version) return;
  version.status = outcome;
  if (outcome === "approved") {
    version.effectiveFrom = bangkokIso();
    store.company.credit.limitAmount = version.limitAmount;
    store.company.credit.termDays = version.termDays;
  }
  store.company.updatedAt = bangkokIso();
});

registerQueue("companies.kyc_review", () => {
  const rows = stores.filter((store) => store.company.status === "kyc_review");
  return {
    key: "companies.kyc_review",
    path: "/admin/companies?status=kyc_review",
    count: rows.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});
registerQueue("companies.read", () => {
  const rows = stores.filter((store) => present(store).receivables.creditOrdersBlocked);
  return {
    key: "companies.overdue",
    path: "/admin/companies?creditStatus=blocked_overdue",
    count: rows.length,
    overdueCount: rows.length,
    nextDueAt: null,
  };
});

const pageOf = (url: URL) => ({
  page: Number(url.searchParams.get("page") ?? 1),
  perPage: Number(url.searchParams.get("perPage") ?? 25),
});

export const companyHandlers = [
  // admin.companies.list — newest first; `status=kyc_review` is the review queue (D-120).
  http.get("*/v1/admin/companies", ({ request }) => {
    const ok = access(request, undefined, "companies.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const creditStatus = url.searchParams.get("creditStatus");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = stores
      .filter((store) => !status || store.company.status === status)
      .filter((store) => !creditStatus || present(store).creditStatus === creditStatus)
      .filter((store) => matchesQuery(q, store.company.companyCode, store.company.legalName, store.company.taxId))
      .map(toAdminCompanyDto);
    const sort = url.searchParams.get("sort") ?? "createdAt";
    const order = (url.searchParams.get("order") as "asc" | "desc" | null) ?? "desc";
    return HttpResponse.json(paginate(sortBy(rows, sort, order), pageOf(url)));
  }),

  http.get("*/v1/admin/companies/:companyId", ({ params, request }) => {
    const ok = access(request, String(params.companyId), "companies.read");
    return ok instanceof Response ? ok : answer(ok.store);
  }),

  // admin.companies.approveKyc: every required document verified → active, prepaid (D-120, D-121).
  http.post("*/v1/admin/companies/:companyId/actions/approve-kyc", ({ params, request }) => {
    const ok = access(request, String(params.companyId), "companies.kyc_review");
    if (ok instanceof Response) return ok;
    const conflict = stale(request, ok.store);
    if (conflict) return conflict;
    const { company } = ok.store;
    if (company.status !== "kyc_review") return invalidStatus();
    const missing = requiredKyc(company).filter(
      (type) => !ok.store.kyc.some((doc) => doc.docType === type && doc.status === "verified"),
    );
    if (missing.length > 0)
      return problem(409, "companies.kyc_incomplete", "ต้องตรวจผ่านเอกสารที่จำเป็นครบก่อน (D-120)");
    Object.assign(company, {
      status: "active",
      statusReason: null,
      kycApprovedAt: bangkokIso(),
      updatedAt: bangkokIso(),
    });
    return answer(ok.store);
  }),

  // admin.companies.rejectKyc: back to the applicant, who may upload again and resubmit (D-120).
  http.post("*/v1/admin/companies/:companyId/actions/reject-kyc", async ({ params, request }) => {
    const ok = access(request, String(params.companyId), "companies.kyc_review");
    if (ok instanceof Response) return ok;
    const conflict = stale(request, ok.store);
    if (conflict) return conflict;
    const reason = await reasonOf(request);
    if (reason instanceof Response) return reason;
    const { company } = ok.store;
    if (company.status !== "kyc_review") return invalidStatus();
    Object.assign(company, { status: "applied", statusReason: reason, updatedAt: bangkokIso() });
    return answer(ok.store);
  }),

  // admin.companies.setStatus: suspend | reactivate | close, with a reason; closing returns it to prepaid.
  http.post("*/v1/admin/companies/:companyId/actions/:action", async ({ params, request }) => {
    const ok = access(request, String(params.companyId), "companies.manage");
    if (ok instanceof Response) return ok;
    const conflict = stale(request, ok.store);
    if (conflict) return conflict;
    const transition = TRANSITIONS[String(params.action) as Schemas["CompanyAction"]];
    if (!transition)
      return problem(422, "validation.failed", "ไม่รู้จักรายการนี้", [
        { path: "action", code: "enum", message: "suspend | reactivate | close" },
      ]);
    const reason = await reasonOf(request);
    if (reason instanceof Response) return reason;
    const { company } = ok.store;
    if (!transition.from.includes(company.status)) return invalidStatus();
    company.status = transition.to;
    company.statusReason = transition.to === "active" ? null : reason;
    if (transition.to === "closed") {
      company.credit.limitAmount = "0.00";
      company.credit.termDays = null;
    }
    company.updatedAt = bangkokIso();
    return answer(ok.store);
  }),

  // admin.companies.reviewKycDocument — answers the whole company.
  http.post("*/v1/admin/companies/:companyId/kyc-documents/:documentId/actions/review", async ({ params, request }) => {
    const ok = access(request, String(params.companyId), "companies.kyc_review");
    if (ok instanceof Response) return ok;
    const conflict = stale(request, ok.store);
    if (conflict) return conflict;
    const doc = ok.store.kyc.find((candidate) => candidate.id === params.documentId);
    if (!doc) return problem(404, "http.not_found", "ไม่พบเอกสารนี้");
    const body = (await request.json().catch(() => null)) as Schemas["ReviewKycDocumentDto"] | null;
    if (!body || !["verified", "rejected"].includes(body.outcome))
      return problem(422, "validation.failed", "กรุณาเลือกผลการตรวจ", [
        { path: "outcome", code: "enum", message: "verified | rejected" },
      ]);
    // D-120: a company certificate older than `b2b.kyc_certificate_max_age_months` (6) cannot be verified.
    if (body.outcome === "verified" && doc.docType === "company_certificate" && doc.issuedOn) {
      const limit = new Date(`${today()}T00:00:00+07:00`);
      limit.setUTCMonth(limit.getUTCMonth() - 6);
      if (Date.parse(`${doc.issuedOn}T00:00:00+07:00`) < limit.getTime())
        return problem(422, "companies.certificate_too_old", "หนังสือรับรองบริษัทต้องออกไม่เกิน 6 เดือน (D-120)");
    }
    Object.assign(doc, {
      status: body.outcome,
      note: body.note?.trim() || null,
      reviewedBy: { id: ok.who.id, displayName: ok.who.displayName },
      reviewedAt: bangkokIso(),
    });
    ok.store.company.updatedAt = bangkokIso();
    return answer(ok.store);
  }),

  // admin.companyCredit.get
  http.get("*/v1/admin/companies/:companyId/credit", ({ params, request }) => {
    const ok = access(request, String(params.companyId), "companies.read");
    return ok instanceof Response ? ok : HttpResponse.json(toCompanyCreditDto(ok.store));
  }),

  // admin.companyCredit.requestLimit — opens a credit_limit approval, answers the credit (D-121).
  http.post("*/v1/admin/companies/:companyId/credit-limits", async ({ params, request }) => {
    const ok = access(request, String(params.companyId), "company_credit.manage");
    if (ok instanceof Response) return ok;
    const key = request.headers.get("idempotency-key");
    const replay = key ? limitReplays.get(`${ok.store.company.id} ${key}`) : undefined;
    if (replay) return HttpResponse.json(replay, { status: 201, headers: { "Idempotent-Replayed": "true" } });
    const body = (await request.json().catch(() => null)) as Schemas["RequestCreditLimitDto"] | null;
    const { allowedDays, defaultDays } = settingValue<{ allowedDays: number[]; defaultDays: number }>(
      "b2b.credit_terms",
    );
    const termDays = body?.termDays ?? defaultDays;
    const errors = [
      ...(!body?.limitAmount || !/^\d{1,12}(\.\d{1,2})?$/.test(body.limitAmount) || Number(body.limitAmount) <= 0
        ? [{ path: "limitAmount", code: "pattern", message: "จำนวนเงินไม่ถูกต้อง" }]
        : []),
      ...(!allowedDays.includes(termDays)
        ? [{ path: "termDays", code: "oneOf", message: allowedDays.join(", ") }]
        : []),
      ...(!body || !["paid_orders", "financial_statement"].includes(body.basis)
        ? [{ path: "basis", code: "enum", message: "paid_orders | financial_statement" }]
        : []),
      ...((body?.reason?.trim().length ?? 0) < 3
        ? [{ path: "reason", code: "min", message: "อย่างน้อย 3 ตัวอักษร" }]
        : []),
    ];
    if (errors.length > 0 || !body) return problem(422, "validation.failed", "ข้อมูลคำขอวงเงินไม่ถูกต้อง", errors);
    const { company } = ok.store;
    if (company.status !== "active")
      return problem(409, "companies.invalid_status", "ขอวงเงินได้เฉพาะบริษัทที่ใช้งานอยู่");
    const presented = present(ok.store);
    if (
      (body.basis === "paid_orders" && presented.credit.eligibleReason !== "paid_orders") ||
      (body.basis === "financial_statement" &&
        !ok.store.kyc.some((doc) => doc.docType === "financial_statement" && doc.status === "verified"))
    )
      return problem(409, "companies.credit_not_eligible", "ยังไม่ครบเงื่อนไขการขอเครดิต (D-121)");
    if (company.credit.versions.some((version) => version.status === "proposed"))
      return problem(409, "approval.already_pending", "มีคำขอวงเงินที่รออนุมัติอยู่แล้ว");
    const versionNo = Math.max(0, ...company.credit.versions.map((version) => version.versionNo)) + 1;
    const reason = body.reason.trim();
    const opened = openApproval({
      policy: "credit_limit",
      subjectType: "company_credit_limit",
      subjectId: company.id,
      requester: ok.who,
      amount: body.limitAmount,
      payload: {
        company: `${company.companyCode} ${company.legalName}`,
        limitAmount: body.limitAmount,
        termDays,
        basis: body.basis,
        reason,
      },
    });
    company.credit.versions.unshift({
      versionNo,
      limitAmount: body.limitAmount,
      termDays,
      status: "proposed",
      basis: body.basis,
      reason,
      effectiveFrom: bangkokIso(),
      approvalRequestId: opened.id,
      requestedBy: { id: ok.who.id, displayName: ok.who.displayName },
      createdAt: bangkokIso(),
    });
    company.updatedAt = bangkokIso();
    const credit = toCompanyCreditDto(ok.store);
    if (key) limitReplays.set(`${company.id} ${key}`, credit);
    return HttpResponse.json(credit, { status: 201 });
  }),

  // admin.companyCredit.receivables — aging and the D-122 notices.
  http.get("*/v1/admin/companies/:companyId/receivables", ({ params, request }) => {
    const ok = access(request, String(params.companyId), "companies.read");
    return ok instanceof Response ? ok : HttpResponse.json(toCompanyReceivablesDto(ok.store));
  }),

  // admin.companyCredit.listStatements — the issued months (D-125).
  http.get("*/v1/admin/companies/:companyId/issued-statements", ({ params, request }) => {
    const ok = access(request, String(params.companyId), "companies.read");
    return ok instanceof Response ? ok : HttpResponse.json(toIssuedStatements(ok.store));
  }),

  // admin.receivables.companyStatementPdf — a short-lived URL of an issued month's PDF.
  http.get("*/v1/admin/companies/:companyId/statements/:month/pdf", ({ params, request }) => {
    const ok = access(request, String(params.companyId), "receivables.read");
    if (ok instanceof Response) return ok;
    const statement = ok.store.statements.find((candidate) => candidate.period === params.month);
    if (!statement) return problem(404, "http.not_found", "ยังไม่ได้ออกใบแจ้งยอดของเดือนนี้");
    if (!statement.file) return problem(409, "file.not_ready", "ใบแจ้งยอดยังสร้างไม่เสร็จ");
    const url = `data:text/plain;charset=utf-8,${encodeURIComponent(`${ok.store.company.companyCode} ${statement.period} (ข้อมูลจำลอง)`)}`;
    return HttpResponse.json({ url, expiresAt: bangkokIso(5) } satisfies Schemas["DownloadUrlDto"]);
  }),

  // admin.receivables.companyStatement — one month per call (D-125).
  http.get("*/v1/admin/companies/:companyId/statements", ({ params, request }) => {
    const ok = access(request, String(params.companyId), "receivables.read");
    if (ok instanceof Response) return ok;
    const month = new URL(request.url).searchParams.get("month") ?? "";
    if (!/^\d{4}-\d{2}$/.test(month))
      return problem(422, "validation.failed", "กรุณาระบุเดือน (YYYY-MM)", [
        { path: "month", code: "pattern", message: "YYYY-MM" },
      ]);
    return HttpResponse.json(toCompanyStatementDto(ok.store, month));
  }),
];

/* ------------------------------------------------------------------ the storefront's side */

export type CompanyStore = (typeof stores)[number];

/** The company rows, as the storefront's business mock (F3 3.7) reads and changes them. */
export const companyStores: CompanyStore[] = stores;

/** The company with the API's figures (credit, eligibility, the D-122 block), for the storefront. */
export const presentCompany = (store: CompanyStore): Company => present(store);

let registered = 0;

/** A company that signed up on the storefront: waiting for Finance's KYC review (D-120). */
export function registerCompany(input: {
  legalName: string;
  taxId: string;
  isVatRegistered: boolean;
  address: string;
  applicant: { id: string; displayName: string; email: string | null; phone: string | null };
  documents: { docType: Kyc["docType"]; file: Kyc["file"]; issuedOn: string | null }[];
}): CompanyStore {
  registered += 1;
  const index = stores.length;
  const id = mockId("cmy", 100 + registered);
  const store: CompanyStore = {
    company: {
      id,
      companyCode: `B${String(2700 + registered)}`,
      legalName: input.legalName,
      taxId: input.taxId,
      status: "kyc_review",
      creditStatus: "prepaid",
      membersCount: 1,
      paidOrdersCount: 0,
      receivables: {
        openAmount: "0.00",
        overdueAmount: "0.00",
        oldestOverdueDays: 0,
        nextDueAt: null,
        creditOrdersBlocked: false,
      },
      createdAt: bangkokIso(),
      isVatRegistered: input.isVatRegistered,
      poNumberPolicy: "optional",
      orderApprovalThreshold: null,
      kycApprovedAt: null,
      credit: {
        limitAmount: "0.00",
        termDays: null,
        availableAmount: "0.00",
        eligible: false,
        eligibleReason: "not_yet",
        versions: [],
      },
      discount: null,
      statusReason: null,
      updatedAt: bangkokIso(),
    },
    members: [
      {
        id: mockId("cmm", 1000 + registered),
        user: input.applicant,
        roles: ["company_admin", "company_approver", "company_buyer"],
        status: "active",
        joinedAt: bangkokIso(),
      },
    ],
    branches: [
      {
        id: mockId("cbr", 1000 + registered),
        branchType: "head_office",
        branchCode: "00000",
        name: "สำนักงานใหญ่",
        address: input.address,
      },
    ],
    kyc: input.documents.map((document, at) => ({
      id: mockId("ckd", 1000 + registered * 10 + at),
      docType: document.docType,
      status: "pending",
      file: document.file,
      issuedOn: document.issuedOn,
      note: null,
      reviewedBy: null,
      reviewedAt: null,
      uploadedAt: bangkokIso(),
    })),
    statements: [],
  };
  stores.splice(index, 0, store);
  return store;
}

/** The company a customer belongs to (its member), for the finance mocks' B2B documents. */
export function companyOfCustomer(customerId: string): Company | null {
  return stores.find((store) => store.members.some((member) => member.user.id === customerId))?.company ?? null;
}
