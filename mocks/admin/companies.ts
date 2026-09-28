/**
 * B2B companies, mocked (CONTRACT-REQUEST admin.companies, admin.company-credit): KYC and its
 * review (D-120), members and branches (D-125), credit — prepaid until a limit is approved by
 * the `credit_limit` policy (D-121) — receivables and the overdue block (D-122), statements.
 *
 * The companies are the commerce mock's juristic customers; the limits, terms and overdue rules
 * are read from the settings the backend reads (`b2b.credit_terms`,
 * `b2b.credit_eligibility_paid_orders`, `b2b.overdue_rules`).
 */

import type { z } from "zod";

import type {
  companyBranch,
  companyDetail,
  companyKycDocument,
  companyMember,
  companyStatement,
} from "@/lib/api/requests/admin-companies";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { baht, customers, setCompanyMembers } from "./commerce";
import { registerQueue } from "./console";
import { onApprovalDecided, openApproval, settingValue } from "./platform";
import { etagOf } from "./tables";

type Company = z.output<typeof companyDetail> & { updatedAt: string };
type Kyc = z.output<typeof companyKycDocument>;
type Member = z.output<typeof companyMember>;
type Branch = z.output<typeof companyBranch>;
type Statement = z.output<typeof companyStatement>;

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

const ACTIONS: Record<Company["status"], Company["allowedActions"]> = {
  applied: ["close"],
  kyc_review: ["approve-kyc", "return-kyc", "close"],
  active: ["suspend", "close"],
  suspended: ["reinstate", "close"],
  closed: [],
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
                basis: "financial_review",
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
        ? { pct: "3.0000", discountMemoId: mockId("dmo", 30), memoCode: "DM-2569-0030", validTo: null }
        : null,
    allowedActions: [],
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

setCompanyMembers(
  (companyId) => stores.find((store) => store.company.id === companyId)?.members.map((member) => member.user.id) ?? [],
);

/** The company as the API reports it: credit figures, D-121 eligibility, the D-122 block. */
function present(store: (typeof stores)[number], who: StaffPersona | null): Company {
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
        company.paidOrdersCount >= paidOrdersNeeded ? "paid_orders" : reviewed ? "financial_review" : "not_yet",
    },
    allowedActions: who && can(who, "companies.manage") ? ACTIONS[company.status] : [],
  };
}

function access(request: Request, companyId: string | undefined, manage = false) {
  const who = staffPersonaOf(request);
  if (!who || !can(who, manage ? "companies.manage" : "companies.read")) return forbidden();
  const store = stores.find((candidate) => candidate.company.id === companyId);
  if (companyId !== undefined && !store) return notFound();
  return { who, store: store! };
}

const withEtag = (store: (typeof stores)[number], who: StaffPersona) =>
  new Response(JSON.stringify(present(store, who)), {
    headers: { "Content-Type": "application/json", ETag: etagOf(store.company as never) },
  });

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

registerQueue("companies.manage", () => {
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
  const rows = stores.filter((store) => present(store, null).receivables.creditOrdersBlocked);
  return {
    key: "companies.overdue",
    path: "/admin/companies?creditStatus=blocked_overdue",
    count: rows.length,
    overdueCount: rows.length,
    nextDueAt: null,
  };
});

