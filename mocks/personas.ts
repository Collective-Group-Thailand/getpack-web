/**
 * One mock staff account per D-140 role, so every role's menu and actions can be exercised.
 *
 * Each persona holds exactly what packio-api grants its role — `mocks/generated/rbac.ts`, from
 * packio-api's `docs/rbac.md` (`pnpm gen:rbac`). Backend names win (triage `admin.permissions`,
 * U-F0.3): a screen gated on a permission the real role lacks is hidden in the mock too.
 *
 * The menu's platform entries are packio-api's (`menu.catalog.ts`) verbatim. The business entries
 * are still a request (`admin.menu-entries`, packio-api U-B0.3), keyed on the backend permission
 * that reads each area. The real API sends the menu, so nothing here decides what production shows.
 */

import { STAFF_ROLE_GRANTS, type StaffPermission } from "./generated/rbac";

export const MOCK_PASSWORD = "mock-password";

/**
 * The menu the mock API builds: an entry appears when the persona holds its permission. Paths
 * are host-absolute (`/admin/...`), as the contract's own `MenuEntryDto` example spells them.
 */
export const MENU_CATALOGUE: readonly {
  key: string;
  path: string;
  /** One permission, or any of several (the finance workspace opens for each of its desks). */
  permission: StaffPermission | readonly StaffPermission[] | null;
}[] = [
  // packio-api src/modules/iam/menu.catalog.ts, verbatim.
  { key: "dashboard", path: "/admin", permission: null },
  { key: "approvals", path: "/admin/approvals", permission: "approvals.read" },
  { key: "users", path: "/admin/users", permission: "users.read" },
  { key: "settings", path: "/admin/settings", permission: "settings.read" },
  { key: "feature_flags", path: "/admin/feature-flags", permission: "feature_flags.read" },
  {
    key: "notification_templates",
    path: "/admin/notifications/templates",
    permission: "notification_templates.manage",
  },
  { key: "notification_routes", path: "/admin/notifications/routes", permission: "notification_routes.manage" },
  { key: "audit_logs", path: "/admin/audit-logs", permission: "audit_logs.read" },
  { key: "outbox", path: "/admin/outbox", permission: "outbox.manage" },
  { key: "analytics", path: "/admin/analytics", permission: "analytics.read" },
  { key: "reports", path: "/admin/reports", permission: null },
  { key: "ops", path: "/admin/ops", permission: "ops.read" },
  // CONTRACT-GAP admin.menu-entries — each business module adds its own on the backend (U-B0.3).
  { key: "orders", path: "/admin/orders", permission: "orders.read" },
  { key: "cs_calculators", path: "/admin/cs", permission: "quotes.calculate" },
  { key: "quotations", path: "/admin/quotations", permission: "quotes.read" },
  { key: "rfq", path: "/admin/rfq", permission: "rfqs.read" },
  { key: "prepress", path: "/admin/prepress", permission: "artwork.read" },
  { key: "production", path: "/admin/production", permission: "production.read" },
  { key: "shipments", path: "/admin/shipments", permission: "shipments.read" },
  { key: "claims", path: "/admin/claims", permission: "claims.read" },
  { key: "partners", path: "/admin/partners", permission: "partners.read" },
  { key: "catalogue", path: "/admin/catalogue", permission: "catalog.read" },
  { key: "cms", path: "/admin/cms", permission: "cms.manage" },
  { key: "marketing", path: "/admin/marketing", permission: "promotions.read" },
  { key: "customers", path: "/admin/customers", permission: "customers.read" },
  { key: "companies", path: "/admin/companies", permission: "companies.read" },
  { key: "discount_memos", path: "/admin/discount-memos", permission: "discount_memos.read" },
  // CONTRACT-GAP admin.menu-entries — the finance workspace, for whoever works one of its desks.
  {
    key: "finance",
    path: "/admin/finance",
    permission: [
      "payments.verify_slip",
      "receivables.manage",
      "ledger.read",
      "payables.read",
      "banking.read",
      "tax.read",
      "close.read",
      "audit_support.read",
    ],
  },
];

