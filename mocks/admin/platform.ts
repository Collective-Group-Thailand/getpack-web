/**
 * Stateful mocks for the admin endpoints packio-api B1.3 **published**: users and role grants,
 * roles, approvals and delegations, the audit log, settings, feature flags, notification
 * templates and routes, the outbox, and files.
 *
 * Typed by `Schemas` — these stand in for the contract, not for a request. Reference data is
 * the backend's own seed, copied into `./fixtures` from packio-api (`prisma/seed/data/*.ts`,
 * `src/modules/iam/{roles,permissions}.catalog.ts`, 2026-09-25) so the screens meet real
 * setting keys, approval policies, roles and SoD rules. Problem codes are the ones the contract
 * documents for each operation. People and amounts are obviously fake.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";
import approvalPolicies from "./fixtures/approval-policies.json";
import permissionCatalogue from "./fixtures/permissions.json";
import roleCatalogue from "./fixtures/roles.json";
import settingSeeds from "./fixtures/settings.json";
import sodRuleSeeds from "./fixtures/sod-rules.json";

type User = Schemas["UserAdminDto"];
type Approval = Schemas["ApprovalRequestDto"];
type Setting = Schemas["SettingDetailDto"];

const LAUNCH = "2026-09-22T09:00:00+07:00";

/* ------------------------------------------------------------------------------------ roles */

export const ROLES: Schemas["RoleDto"][] = roleCatalogue.map((role) => ({
  key: role.key,
  nameTh: role.nameTh,
  nameEn: role.nameEn,
  audience: role.audience as Schemas["TokenAudience"],
  scopeType: role.scopeType as Schemas["RoleScopeType"],
  permissions: role.permissions,
}));

/** Permission keys the backend flags as sensitive (cost and margin, D-141). */
export const SENSITIVE_PERMISSIONS = new Set(["factory_cost.read", "margin.read", "margin.read_pct_when_discounting"]);
export const PERMISSION_DESCRIPTIONS = Object.fromEntries(permissionCatalogue.map((p) => [p.key, p.description]));

/** Role-pair SoD rules as the `admin.sod-rules` request shapes them. */
export const SOD_RULES = sodRuleSeeds.map((rule, index) => ({
  id: mockId("sod", index + 1),
  kind: rule.kind as "role_pair" | "action_pair",
  left:
    rule.kind === "role_pair" ? (rule as { roles: string[] }).roles[0]! : (rule as { actions: string[] }).actions[0]!,
  right:
    rule.kind === "role_pair" ? (rule as { roles: string[] }).roles[1]! : (rule as { actions: string[] }).actions[1]!,
  enforcement: "block" as const,
  description: rule.description,
  decisions: rule.decisions,
}));

/* ------------------------------------------------------------------------------------ users */

const FACTORY_ID = "00000000-0000-4000-8000-0000000000f1";

function grant(
  role: string,
  n: number,
  scope?: { type: Schemas["RoleScopeType"]; id: string },
): Schemas["RoleGrantDto"] {
  return {
    id: mockId("grant", n),
    role,
    scopeType: scope?.type ?? "platform",
    scopeId: scope?.id ?? null,
    reason: "บัญชีตั้งต้น (ข้อมูลจำลอง)",
    validFrom: LAUNCH,
    validTo: role === "auditor" ? "2026-12-31T23:59:59+07:00" : null,
  };
}

const users: User[] = [
  ...PERSONAS.map((persona, index): User => ({
    id: persona.id,
    displayName: persona.displayName,
    email: persona.email,
    phone: null,
    kind: "staff",
    status: "active",
    lastLoginAt: bangkokIso(-(index + 1) * 37),
    createdAt: LAUNCH,
    roles: persona.roles.map((role, r) => grant(role, index * 10 + r + 1)),
  })),
  {
    id: mockId("user", 101),
    displayName: "พนักงานที่พักงาน (ข้อมูลจำลอง)",
    email: "on.leave.staff@packio.invalid",
    phone: null,
    kind: "staff",
    status: "suspended",
    lastLoginAt: "2026-09-22T17:00:00+07:00",
    createdAt: LAUNCH,
    roles: [grant("cs", 900)],
  },
  {
    id: mockId("user", 102),
    displayName: "เจ้าของโรงงาน ตัวอย่าง (ข้อมูลจำลอง)",
    email: "owner@factory.invalid",
    phone: "+66810000001",
    kind: "partner",
    status: "active",
    lastLoginAt: bangkokIso(-90),
    createdAt: LAUNCH,
    roles: [grant("factory_owner", 901, { type: "factory", id: FACTORY_ID })],
  },
  {
    id: mockId("user", 103),
    displayName: "ช่างวางแผน ตัวอย่าง (ข้อมูลจำลอง)",
    email: "planner@factory.invalid",
    phone: null,
    kind: "partner",
    status: "active",
    lastLoginAt: bangkokIso(-15),
    createdAt: LAUNCH,
    roles: [grant("factory_planner", 902, { type: "factory", id: FACTORY_ID })],
  },
];

let grantSeq = 1000;

/* -------------------------------------------------------------------------------- approvals */

