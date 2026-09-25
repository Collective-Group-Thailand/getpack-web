/**
 * One mock staff account per D-140 role, so every role's menu and actions can be exercised.
 *
 * Permissions are packio-api's where B1.3 already defines them (`docs/rbac.md`, generated from
 * the backend's catalogue). The domain permissions F2 screens need — orders, RFQ, catalogue,
 * partners, marketing, logistics — do not exist yet; they are **proposals**, spelled the way
 * the backend spells its own (`resource.action`) and listed in `docs/contract-requests.md`
 * (`admin.permissions`). The real API sends the menu, so nothing here decides what production
 * shows; this only has to behave like an API that builds the menu from permissions.
 */

export const MOCK_PASSWORD = "mock-password";

/** Every permission the mock knows, backend-defined first. */
const P = {
  // docs/rbac.md (B1.3)
  settingsRead: "settings.read",
  settingsReadSensitive: "settings.read_sensitive",
  settingsChange: "settings.change",
  flagsRead: "feature_flags.read",
  flagsManage: "feature_flags.manage",
  approvalsRead: "approvals.read",
  approvalsAct: "approvals.act",
  approvalsDelegate: "approvals.delegate",
  usersRead: "users.read",
  usersManage: "users.manage",
  rolesAssign: "roles.assign",
  auditRead: "audit_logs.read",
  auditExport: "audit_logs.export",
  notificationTemplates: "notification_templates.manage",
  notificationRoutes: "notification_routes.manage",
  outbox: "outbox.manage",
  filesUpload: "files.upload",
  filesRead: "files.read",
  factoryCost: "factory_cost.read",
  marginRead: "margin.read",
  marginWhenDiscounting: "margin.read_pct_when_discounting",
  // proposed for F2 (admin.permissions)
  ordersRead: "orders.read",
  ordersManage: "orders.manage",
  ordersCreate: "orders.create_on_behalf",
  csCalculate: "cs.calculate",
  quotesManage: "quotations.manage",
  discountDirect: "discounts.apply",
  memosRead: "discount_memos.read",
  rfqRead: "rfq.read",
  rfqManage: "rfq.manage",
  prepressRead: "prepress.read",
  prepressManage: "prepress.manage",
  catalogRead: "catalog.read",
  catalogManage: "catalog.manage",
  cmsManage: "cms.manage",
  partnersRead: "partners.read",
  partnersManage: "partners.manage",
  pricesReview: "price_lists.review",
  productionRead: "production.read",
  qcInspect: "qc.inspect",
  marketingRead: "marketing.read",
  marketingManage: "marketing.manage",
  customersRead: "customers.read",
  companiesRead: "companies.read",
  companiesManage: "companies.manage",
  shipmentsRead: "shipments.read",
  shipmentsManage: "shipments.manage",
  claimsRead: "claims.read",
  claimsDecide: "claims.decide",
  analyticsRead: "analytics.read",
  reportsRead: "reports.read",
} as const;

type Permission = (typeof P)[keyof typeof P];

/**
 * The menu the mock API builds: an entry appears when the persona holds its permission. Paths
 * are host-absolute (`/admin/...`), as the contract's own `MenuEntryDto` example spells them.
 */