export interface StaffPersona {
  key: string;
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: StaffPermission[];
}

function persona(key: string, n: number, displayName: string, roles: string[]): StaffPersona {
  return {
    key,
    id: `00000000-0000-4000-8000-0000000051${n.toString(16).padStart(2, "0")}`,
    email: key === "cs" ? "somchai.staff@packio.invalid" : `${key.replace(/_/g, ".")}.staff@packio.invalid`,
    displayName,
    roles,
    permissions: [...new Set(roles.flatMap((role) => STAFF_ROLE_GRANTS[role] ?? []))],
  };
}

export const PERSONAS: readonly StaffPersona[] = [
  persona("superadmin", 1, "ผู้ดูแลสูงสุด ตัวอย่าง (ข้อมูลจำลอง)", ["superadmin"]),
  persona("c_level", 2, "ผู้บริหาร ตัวอย่าง (ข้อมูลจำลอง)", ["c_level"]),
  persona("vp", 3, "รองประธาน ตัวอย่าง (ข้อมูลจำลอง)", ["vp"]),
  persona("director", 4, "ผู้อำนวยการ ตัวอย่าง (ข้อมูลจำลอง)", ["director"]),
  persona("admin", 5, "ผู้ดูแลระบบ ตัวอย่าง (ข้อมูลจำลอง)", ["admin"]),
  persona("cs", 6, "สมชาย ตัวอย่าง (ข้อมูลจำลอง)", ["cs"]),
  persona("cs_lead", 7, "หัวหน้าบริการลูกค้า ตัวอย่าง (ข้อมูลจำลอง)", ["cs_lead"]),
  persona("prepress", 8, "ฝ่ายเตรียมพิมพ์ ตัวอย่าง (ข้อมูลจำลอง)", ["prepress"]),
  persona("finance", 9, "ฝ่ายการเงิน ตัวอย่าง (ข้อมูลจำลอง)", ["finance"]),
  persona("finance_manager", 10, "ผู้จัดการการเงิน ตัวอย่าง (ข้อมูลจำลอง)", ["finance_manager"]),
  persona("logistics", 11, "ฝ่ายขนส่ง ตัวอย่าง (ข้อมูลจำลอง)", ["logistics"]),
  persona("marketing", 12, "ฝ่ายการตลาด ตัวอย่าง (ข้อมูลจำลอง)", ["marketing"]),
  persona("partner_manager", 13, "ผู้จัดการพันธมิตร ตัวอย่าง (ข้อมูลจำลอง)", ["partner_manager"]),
  persona("auditor", 14, "ผู้ตรวจสอบบัญชี ตัวอย่าง (ข้อมูลจำลอง)", ["auditor"]),
];

/** The persona the F1 tests sign in as (`somchai.staff@…`), a CS agent. */
export const DEFAULT_PERSONA = "cs";

export function personaByEmail(email: string | undefined): StaffPersona | undefined {
  return PERSONAS.find((persona) => persona.email === email);
}

export function personaByKey(key: string | undefined): StaffPersona | undefined {
  return PERSONAS.find((persona) => persona.key === key);
}

export function menuFor(persona: StaffPersona): { key: string; path: string }[] {
  return MENU_CATALOGUE.filter((entry) => entitled(persona, entry)).map(({ key, path }) => ({ key, path }));
}

/** Whether a menu entry is this persona's: no permission, the one it names, or any of several. */
export function entitled(persona: StaffPersona, entry: (typeof MENU_CATALOGUE)[number]): boolean {
  if (entry.permission === null) return true;
  const needed: readonly StaffPermission[] =
    typeof entry.permission === "string" ? [entry.permission] : entry.permission;
  return needed.some((permission) => persona.permissions.includes(permission));
}

export function can(persona: StaffPersona | undefined, permission: string): boolean {
  return Boolean(persona?.permissions.includes(permission as StaffPermission));
}