const ref = (persona: StaffPersona | undefined): Schemas["UserRefDto"] => ({
  id: persona?.id ?? mockId("user", 1),
  displayName: persona?.displayName ?? "—",
});
const byKey = (key: string) => PERSONAS.find((persona) => persona.key === key)!;

function steps(policyKey: string, current = 1): Schemas["ApprovalStepDto"][] {
  const policy = approvalPolicies.find((candidate) => candidate.key === policyKey)!;
  return policy.steps.slice(0, policyKey === "discount_memo" ? 1 : undefined).map((step, index) => ({
    stepNo: index + 1,
    role: step.role,
    quorum: 1,
    status: index + 1 < current ? "approved" : "pending",
    dueAt: bangkokIso(60 * (6 + index * 20)),
    completedAt: index + 1 < current ? bangkokIso(-60) : null,
  }));
}

function approval(
  n: number,
  policy: string,
  subjectType: string,
  requester: string,
  payload: Record<string, unknown>,
  extra: Partial<Approval> = {},
): Approval {
  const approvalSteps = extra.steps ?? steps(policy);
  return {
    id: mockId("appr", n),
    policy,
    subjectType,
    subjectId: mockId("subj", n),
    status: "pending",
    requester: ref(byKey(requester)),
    amount: null,
    currency: "THB",
    pct: null,
    flags: [],
    payload,
    currentStepNo: approvalSteps.find((step) => step.status === "pending")?.stepNo ?? null,
    steps: approvalSteps,
    actions: [],
    createdAt: bangkokIso(-n * 53),
    expiresAt: bangkokIso(60 * 24 * 14),
    decidedAt: null,
    ...extra,
  };
}

const approvals: Approval[] = [
  approval(
    1,
    "discount_memo",
    "discount_memo",
    "cs",
    {
      quoteCode: "QT-2569-00118",
      customerName: "บริษัท ตัวอย่างขนม จำกัด (ข้อมูลจำลอง)",
      orderValue: "86400.00",
      requestedPct: "8.0000",
      resultingMarginPct: "17.5000",
      reason: "ลูกค้าเทียบราคากับคู่แข่ง ขอส่วนลดเพื่อปิดการขาย",
    },
    {
      amount: "6912.00",
      pct: "8.0000",
      steps: [{ stepNo: 1, role: "director", quorum: 1, status: "pending", dueAt: bangkokIso(300), completedAt: null }],
    },
  ),
  approval(
    2,
    "discount_memo",
    "discount_memo",
    "cs",
    {
      quoteCode: "QT-2569-00121",
      customerName: "ร้านกาแฟตัวอย่าง (ข้อมูลจำลอง)",
      orderValue: "24500.00",
      requestedPct: "18.0000",
      resultingMarginPct: "8.2000",
      reason: "ลูกค้าประจำ สั่งซ้ำทุกเดือน",
    },
    {
      amount: "4410.00",
      pct: "18.0000",
      flags: ["below_margin_floor"],
      steps: [{ stepNo: 1, role: "c_level", quorum: 1, status: "pending", dueAt: bangkokIso(-45), completedAt: null }],
    },
  ),
  approval(
    3,
    "credit_limit",
    "company_credit_limit",
    "finance",
    {
      companyName: "บริษัท ตัวอย่างเครื่องสำอาง จำกัด (ข้อมูลจำลอง)",
      currentLimit: "0.00",
      requestedLimit: "150000.00",
      paidOrders: 4,
      termDays: 30,
    },
    { amount: "150000.00" },
  ),
  approval(
    4,
    "payout_run",
    "payout_run",
    "finance",
    { runCode: "PR-2569-09-2", factories: 1, items: 6 },
    { amount: "412880.50" },
  ),
  approval(5, "price_proposal", "price_proposal", "cs", {
    factoryName: "โรงงานพาร์ตเนอร์ ตัวอย่าง (ข้อมูลจำลอง)",
    proposalCode: "PP-2569-0007",
    lines: 12,
    maxDeviationPct: "6.4000",
  }),
  approval(
    6,
    "vendor_bank_account_change",
    "vendor_bank_account",
    "partner_manager",
    { vendorName: "โรงงานพาร์ตเนอร์ ตัวอย่าง (ข้อมูลจำลอง)", bank: "SCB", accountLast4: "4321" },
    { steps: steps("vendor_bank_account_change", 2) },
  ),
  approval(
    7,
    "refund",
    "refund",
    "cs",
    { orderCode: "PK-2569-00037", reason: "ลูกค้ายกเลิกก่อนเริ่มผลิต" },
    {
      amount: "3210.00",
      status: "approved",
      currentStepNo: null,
      decidedAt: bangkokIso(-300),
      steps: [
        {
          stepNo: 1,
          role: "finance_manager",
          quorum: 1,
          status: "approved",
          dueAt: bangkokIso(-400),
          completedAt: bangkokIso(-300),
        },
      ],
      actions: [
        {
          action: "approve",
          actor: ref(byKey("finance_manager")),
          at: bangkokIso(-300),
          comment: "ตรวจสอบสลิปแล้ว",
          stepNo: 1,
          onBehalfOf: null,
        },
      ],
    },
  ),
];

let delegations: Schemas["DelegationDto"][] = [];