export const companyHandlers = [
  mockRequest("GET /v1/admin/companies", ({ query, request }) => {
    const ok = access(request, undefined);
    if (ok instanceof Response) return ok;
    const rows = stores
      .map((store) => present(store, ok.who))
      .filter((company) => !query.status || company.status === query.status)
      .filter((company) => !query.creditStatus || company.creditStatus === query.creditStatus)
      .filter((company) => matchesQuery(query.q, company.companyCode, company.legalName, company.taxId))
      .map((company) => ({
        id: company.id,
        companyCode: company.companyCode,
        legalName: company.legalName,
        taxId: company.taxId,
        status: company.status,
        creditStatus: company.creditStatus,
        membersCount: company.membersCount,
        paidOrdersCount: company.paidOrdersCount,
        receivables: company.receivables,
        createdAt: company.createdAt,
      }));
    return paginate(rows, query);
  }),
  mockRequest("GET /v1/admin/companies/{companyId}", ({ params, request }) => {
    const ok = access(request, params.companyId);
    if (ok instanceof Response) return ok;
    return withEtag(ok.store, ok.who);
  }),
  mockRequest("POST /v1/admin/companies/{companyId}/actions/{action}", ({ params, request }) => {
    const ok = access(request, params.companyId, true);
    if (ok instanceof Response) return ok;
    const { company } = ok.store;
    const match = request.headers.get("if-match");
    if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
    if (match !== etagOf(company as never))
      return problem(412, "http.precondition_failed", "ข้อมูลบริษัทถูกแก้ไขไปแล้ว กรุณาโหลดใหม่");
    const action = params.action as Company["allowedActions"][number];
    if (!ACTIONS[company.status].includes(action))
      return problem(409, "company.invalid_transition", "ทำรายการนี้กับบริษัทในสถานะนี้ไม่ได้");
    if (action === "approve-kyc") {
      const required = company.isVatRegistered
        ? ["company_certificate", "vat_registration_pp20", "signatory_id"]
        : ["company_certificate", "signatory_id"];
      const missing = required.filter(
        (type) => !ok.store.kyc.some((doc) => doc.docType === type && doc.status === "verified"),
      );
      if (missing.length > 0)
        return problem(409, "company.kyc_incomplete", "ต้องตรวจผ่านเอกสารที่จำเป็นครบก่อน (D-120)");
      company.kycApprovedAt = bangkokIso();
    }
    company.status = {
      "approve-kyc": "active",
      "return-kyc": "applied",
      suspend: "suspended",
      reinstate: "active",
      close: "closed",
    }[action] as Company["status"];
    company.updatedAt = bangkokIso();
    return withEtag(ok.store, ok.who);
  }),
  mockRequest("GET /v1/admin/companies/{companyId}/kyc-documents", ({ params, request }) => {
    const ok = access(request, params.companyId);
    return ok instanceof Response ? ok : ok.store.kyc;
  }),
  mockRequest(
    "POST /v1/admin/companies/{companyId}/kyc-documents/{documentId}/actions/review",
    ({ params, body, request }) => {
      const ok = access(request, params.companyId, true);
      if (ok instanceof Response) return ok;
      const doc = ok.store.kyc.find((candidate) => candidate.id === params.documentId);
      if (!doc) return problem(404, "http.not_found", "ไม่พบเอกสารนี้");
      if (body.outcome === "rejected" && !body.note?.trim())
        return problem(422, "validation.failed", "กรุณาระบุสิ่งที่ต้องแก้", [
          { path: "note", code: "required", message: "จำเป็นเมื่อไม่ผ่าน" },
        ]);
      // D-120: a company certificate must be at most 6 months old when it is reviewed.
      if (body.outcome === "verified" && doc.docType === "company_certificate" && doc.issuedOn) {
        const limit = new Date(`${today()}T00:00:00+07:00`);
        limit.setUTCMonth(limit.getUTCMonth() - 6);
        if (Date.parse(`${doc.issuedOn}T00:00:00+07:00`) < limit.getTime())
          return problem(422, "company.certificate_too_old", "หนังสือรับรองบริษัทต้องออกไม่เกิน 6 เดือน (D-120)");
      }
      Object.assign(doc, {
        status: body.outcome,
        note: body.note ?? null,
        reviewedBy: { id: ok.who.id, displayName: ok.who.displayName },
        reviewedAt: bangkokIso(),
      });
      ok.store.company.updatedAt = bangkokIso();
      return doc;
    },
  ),
  mockRequest("GET /v1/admin/companies/{companyId}/members", ({ params, request }) => {
    const ok = access(request, params.companyId);
    return ok instanceof Response ? ok : ok.store.members;
  }),
  mockRequest("GET /v1/admin/companies/{companyId}/branches", ({ params, request }) => {
    const ok = access(request, params.companyId);
    return ok instanceof Response ? ok : ok.store.branches;
  }),
  mockRequest("POST /v1/admin/companies/{companyId}/credit-limits", ({ params, body, request }) => {
    const ok = access(request, params.companyId, true);
    if (ok instanceof Response) return ok;
    const { company } = ok.store;
    if (company.status !== "active") return problem(409, "company.not_active", "ขอวงเงินได้เฉพาะบริษัทที่ใช้งานอยู่");
    const { allowedDays } = settingValue<{ allowedDays: number[] }>("b2b.credit_terms");
    if (!allowedDays.includes(body.termDays))
      return problem(422, "validation.failed", "ระยะเวลาเครดิตไม่อยู่ในค่าที่อนุญาต", [
        { path: "termDays", code: "oneOf", message: allowedDays.join(", ") },
      ]);
    const presented = present(ok.store, ok.who);
    if (!presented.credit.eligible && body.basis === "paid_orders")
      return problem(409, "company.not_eligible", "ยังไม่ครบเงื่อนไขการขอเครดิต (D-121)");
    if (company.credit.versions.some((version) => version.status === "proposed"))
      return problem(409, "company.credit_pending", "มีคำขอวงเงินที่รออนุมัติอยู่แล้ว");
    const versionNo = Math.max(0, ...company.credit.versions.map((version) => version.versionNo)) + 1;
    const opened = openApproval({
      policy: "credit_limit",
      subjectType: "company_credit_limit",
      subjectId: company.id,
      requester: ok.who,
      amount: body.limitAmount,
      payload: {
        company: `${company.companyCode} ${company.legalName}`,
        limitAmount: body.limitAmount,
        termDays: body.termDays,
        basis: body.basis,
        reason: body.reason,
      },
    });
    company.credit.versions.unshift({
      versionNo,
      limitAmount: body.limitAmount,
      termDays: body.termDays,
      status: "proposed",
      basis: body.basis,
      reason: body.reason,
      effectiveFrom: bangkokIso(),
      approvalRequestId: opened.id,
      requestedBy: { id: ok.who.id, displayName: ok.who.displayName },
      createdAt: bangkokIso(),
    });
    company.updatedAt = bangkokIso();
    return { versionNo, approvalRequestId: opened.id, status: "proposed" as const };
  }),
  mockRequest("GET /v1/admin/companies/{companyId}/statements", ({ params, request }) => {
    const ok = access(request, params.companyId);
    return ok instanceof Response ? ok : ok.store.statements;
  }),
];

/* ------------------------------------------------------------------ the storefront's side */

export type CompanyStore = (typeof stores)[number];

/** The company rows, as the storefront's business mock (F3 3.7) reads and changes them. */
export const companyStores: CompanyStore[] = stores;

/** The company with the API's figures (credit, eligibility, the D-122 block), for the storefront. */
export const presentCompany = (store: CompanyStore): Company => present(store, null);

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
      allowedActions: [],
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
