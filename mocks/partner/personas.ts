/**
 * The factory users the mock partner surface knows — one per D-140 factory role at the launch
 * factory (F001), plus the owners of two factories still onboarding: F005 (applied, filling its
 * own application) and F006 (under review, with data Packio entered for it to sign off — the
 * assisted onboarding of the D-100 note).
 *
 * Permissions are packio-api `docs/rbac.md` § "Partner factory (factory scope)", imported verbatim
 * by `pnpm gen:rbac`. All obviously fake.
 */

import { FACTORY_ROLE_GRANTS, type FactoryPermission } from "../generated/rbac";
import { mockId } from "../support";

export type PartnerRole =
  | "factory_owner"
  | "factory_planner"
  | "factory_operator"
  | "factory_qc"
  | "factory_shipping"
  | "factory_accountant"
  | "factory_storekeeper"
  | "factory_purchaser";

/**
 * packio-api's factory-scope grants, role by role (`pnpm gen:rbac`, triage `partner.permissions`):
 * the planner accepts and plans, operators report milestones and raise issues, QC records checks
 * and answers claims with the owner, shipping ships, the accountant keeps the books.
 */
export const ROLE_PERMISSIONS: Record<PartnerRole, readonly FactoryPermission[]> = {
  factory_owner: FACTORY_ROLE_GRANTS.factory_owner!,
  factory_planner: FACTORY_ROLE_GRANTS.factory_planner!,
  factory_operator: FACTORY_ROLE_GRANTS.factory_operator!,
  factory_qc: FACTORY_ROLE_GRANTS.factory_qc!,
  factory_shipping: FACTORY_ROLE_GRANTS.factory_shipping!,
  factory_accountant: FACTORY_ROLE_GRANTS.factory_accountant!,
  // Packio Factory ERP roles (packio-api v0.44.0, D-319).
  factory_storekeeper: FACTORY_ROLE_GRANTS.factory_storekeeper!,
  factory_purchaser: FACTORY_ROLE_GRANTS.factory_purchaser!,
};

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
    key: "storekeeper",
    id: mockId("pus", 8),
    email: "storekeeper@factory.invalid",
    displayName: "เจ้าหน้าที่คลัง ตัวอย่าง (ข้อมูลจำลอง)",
    factoryId: F001,
    roles: ["factory_storekeeper"],
  },
  {
    key: "purchaser",
    id: mockId("pus", 9),
    email: "purchaser@factory.invalid",
    displayName: "เจ้าหน้าที่จัดซื้อ ตัวอย่าง (ข้อมูลจำลอง)",
    factoryId: F001,
    roles: ["factory_purchaser"],
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