export const MENU_CATALOGUE: readonly { key: string; path: string; permission: Permission | null }[] = [
  // packio-api src/modules/iam/menu.catalog.ts (B1.3), verbatim.
  { key: "dashboard", path: "/admin", permission: null },
  { key: "approvals", path: "/admin/approvals", permission: P.approvalsRead },
  { key: "users", path: "/admin/users", permission: P.usersRead },
  { key: "settings", path: "/admin/settings", permission: P.settingsRead },
  { key: "feature_flags", path: "/admin/feature-flags", permission: P.flagsRead },
  { key: "notification_templates", path: "/admin/notifications/templates", permission: P.notificationTemplates },
  { key: "notification_routes", path: "/admin/notifications/routes", permission: P.notificationRoutes },
  { key: "audit_logs", path: "/admin/audit-logs", permission: P.auditRead },
  { key: "outbox", path: "/admin/outbox", permission: P.outbox },
  // Proposed for F2 (admin.menu-entries) — each business module adds its own on the backend.
  { key: "orders", path: "/admin/orders", permission: P.ordersRead },
  { key: "cs_calculators", path: "/admin/cs", permission: P.csCalculate },
  { key: "quotations", path: "/admin/quotations", permission: P.quotesManage },
  { key: "rfq", path: "/admin/rfq", permission: P.rfqRead },
  { key: "prepress", path: "/admin/prepress", permission: P.prepressRead },
  { key: "production", path: "/admin/production", permission: P.productionRead },
  { key: "shipments", path: "/admin/shipments", permission: P.shipmentsRead },
  { key: "claims", path: "/admin/claims", permission: P.claimsRead },
  { key: "partners", path: "/admin/partners", permission: P.partnersRead },
  { key: "catalogue", path: "/admin/catalogue", permission: P.catalogRead },
  { key: "marketing", path: "/admin/marketing", permission: P.marketingRead },
  { key: "customers", path: "/admin/customers", permission: P.customersRead },
  { key: "companies", path: "/admin/companies", permission: P.companiesRead },
  { key: "discount_memos", path: "/admin/discount-memos", permission: P.memosRead },
  { key: "analytics", path: "/admin/analytics", permission: P.analyticsRead },
  { key: "reports", path: "/admin/reports", permission: P.reportsRead },
];

export interface StaffPersona {
  key: string;
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: Permission[];
}

const everyone: Permission[] = [P.approvalsRead, P.approvalsDelegate, P.filesUpload, P.filesRead];

function persona(
  key: string,
  n: number,
  displayName: string,
  roles: string[],
  permissions: Permission[],
): StaffPersona {
  return {
    key,
    id: `00000000-0000-4000-8000-0000000051${n.toString(16).padStart(2, "0")}`,
    email: key === "cs" ? "somchai.staff@packio.invalid" : `${key.replace(/_/g, ".")}.staff@packio.invalid`,
    displayName,
    roles,
    permissions: [...new Set([...everyone, ...permissions])],
  };
}

const commercialRead: Permission[] = [P.ordersRead, P.rfqRead, P.catalogRead, P.customersRead, P.companiesRead];
const executive: Permission[] = [
  ...commercialRead,
  P.approvalsAct,
  P.settingsRead,
  P.factoryCost,
  P.marginRead,
  P.partnersRead,
  P.productionRead,
  P.shipmentsRead,
  P.claimsRead,
  P.marketingRead,
  P.memosRead,
  P.analyticsRead,
  P.reportsRead,
  P.auditRead,
];