export function mayDecide(item: Approval, persona: StaffPersona): boolean {
  if (item.status !== "pending") return false;
  if (item.requester.id === persona.id) return false; // maker-checker
  if (item.actions.some((action) => action.actor.id === persona.id && action.action === "approve")) return false;
  const step = item.steps.find((candidate) => candidate.stepNo === item.currentStepNo);
  if (!step) return false;
  if (persona.roles.includes(step.role)) return true;
  const now = Date.now();
  return delegations.some(
    (delegation) =>
      delegation.delegate.id === persona.id &&
      delegation.revokedAt === null &&
      Date.parse(delegation.validFrom) <= now &&
      Date.parse(delegation.validTo) > now &&
      (delegation.policy === null || delegation.policy === item.policy) &&
      byKey(PERSONAS.find((p) => p.id === delegation.delegator.id)?.key ?? "")?.roles.includes(step.role),
  );
}

/* --------------------------------------------------------------------------------- audit */

const AUDIT_ACTIONS: [Schemas["AuditCategory"], string, string | null][] = [
  ["security", "auth.login", null],
  ["security", "auth.login_failed", null],
  ["iam", "role.granted", "user"],
  ["iam", "role.revoked", "user"],
  ["config", "setting.changed", "setting"],
  ["approval", "approval.approved", "approval_request"],
  ["data_access", "factory_prices.read", "factory"],
  ["export", "export.generated", "audit_log"],
  ["finance", "refund.approved", "refund"],
  ["security", "permission.denied", null],
];

const auditLog: Schemas["AuditEntryDto"][] = Array.from({ length: 120 }, (_, index) => {
  const [category, action, resourceType] = AUDIT_ACTIONS[index % AUDIT_ACTIONS.length]!;
  const actor = PERSONAS[(index * 7) % PERSONAS.length]!;
  return {
    occurredAt: bangkokIso(-index * 41),
    category,
    action,
    outcome: action === "auth.login_failed" ? "failure" : action === "permission.denied" ? "denied" : "success",
    actor: { id: actor.id, name: actor.displayName, type: "user" },
    onBehalfOf: null,
    resourceType,
    resourceId: resourceType ? mockId(resourceType.slice(0, 3), index) : null,
    requestId: mockId("req", index),
    data: action === "setting.changed" ? { key: "discounts.cs_limit_pct", from: "5", to: "5" } : { ip: "203.0.113.10" },
  };
});

/* ------------------------------------------------------------------------------ settings */

const decisionsOf = (text: string) => [...new Set(text.match(/D-\d{3}/g) ?? [])];

const settings: Setting[] = settingSeeds.map((seed, index) => {
  const current = { versionNo: 1, effectiveFrom: LAUNCH, value: seed.value as Setting["versions"][number]["value"] };
  const scheduled =
    seed.key === "discounts.cs_limit_pct"
      ? [{ versionNo: 2, effectiveFrom: "2026-11-01T00:00:00+07:00", value: "5" }]
      : [];
  const sensitive = seed.key.startsWith("auth.");
  return {
    id: mockId("set", index + 1),
    key: seed.key,
    description: seed.description,
    valueType: seed.valueType as Schemas["SettingValueType"],
    scopeType: "platform",
    scopeId: null,
    decisionRefs: seed.decisions ?? decisionsOf(seed.description),
    confirmationStatus: ((seed as { confirmation?: string }).confirmation ??
      "confirmed") as Schemas["SettingConfirmation"],
    ownerRole: "superadmin",
    approvalPolicy: null,
    sensitive,
    masked: false,
    current,
    pending: null,
    scheduled,
    versions: [
      ...scheduled.map((version) => ({
        ...version,
        status: "approved" as const,
        reason: "ทบทวนเพดานส่วนลดตามรอบไตรมาส (ข้อมูลจำลอง)",
        createdAt: bangkokIso(-60 * 24),
        decidedAt: bangkokIso(-60 * 24),
      })),
      {
        ...current,
        status: "approved",
        reason: "ค่าตั้งต้นจาก docs/decisions.md",
        createdAt: LAUNCH,
        decidedAt: LAUNCH,
      },
    ],
  };
});

/** What this persona may see of a setting: sensitive values are masked without the permission. */
function visible(setting: Setting, persona: StaffPersona | undefined): Setting {
  if (!setting.sensitive || can(persona, "settings.read_sensitive")) return setting;
  const mask = <T extends { value: unknown }>(version: T) => ({ ...version, value: null });
  return {
    ...setting,
    masked: true,
    current: setting.current ? mask(setting.current) : null,
    scheduled: setting.scheduled.map(mask),
    pending: setting.pending ? mask(setting.pending) : null,
    versions: setting.versions.map(mask),
  };
}

const summary = ({ versions, ...rest }: Setting): Schemas["SettingDto"] => {
  void versions;
  return rest;
};

/* ------------------------------------------------------------------ flags, notifications, outbox */

