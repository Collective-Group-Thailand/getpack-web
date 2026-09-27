/**
 * The factory users the mock partner surface knows — one per D-140 factory role at the launch
 * factory (F001), plus the owners of two factories still onboarding: F005 (applied, filling its
 * own application) and F006 (under review, with data Packio entered for it to sign off — the
 * assisted onboarding of the D-100 note).
 *
 * Permissions are packio-api `docs/rbac.md` § "Partner factory (factory scope)". The keys that
 * matrix does not have yet — jobs, QC, shipping, billing — are proposed in
 * `docs/contract-requests.md` with the requests that need them, and added here when those
 * screens are built. All obviously fake.
 */

import { mockId } from "../support";

export type PartnerRole =
  "factory_owner" | "factory_planner" | "factory_operator" | "factory_qc" | "factory_shipping" | "factory_accountant";

/** rbac.md's matrix, role by role. */
export const ROLE_PERMISSIONS: Record<PartnerRole, readonly string[]> = {
  factory_owner: [
    "factory_profile.read",
    "factory_users.manage",
    "factory_profile.manage",
    "factory_onboarding.sign_off",
    "factory_prices.read",
    "factory_prices.propose",
    "factory_rate_card.accept",
    "factory_agreements.accept",
    "factory_bank_account.propose",
    "factory_capacity.read",
    "factory_rfq.read",
    "factory_rfq.respond",
  ],
  factory_planner: ["factory_profile.read", "factory_capacity.read", "factory_rfq.read", "factory_rfq.respond"],
  factory_operator: ["factory_profile.read"],
  factory_qc: ["factory_profile.read"],
  factory_shipping: ["factory_profile.read"],
  factory_accountant: ["factory_profile.read", "factory_prices.read", "factory_bank_account.propose"],
};

/**
 * Proposed in docs/contract-requests.md (`partner.jobs`, `partner.shipments`) — rbac.md has no
 * production or shipping keys yet. The shop floor splits the way B4.2 describes it: the planner
 * accepts and plans, operators report milestones, QC records checks, shipping ships.
 */
const FLOOR: Record<PartnerRole, readonly string[]> = {
  factory_owner: [
    "factory_jobs.read",
    "factory_jobs.accept",
    "factory_jobs.update",
    "factory_qc.record",
    "factory_shipments.read",
    "factory_shipments.manage",
  ],
  factory_planner: ["factory_jobs.read", "factory_jobs.accept", "factory_jobs.update", "factory_shipments.read"],
  factory_operator: ["factory_jobs.read", "factory_jobs.update"],
  factory_qc: ["factory_jobs.read", "factory_jobs.update", "factory_qc.record"],
  factory_shipping: ["factory_jobs.read", "factory_shipments.read", "factory_shipments.manage"],
  factory_accountant: ["factory_jobs.read", "factory_shipments.read"],
};
/**
 * Money and account keys, proposed with `partner.billing-statements`, `partner.payouts`,
 * `partner.claims`, `partner.scorecard` (rbac.md has none): the accountant keeps the books, the
 * owner answers claims and manages users, the planner sees the scorecard.
 */
const ACCOUNT: Record<PartnerRole, readonly string[]> = {
  factory_owner: [
    "factory_billing.read",
    "factory_billing.confirm",
    "factory_payouts.read",
    "factory_claims.read",
    "factory_claims.respond",
    "factory_scorecard.read",
  ],
  factory_planner: ["factory_claims.read", "factory_scorecard.read"],
  factory_operator: [],
  factory_qc: ["factory_claims.read"],
  factory_shipping: [],
  factory_accountant: [
    "factory_billing.read",
    "factory_billing.confirm",
    "factory_payouts.read",
    "factory_claims.read",
  ],
};
for (const role of Object.keys(FLOOR) as PartnerRole[]) {
  ROLE_PERMISSIONS[role] = [...ROLE_PERMISSIONS[role], ...ACCOUNT[role]];
}
for (const role of Object.keys(FLOOR) as PartnerRole[]) {
  ROLE_PERMISSIONS[role] = [...ROLE_PERMISSIONS[role], ...FLOOR[role]];
}

export interface PartnerPersona {
  key: string;
  id: string;
  email: string;
  displayName: string;
  factoryId: string;
  roles: PartnerRole[];
}

const F001 = "00000000-0000-4000-8000-0000000000f1";

export const PARTNER_PERSONAS: PartnerPersona[] = [
  // The F1 persona; its id and e-mail are what the F1 tests were written against.
  {
    key: "planner",
    id: "00000000-0000-4000-8000-000000000003",
    email: "planner@factory.invalid",
    displayName: "ช่างวางแผน ตัวอย่าง (ข้อมูลจำลอง)",
    factoryId: F001,
    roles: ["factory_planner"],
  },
  {
    key: "owner",
    id: mockId("pus", 1),
    email: "owner@factory.invalid",
    displayName: "เจ้าของโรงงาน ตัวอย่าง (ข้อมูลจำลอง)",
    factoryId: F001,
    roles: ["factory_owner"],
  },
  {
    key: "operator",
    id: mockId("pus", 2),
    email: "operator@factory.invalid",
    displayName: "พนักงานผลิต ตัวอย่าง (ข้อมูลจำลอง)",
    factoryId: F001,
    roles: ["factory_operator"],
  },
  {
    key: "qc",
    id: mockId("pus", 3),
    email: "qc@factory.invalid",
    displayName: "ฝ่ายตรวจคุณภาพ ตัวอย่าง (ข้อมูลจำลอง)",
    factoryId: F001,
    roles: ["factory_qc"],
  },
  {
    key: "shipping",
    id: mockId("pus", 4),
    email: "shipping@factory.invalid",
    displayName: "ฝ่ายจัดส่ง ตัวอย่าง (ข้อมูลจำลอง)",
    factoryId: F001,
    roles: ["factory_shipping"],
  },
  {
    key: "accountant",
    id: mockId("pus", 5),
    email: "accountant@factory.invalid",
    displayName: "ฝ่ายบัญชีโรงงาน ตัวอย่าง (ข้อมูลจำลอง)",
    factoryId: F001,
    roles: ["factory_accountant"],
  },
  {
    key: "applicant",
    id: mockId("pus", 6),
    email: "owner@corrugated.invalid",
    displayName: "เจ้าของ ลูกฟูกใหม่ (ข้อมูลจำลอง)",
    factoryId: mockId("fac", 5),
    roles: ["factory_owner"],
  },
  {
    key: "assisted",
    id: mockId("pus", 7),
    email: "owner@labels.invalid",
    displayName: "เจ้าของ ฉลากดี (ข้อมูลจำลอง)",
    factoryId: mockId("fac", 6),
    roles: ["factory_owner"],
  },
];

export const DEFAULT_PARTNER_PERSONA = "planner";

export const partnerPersonaByEmail = (email: string | undefined) =>
  PARTNER_PERSONAS.find((persona) => persona.email === email);

export const partnerPersonaByKey = (key: string | undefined) =>
  PARTNER_PERSONAS.find((persona) => persona.key === (key ?? DEFAULT_PARTNER_PERSONA));

export function permissionsOf(persona: PartnerPersona): string[] {
  return [...new Set(persona.roles.flatMap((role) => ROLE_PERMISSIONS[role]))];
}

export const canPartner = (persona: PartnerPersona | undefined, permission: string) =>
  !!persona && permissionsOf(persona).includes(permission);