export const PERSONAS: readonly StaffPersona[] = [
  persona("superadmin", 1, "ผู้ดูแลสูงสุด ตัวอย่าง (ข้อมูลจำลอง)", ["superadmin"], Object.values(P)),
  persona("c_level", 2, "ผู้บริหาร ตัวอย่าง (ข้อมูลจำลอง)", ["c_level"], [...executive, P.settingsReadSensitive]),
  persona(
    "vp",
    3,
    "รองประธาน ตัวอย่าง (ข้อมูลจำลอง)",
    ["vp"],
    executive.filter((p) => p !== P.auditRead),
  ),
  persona(
    "director",
    4,
    "ผู้อำนวยการ ตัวอย่าง (ข้อมูลจำลอง)",
    ["director"],
    [...commercialRead, P.approvalsAct, P.settingsRead, P.memosRead, P.reportsRead],
  ),
  persona(
    "admin",
    5,
    "ผู้ดูแลระบบ ตัวอย่าง (ข้อมูลจำลอง)",
    ["admin"],
    [
      P.settingsRead,
      P.flagsRead,
      P.usersRead,
      P.usersManage,
      P.rolesAssign,
      P.catalogRead,
      P.catalogManage,
      P.cmsManage,
    ],
  ),
  persona(
    "cs",
    6,
    "สมชาย ตัวอย่าง (ข้อมูลจำลอง)",
    ["cs"],
    [
      P.ordersRead,
      P.ordersManage,
      P.ordersCreate,
      P.csCalculate,
      P.quotesManage,
      P.discountDirect,
      P.memosRead,
      P.rfqRead,
      P.rfqManage,
      P.customersRead,
      P.companiesRead,
      P.shipmentsRead,
      P.claimsRead,
      P.marginWhenDiscounting,
    ],
  ),
  persona(
    "cs_lead",
    7,
    "หัวหน้าบริการลูกค้า ตัวอย่าง (ข้อมูลจำลอง)",
    ["cs_lead"],
    [
      P.ordersRead,
      P.ordersManage,
      P.ordersCreate,
      P.csCalculate,
      P.quotesManage,
      P.discountDirect,
      P.memosRead,
      P.rfqRead,
      P.rfqManage,
      P.customersRead,
      P.companiesRead,
      P.shipmentsRead,
      P.claimsRead,
      P.claimsDecide,
      P.marginWhenDiscounting,
      P.reportsRead,
    ],
  ),
  persona(
    "prepress",
    8,
    "ฝ่ายเตรียมพิมพ์ ตัวอย่าง (ข้อมูลจำลอง)",
    ["prepress"],
    [P.ordersRead, P.prepressRead, P.prepressManage, P.rfqRead],
  ),
  persona(
    "finance",
    9,
    "ฝ่ายการเงิน ตัวอย่าง (ข้อมูลจำลอง)",
    ["finance"],
    [
      P.approvalsAct,
      P.settingsRead,
      P.auditRead,
      P.factoryCost,
      P.marginRead,
      P.ordersRead,
      P.companiesRead,
      P.companiesManage,
      P.customersRead,
      P.reportsRead,
      P.memosRead,
    ],
  ),
  persona(
    "finance_manager",
    10,
    "ผู้จัดการการเงิน ตัวอย่าง (ข้อมูลจำลอง)",
    ["finance_manager"],
    [
      P.approvalsAct,
      P.settingsRead,
      P.settingsReadSensitive,
      P.auditRead,
      P.auditExport,
      P.factoryCost,
      P.marginRead,
      P.ordersRead,
      P.companiesRead,
      P.companiesManage,
      P.customersRead,
      P.reportsRead,
      P.memosRead,
    ],
  ),
  persona(
    "logistics",
    11,
    "ฝ่ายขนส่ง ตัวอย่าง (ข้อมูลจำลอง)",
    ["logistics"],
    [P.ordersRead, P.shipmentsRead, P.shipmentsManage, P.claimsRead, P.productionRead],
  ),
  persona(
    "marketing",
    12,
    "ฝ่ายการตลาด ตัวอย่าง (ข้อมูลจำลอง)",
    ["marketing"],
    [
      P.approvalsAct,
      P.marketingRead,
      P.marketingManage,
      P.customersRead,
      P.cmsManage,
      P.catalogRead,
      P.analyticsRead,
      P.reportsRead,
    ],
  ),
  persona(
    "partner_manager",
    13,
    "ผู้จัดการพันธมิตร ตัวอย่าง (ข้อมูลจำลอง)",
    ["partner_manager"],
    [
      P.approvalsAct,
      P.settingsRead,
      P.factoryCost,
      P.marginRead,
      P.partnersRead,
      P.partnersManage,
      P.pricesReview,
      P.productionRead,
      P.qcInspect,
      P.rfqRead,
      P.analyticsRead,
    ],
  ),
  persona(
    "auditor",
    14,
    "ผู้ตรวจสอบบัญชี ตัวอย่าง (ข้อมูลจำลอง)",
    ["auditor"],
    [P.settingsRead, P.usersRead, P.auditRead, P.auditExport, P.reportsRead],
  ),
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
  return MENU_CATALOGUE.filter(
    (entry) => entry.permission === null || persona.permissions.includes(entry.permission),
  ).map(({ key, path }) => ({ key, path }));
}

export function can(persona: StaffPersona | undefined, permission: string): boolean {
  return Boolean(persona?.permissions.includes(permission as Permission));
}