const flags: Schemas["FeatureFlagDto"][] = [
  {
    key: "labelCalculator",
    description: "เมนูคำนวณราคาฉลากสำหรับ CS (ของเดิม DISPLAY_MENU_LABEL)",
    enabled: true,
    rules: {},
    updatedAt: LAUNCH,
  },
  {
    key: "cardInstalments",
    description: "ผ่อนชำระผ่านบัตร 2C2P IPP (R2, D-111)",
    enabled: false,
    rules: {},
    updatedAt: LAUNCH,
  },
  {
    key: "eTaxInvoice",
    description: "ส่ง e-Tax invoice และ e-Receipt (R2, D-091)",
    enabled: false,
    rules: {},
    updatedAt: LAUNCH,
  },
  {
    key: "configurator3d",
    description: "พรีวิว 3 มิติในหน้าคอนฟิกกล่อง (D-152)",
    enabled: true,
    rules: { audiences: ["customer", "staff"], percentage: 50 },
    updatedAt: bangkokIso(-60 * 5),
  },
];

const templates: Schemas["NotificationTemplateDto"][] = [
  {
    id: mockId("tpl", 1),
    key: "approval.requested",
    channel: "in_app",
    category: "transactional",
    description: "แจ้งผู้อนุมัติเมื่อมีคำขอรออนุมัติ",
    versions: [
      {
        locale: "th",
        versionNo: 1,
        status: "published",
        subject: null,
        body: "มีคำขอ {{policy}} รอการอนุมัติของคุณ",
        publishedAt: LAUNCH,
      },
      {
        locale: "en",
        versionNo: 1,
        status: "published",
        subject: null,
        body: "A {{policy}} request is waiting for your approval",
        publishedAt: LAUNCH,
      },
    ],
  },
  {
    id: mockId("tpl", 2),
    key: "order.paid",
    channel: "email",
    category: "transactional",
    description: "ยืนยันการชำระเงินถึงลูกค้า",
    versions: [
      {
        locale: "th",
        versionNo: 1,
        status: "published",
        subject: "ชำระเงินเรียบร้อย {{orderCode}}",
        body: "<mjml>…</mjml>",
        publishedAt: LAUNCH,
      },
      {
        locale: "th",
        versionNo: 2,
        status: "draft",
        subject: "ได้รับชำระเงินแล้ว {{orderCode}}",
        body: "<mjml>…</mjml>",
        publishedAt: null,
      },
    ],
  },
];

const routes: Schemas["NotificationRouteDto"][] = [
  {
    id: mockId("route", 1),
    eventType: "approval.requested",
    audience: "assignee",
    channel: "in_app",
    template: "approval.requested",
    staffTeam: null,
    isCritical: false,
    isMarketing: false,
    enabled: true,
  },
  {
    id: mockId("route", 2),
    eventType: "order.paid",
    audience: "customer",
    channel: "email",
    template: "order.paid",
    staffTeam: null,
    isCritical: false,
    isMarketing: false,
    enabled: true,
  },
  {
    id: mockId("route", 3),
    eventType: "slip.failed",
    audience: "staff_team",
    channel: "line",
    template: "slip.failed",
    staffTeam: "finance",
    isCritical: false,
    isMarketing: false,
    enabled: true,
  },
  {
    id: mockId("route", 4),
    eventType: "instalment.due",
    audience: "customer",
    channel: "sms",
    template: "instalment.due",
    staffTeam: null,
    isCritical: true,
    isMarketing: false,
    enabled: false,
  },
];

const outbox: Schemas["OutboxMessageDto"][] = [
  {
    eventId: mockId("evt", 1),
    type: "notification.requested",
    aggregateType: "notification",
    aggregateId: mockId("ntf", 1),
    status: "dead",
    attempts: 8,
    lastError: "LINE Messaging API 429 Too Many Requests",
    occurredAt: bangkokIso(-200),
  },
  {
    eventId: mockId("evt", 2),
    type: "approval.approved",
    aggregateType: "approval_request",
    aggregateId: mockId("appr", 7),
    status: "dispatched",
    attempts: 1,
    lastError: null,
    occurredAt: bangkokIso(-300),
  },
  {
    eventId: mockId("evt", 3),
    type: "file.uploaded",
    aggregateType: "file",
    aggregateId: mockId("file", 1),
    status: "failed",
    attempts: 2,
    lastError: "scanner timeout",
    occurredAt: bangkokIso(-12),
  },
];

/* ------------------------------------------------------------------------------------ files */

const files = new Map<string, Schemas["FileDto"]>();
let fileSeq = 1;

/* ---------------------------------------------------------------------------------- handlers */

function actor(request: Request) {
  const persona = staffPersonaOf(request);
  return persona ? { persona, ok: true as const } : { persona: undefined, ok: false as const };
}

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const notFound = () => problem(404, "http.not_found", "ไม่พบรายการนี้");

export const platformHandlers = [
  /* users */
  http.get("*/v1/admin/users", ({ request }) => {
    const { persona } = actor(request);
    if (!can(persona, "users.read")) return forbidden();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const kind = url.searchParams.get("kind");
    const status = url.searchParams.get("status");
    const rows = users.filter(
      (user) =>
        matchesQuery(q, user.displayName, user.email) &&
        (!kind || user.kind === kind) &&
        (!status || user.status === status),
    );
    return HttpResponse.json(
      paginate(
        sortBy(rows, url.searchParams.get("sort") ?? "createdAt", (url.searchParams.get("order") as "asc") ?? "desc"),
        {
          page: Number(url.searchParams.get("page") ?? 1),
          perPage: Number(url.searchParams.get("perPage") ?? 25),
        },
      ),
    );
  }),
  http.post("*/v1/admin/users", async ({ request }) => {
    const { persona } = actor(request);
    if (!can(persona, "users.manage")) return forbidden();
    const body = (await request.json()) as Schemas["CreateUserDto"];
    if (users.some((user) => user.email === body.email))
      return problem(409, "http.conflict", "อีเมลนี้มีบัญชีอยู่แล้ว");
    const user: User = {
      id: mockId("user", 200 + users.length),
      displayName: body.displayName,
      email: body.email,
      phone: null,
      kind: body.kind,
      status: "active",
      lastLoginAt: null,
      createdAt: bangkokIso(),
      roles: [],
    };
    users.unshift(user);
    return HttpResponse.json(user, { status: 201 });
  }),
  http.get("*/v1/admin/users/:userId", ({ request, params }) => {
    if (!can(actor(request).persona, "users.read")) return forbidden();
    const user = users.find((candidate) => candidate.id === params.userId);
    return user ? HttpResponse.json(user) : notFound();
  }),
  ...(["deactivate", "reactivate"] as const).map((verb) =>
    http.post(`*/v1/admin/users/:userId/actions/${verb}`, ({ request, params }) => {
      const { persona } = actor(request);
      if (!can(persona, "users.manage")) return forbidden();
      const user = users.find((candidate) => candidate.id === params.userId);
      if (!user) return notFound();
      if (user.id === persona?.id) return problem(403, "iam.self_grant", "คุณเปลี่ยนสถานะบัญชีของตัวเองไม่ได้");
      user.status = verb === "deactivate" ? "inactive" : "active";
      return HttpResponse.json(user);
    }),
  ),
  http.post("*/v1/admin/users/:userId/actions/revoke-sessions", ({ request }) =>
    can(actor(request).persona, "users.manage") ? new HttpResponse(null, { status: 204 }) : forbidden(),
  ),
  http.post("*/v1/admin/users/:userId/roles", async ({ request, params }) => {
    const { persona } = actor(request);
    if (!can(persona, "roles.assign")) return forbidden();
    const user = users.find((candidate) => candidate.id === params.userId);
    if (!user) return notFound();
    if (user.id === persona?.id) return problem(403, "iam.self_grant", "คุณให้สิทธิ์กับตัวเองไม่ได้");
    const body = (await request.json()) as Schemas["GrantRoleDto"];
    const role = ROLES.find((candidate) => candidate.key === body.role);
    if (!role)
      return problem(422, "validation.failed", "ไม่รู้จักบทบาทนี้", [
        { path: "role", code: "isIn", message: "ไม่รู้จักบทบาทนี้" },
      ]);
    if ((role.scopeType === "platform") !== !body.scope) {
      return problem(422, "iam.role_scope_mismatch", "ขอบเขตของสิทธิ์ไม่ตรงกับบทบาท");
    }
    if (
      role.audience === "staff" &&
      !role.permissions.every((permission) => persona!.permissions.includes(permission as never))
    ) {
      return problem(403, "iam.role_escalation", "ให้สิทธิ์ได้เฉพาะบทบาทที่คุณมีสิทธิ์ครบทุกข้อ");
    }
    const held = user.roles.map((existing) => existing.role);
    const conflict = SOD_RULES.find(
      (rule) =>
        rule.kind === "role_pair" &&
        ((rule.left === body.role && held.includes(rule.right)) ||
          (rule.right === body.role && held.includes(rule.left))),
    );
    if (conflict) return problem(409, "iam.sod_conflict", `ขัดกับหลักการแบ่งแยกหน้าที่: ${conflict.description}`);
    user.roles.push({
      id: mockId("grant", grantSeq++),
      role: body.role,
      scopeType: role.scopeType,
      scopeId: body.scope?.id ?? null,
      reason: body.reason,
      validFrom: bangkokIso(),
      validTo: body.validTo ?? null,
    });
    return HttpResponse.json(user, { status: 201 });
  }),
  http.post("*/v1/admin/users/:userId/roles/:grantId/actions/revoke", ({ request, params }) => {
    const { persona } = actor(request);
    if (!can(persona, "roles.assign")) return forbidden();
    const user = users.find((candidate) => candidate.id === params.userId);
    if (!user) return notFound();
    if (user.id === persona?.id) return problem(403, "iam.self_grant", "คุณถอนสิทธิ์ของตัวเองไม่ได้");
    user.roles = user.roles.filter((existing) => existing.id !== params.grantId);
    return HttpResponse.json(user);
  }),
  http.get("*/v1/admin/roles", ({ request }) =>
    can(actor(request).persona, "users.read") ? HttpResponse.json(ROLES) : forbidden(),
  ),

  /* approvals */
  http.get("*/v1/admin/approvals/inbox", ({ request }) => {
    const { persona } = actor(request);
    if (!can(persona, "approvals.act")) return forbidden();
    return HttpResponse.json(approvals.filter((item) => mayDecide(item, persona!)));
  }),
  http.get("*/v1/admin/approvals", ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const policy = url.searchParams.get("policy");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = approvals.filter(
      (item) =>
        (!status || item.status === status) &&
        (!policy || item.policy === policy) &&
        matchesQuery(q, item.policy, item.requester.displayName, JSON.stringify(item.payload)),
    );
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),
  http.get("*/v1/admin/approvals/:requestId", ({ params }) => {
    const item = approvals.find((candidate) => candidate.id === params.requestId);
    return item ? HttpResponse.json(item) : notFound();
  }),
  ...(["approve", "reject"] as const).map((verb) =>
    http.post(`*/v1/admin/approvals/:requestId/actions/${verb}`, async ({ request, params }) => {
      const { persona } = actor(request);
      const item = approvals.find((candidate) => candidate.id === params.requestId);
      if (!item) return notFound();
      if (item.status !== "pending") return problem(409, "approval.not_pending", "คำขอนี้ไม่ได้รออนุมัติแล้ว");
      if (item.requester.id === persona?.id)
        return problem(403, "approval.self_approval", "ผู้ขออนุมัติอนุมัติคำขอของตัวเองไม่ได้");
      if (!persona || !mayDecide(item, persona))
        return problem(403, "approval.not_authorised", "ขั้นนี้ไม่ได้รอการอนุมัติจากคุณ");
      const body = (await request.json().catch(() => ({}))) as { comment?: string };
      if (verb === "reject" && !body.comment?.trim()) {
        return problem(422, "validation.failed", "กรุณาระบุเหตุผล", [
          { path: "comment", code: "isNotEmpty", message: "กรุณาระบุเหตุผล" },
        ]);
      }
      const step = item.steps.find((candidate) => candidate.stepNo === item.currentStepNo)!;
      step.status = verb === "approve" ? "approved" : "rejected";
      step.completedAt = bangkokIso();
      item.actions.push({
        action: verb,
        actor: ref(persona),
        at: bangkokIso(),
        comment: body.comment ?? null,
        stepNo: step.stepNo,
        onBehalfOf: null,
      });
      const next = item.steps.find((candidate) => candidate.status === "pending");
      if (verb === "reject" || !next) {
        item.status = verb === "approve" ? "approved" : "rejected";
        item.currentStepNo = null;
        item.decidedAt = bangkokIso();
      } else {
        item.currentStepNo = next.stepNo;
      }
      return HttpResponse.json(item);
    }),
  ),
  http.post("*/v1/admin/approvals/:requestId/actions/withdraw", async ({ request, params }) => {
    const { persona } = actor(request);
    const item = approvals.find((candidate) => candidate.id === params.requestId);
    if (!item) return notFound();
    if (item.requester.id !== persona?.id) return problem(403, "auth.forbidden", "ถอนได้เฉพาะคำขอของคุณ");
    if (item.status !== "pending") return problem(409, "approval.not_pending", "คำขอนี้ไม่ได้รออนุมัติแล้ว");
    const body = (await request.json()) as Schemas["WithdrawDto"];
    item.status = "withdrawn";
    item.currentStepNo = null;
    item.decidedAt = bangkokIso();
    item.actions.push({
      action: "withdraw",
      actor: ref(persona),
      at: bangkokIso(),
      comment: body.reason,
      stepNo: null,
      onBehalfOf: null,
    });
    return HttpResponse.json(item);
  }),
  http.get("*/v1/admin/approval-delegations", ({ request }) => {
    const { persona } = actor(request);
    return HttpResponse.json(
      delegations.filter((d) => d.delegator.id === persona?.id || d.delegate.id === persona?.id),
    );
  }),
  http.post("*/v1/admin/approval-delegations", async ({ request }) => {
    const { persona } = actor(request);
    const body = (await request.json()) as Schemas["CreateDelegationDto"];
    const delegate = PERSONAS.find((candidate) => candidate.id === body.delegateId);
    if (!delegate) return notFound();
    if (delegate.id === persona?.id) {
      return problem(422, "validation.failed", "มอบหมายให้ตัวเองไม่ได้", [
        { path: "delegateId", code: "notSelf", message: "มอบหมายให้ตัวเองไม่ได้" },
      ]);
    }
    const delegation: Schemas["DelegationDto"] = {
      id: mockId("dlg", delegations.length + 1),
      delegator: ref(persona),
      delegate: ref(delegate),
      policy: body.policy ?? null,
      reason: body.reason,
      validFrom: body.validFrom,
      validTo: body.validTo,
      revokedAt: null,
    };
    delegations = [delegation, ...delegations];
    return HttpResponse.json(delegation, { status: 201 });
  }),
  http.post("*/v1/admin/approval-delegations/:delegationId/actions/revoke", ({ params }) => {
    const delegation = delegations.find((candidate) => candidate.id === params.delegationId);
    if (!delegation) return notFound();
    delegation.revokedAt = bangkokIso();
    return HttpResponse.json(delegation);
  }),

  /* audit */
  http.get("*/v1/admin/audit-logs", ({ request }) => {
    if (!can(actor(request).persona, "audit_logs.read")) return forbidden();
    const url = new URL(request.url);
    const get = (name: string) => url.searchParams.get(name);
    const from = get("from") ? Date.parse(get("from")!) : -Infinity;
    const to = get("to") ? Date.parse(get("to")!) : Infinity;
    const rows = auditLog.filter(
      (entry) =>
        (!get("category") || entry.category === get("category")) &&
        (!get("outcome") || entry.outcome === get("outcome")) &&
        (!get("action") || entry.action.startsWith(get("action")!)) &&
        (!get("resourceType") || entry.resourceType === get("resourceType")) &&
        (!get("resourceId") || entry.resourceId === get("resourceId")) &&
        (!get("actorId") || entry.actor.id === get("actorId")) &&
        Date.parse(entry.occurredAt) >= from &&
        Date.parse(entry.occurredAt) < to,
    );
    const start = Number(get("cursor") ?? 0);
    const limit = Math.min(Number(get("limit") ?? 50), 100);
    const next = start + limit < rows.length ? String(start + limit) : null;
    return HttpResponse.json({ data: rows.slice(start, start + limit), meta: { nextCursor: next } });
  }),
  http.post("*/v1/admin/audit-logs/exports", ({ request }) => {
    if (!can(actor(request).persona, "audit_logs.export")) return forbidden();
    const csv = [
      "occurredAt,category,action,outcome,actor",
      ...auditLog.slice(0, 20).map((e) => [e.occurredAt, e.category, e.action, e.outcome, e.actor.name].join(",")),
    ].join("\n");
    return HttpResponse.json({
      fileId: mockId("file", 900),
      rows: auditLog.length,
      truncated: false,
      expiresAt: bangkokIso(5),
      url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
    } satisfies Schemas["AuditExportDto"]);
  }),

  /* settings */
  http.get("*/v1/admin/settings", ({ request }) => {
    const { persona } = actor(request);
    if (!can(persona, "settings.read")) return forbidden();
    return HttpResponse.json(settings.map((setting) => summary(visible(setting, persona))));
  }),
  http.get("*/v1/admin/settings/:settingId", ({ request, params }) => {
    const { persona } = actor(request);
    if (!can(persona, "settings.read")) return forbidden();
    const setting = settings.find((candidate) => candidate.id === params.settingId);
    return setting ? HttpResponse.json(visible(setting, persona)) : notFound();
  }),
  http.post("*/v1/admin/settings/:settingId/versions", async ({ request, params }) => {
    const { persona } = actor(request);
    const setting = settings.find((candidate) => candidate.id === params.settingId);
    if (!setting) return notFound();
    if (!can(persona, "settings.change") || !persona?.roles.includes(setting.ownerRole)) {
      return problem(403, "settings.not_owner", "เฉพาะบทบาทเจ้าของค่านี้จึงจะเปลี่ยนได้");
    }
    if (setting.pending) return problem(409, "settings.pending_exists", "มีการเปลี่ยนค่ารออนุมัติอยู่แล้ว");
    const body = (await request.json()) as Schemas["ChangeSettingDto"];
    const effective = Date.parse(body.effectiveFrom);
    if (Number.isNaN(effective) || effective < Date.now() - 60_000) {
      return problem(422, "settings.backdated", "วันที่มีผลต้องเป็นตอนนี้หรืออนาคต ย้อนหลังไม่ได้");
    }
    if (!body.reason?.trim()) {
      return problem(422, "validation.failed", "กรุณาระบุเหตุผล", [
        { path: "reason", code: "isNotEmpty", message: "กรุณาระบุเหตุผล" },
      ]);
    }
    const versionNo = Math.max(...setting.versions.map((version) => version.versionNo)) + 1;
    const version = { versionNo, effectiveFrom: body.effectiveFrom, value: body.value };
    setting.versions.unshift({
      ...version,
      status: "approved",
      reason: body.reason,
      createdAt: bangkokIso(),
      decidedAt: bangkokIso(),
    });
    if (effective <= Date.now() + 60_000) setting.current = version;
    else
      setting.scheduled = [...setting.scheduled, version].sort(
        (a, b) => Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom),
      );
    return HttpResponse.json(setting, { status: 201 });
  }),

  /* feature flags */
  http.get("*/v1/admin/feature-flags", ({ request }) =>
    can(actor(request).persona, "feature_flags.read") ? HttpResponse.json(flags) : forbidden(),
  ),
  http.put("*/v1/admin/feature-flags/:key", async ({ request, params }) => {
    if (!can(actor(request).persona, "feature_flags.manage")) return forbidden();
    const flag = flags.find((candidate) => candidate.key === params.key);
    if (!flag) return notFound();
    const body = (await request.json()) as Schemas["UpdateFeatureFlagDto"];
    Object.assign(flag, {
      enabled: body.enabled,
      rules: body.rules ?? flag.rules,
      description: body.description ?? flag.description,
      updatedAt: bangkokIso(),
    });
    return HttpResponse.json(flag);
  }),

  /* notification templates and routes */
  http.get("*/v1/admin/notification-templates", () => HttpResponse.json(templates)),
  http.post("*/v1/admin/notification-templates/:templateId/actions/preview", async ({ request, params }) => {
    const template = templates.find((candidate) => candidate.id === params.templateId);
    if (!template) return notFound();
    const body = (await request.json()) as Schemas["PreviewTemplateDto"];
    const version =
      template.versions.find(
        (v) => v.locale === body.locale && (body.versionNo ? v.versionNo === body.versionNo : v.status === "published"),
      ) ?? template.versions[0]!;
    const fill = (text: string | null) =>
      text?.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String((body.payload as Record<string, unknown>)[name] ?? `{{${name}}}`),
      ) ?? null;
    return HttpResponse.json({
      subject: fill(version.subject),
      body: fill(version.body) ?? "",
    } satisfies Schemas["RenderedMessageDto"]);
  }),
  http.post(
    "*/v1/admin/notification-templates/:templateId/versions/:locale/:versionNo/actions/publish",
    ({ params }) => {
      const template = templates.find((candidate) => candidate.id === params.templateId);
      if (!template) return notFound();
      for (const version of template.versions) {
        if (version.locale !== params.locale) continue;
        if (version.versionNo === Number(params.versionNo))
          Object.assign(version, { status: "published", publishedAt: bangkokIso() });
        else if (version.status === "published") version.status = "retired";
      }
      return HttpResponse.json(template);
    },
  ),
  http.post("*/v1/admin/notification-templates/:templateId/versions", async ({ params, request }) => {
    const template = templates.find((candidate) => candidate.id === params.templateId);
    if (!template) return notFound();
    const body = (await request.json()) as Schemas["AddTemplateVersionDto"];
    if (template.channel === "email" && !body.subject?.trim()) {
      return problem(422, "validation.failed", "อีเมลต้องมีหัวเรื่อง", [{ path: "subject", code: "isNotEmpty", message: "อีเมลต้องมีหัวเรื่อง" }]);
    }
    const versionNo = Math.max(0, ...template.versions.filter((v) => v.locale === body.locale).map((v) => v.versionNo)) + 1;
    template.versions.push({ locale: body.locale, versionNo, status: "draft", subject: body.subject ?? null, body: body.body, publishedAt: null });
    return HttpResponse.json(template, { status: 201 });
  }),
  http.post("*/v1/admin/notification-templates/:templateId/actions/test-send", ({ request }) => {
    const persona = staffPersonaOf(request);
    const masked = persona?.email.replace(/^(.).*(@.*)$/, "$1•••$2") ?? null;
    return HttpResponse.json({ sentTo: masked } satisfies Schemas["TestSendResultDto"]);
  }),
  http.get("*/v1/admin/notification-routes", () => HttpResponse.json(routes)),
  http.post("*/v1/admin/notification-routes/:routeId/actions/set-enabled", async ({ request, params }) => {
    const route = routes.find((candidate) => candidate.id === params.routeId);
    if (!route) return notFound();
    route.enabled = ((await request.json()) as Schemas["SetRouteEnabledDto"]).enabled;
    return HttpResponse.json(route);
  }),

  /* outbox */
  http.get("*/v1/admin/outbox", ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    return HttpResponse.json(
      paginate(
        outbox.filter((m) => !status || m.status === status),
        { page: 1, perPage: 50 },
      ),
    );
  }),
  http.post("*/v1/admin/outbox/:eventId/actions/replay", ({ params }) => {
    const message = outbox.find((candidate) => candidate.eventId === params.eventId);
    if (!message) return notFound();
    if (message.status === "dispatched") return problem(409, "outbox.not_replayable", "ส่งสำเร็จไปแล้ว ไม่ต้องส่งซ้ำ");
    Object.assign(message, { status: "pending", attempts: 0, lastError: null });
    return HttpResponse.json(message);
  }),

  /* files — the upload URL points back through the BFF, so the whole flow runs offline */
  http.post("*/v1/admin/files/presign", async ({ request }) => {
    const body = (await request.json()) as Schemas["PresignFileDto"];
    const id = mockId("file", fileSeq++);
    files.set(id, {
      id,
      originalName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      createdAt: bangkokIso(),
      uploadStatus: "pending",
      scanStatus: "pending",
      retentionClass: "standard",
      sha256: null,
      thumbnailId: null,
      widthPx: null,
      heightPx: null,
      pageCount: null,
    });
    return HttpResponse.json(
      {
        fileId: id,
        uploadUrl: `/bff/v1/admin/files/${id}/mock-upload`,
        // The BFF refuses a non-GET without its CSRF header, and a real S3 URL would not want it.
        headers: { "content-type": body.mimeType, "x-packio-csrf": "1" },
        expiresAt: bangkokIso(15),
        multipart: null,
      } satisfies Schemas["PresignedUploadDto"],
      { status: 201 },
    );
  }),
  http.put("*/v1/admin/files/:fileId/mock-upload", ({ params }) => {
    const file = files.get(params.fileId as string);
    if (!file) return notFound();
    file.uploadStatus = "uploaded";
    return new HttpResponse(null, { status: 200 });
  }),
  http.post("*/v1/admin/files/:fileId/actions/complete", ({ params }) => {
    const file = files.get(params.fileId as string);
    if (!file) return notFound();
    Object.assign(file, { uploadStatus: "uploaded", scanStatus: "clean", sha256: "0".repeat(64) });
    return HttpResponse.json(file);
  }),
  http.get("*/v1/admin/files/:fileId", ({ params }) => {
    const file = files.get(params.fileId as string);
    return file ? HttpResponse.json(file) : notFound();
  }),
];

export { approvals, settings, users };
