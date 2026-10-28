/**
 * Mocks for the back-office building blocks getpack-api published in U-B0.3 (`v0.6.0`): saved
 * views (`admin.savedViews.*`), search (`admin.search.find`), the dashboard
 * (`admin.dashboard.get`), the staff directory (`admin.staffDirectory.list`) and the
 * segregation-of-duties rules (`admin.sodRules.list`).
 *
 * Typed by the contract (`./finance/support`), so a mock that drifts from what getpack-api
 * published stops compiling. Behaviour follows getpack-api's controllers at v0.6.0
 * (`src/modules/iam/admin/{saved-views,search,directory}.controller.ts`,
 * `src/modules/ops/dashboard.service.ts`).
 */

import type { Schemas } from "@/lib/api/types";

import { can, PERSONAS, type StaffPersona } from "../personas";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { filterFileAccessLog } from "./file-access-logs";
import { finance as published } from "./finance/support";
import { approvals, mayDecide, SOD_RULES, users } from "./platform";

type SavedView = Schemas["SavedViewDto"];
type SearchResult = Schemas["SearchResultDto"];
type Queue = Schemas["DashboardQueueDto"];

/* --------------------------------------------------------------------------- search index */

/**
 * What ⌘K can find. Each domain's mocks add their records here, so search covers whatever the
 * mock API holds without this file knowing every domain. `permission` is the read permission
 * getpack-api checks for the result's type.
 */
export const searchIndex: (SearchResult & { permission: string; keywords?: string })[] = [];

export function indexForSearch(...entries: (SearchResult & { permission: string; keywords?: string })[]) {
  searchIndex.push(...entries);
}

indexForSearch(
  ...users.map((user) => ({
    type: "user" as const,
    id: user.id,
    code: user.email ?? user.id,
    title: user.displayName,
    subtitle: user.roles.map((grant) => grant.role).join(", ") || null,
    permission: "users.read",
  })),
);

/* ---------------------------------------------------------------------------- queues */

/**
 * getpack-api's dashboard (`DashboardService` at v0.6.0): the 21 work queues, each shown to whoever
 * holds its working permission, in this order, at this zone-relative path.
 */
export const DASHBOARD_QUEUES: readonly { key: string; path: string; permission: string }[] = [
  { key: "orders.waiting_payment", path: "/orders?queue=waiting_payment", permission: "orders.manage" },
  { key: "orders.artwork_review", path: "/orders?queue=artwork_review", permission: "orders.manage" },
  { key: "orders.waiting_production", path: "/orders?queue=waiting_production", permission: "orders.manage" },
  { key: "orders.late", path: "/orders?queue=late", permission: "orders.manage" },
  { key: "rfqs.awaiting_first_response", path: "/rfq", permission: "rfqs.manage" },
  {
    key: "production.awaiting_acceptance",
    path: "/production?queue=awaiting_acceptance",
    permission: "production.manage",
  },
  { key: "production.at_risk", path: "/production?queue=at_risk", permission: "production.manage" },
  { key: "shipments.exceptions", path: "/shipments?queue=exceptions", permission: "shipments.manage" },
  { key: "shipments.pod_review", path: "/shipments?queue=pod_review", permission: "shipments.manage" },
  { key: "claims.open", path: "/claims", permission: "claims.manage" },
  { key: "companies.kyc_review", path: "/companies?status=kyc_review", permission: "companies.kyc_review" },
  { key: "finance.slips", path: "/finance/slips", permission: "payments.verify_slip" },
  { key: "finance.unmatched_bank_lines", path: "/finance/banking/lines", permission: "banking.read" },
  { key: "finance.unidentified_receipts", path: "/finance/banking/unidentified", permission: "banking.read" },
  { key: "finance.payout_runs_awaiting_approval", path: "/finance/payouts", permission: "payouts.manage" },
  { key: "finance.deliveries_without_gr", path: "/finance/payables/goods-receipts", permission: "payables.read" },
  { key: "finance.bills_missing_tax_invoice", path: "/finance/payables/statements", permission: "payables.read" },
  { key: "finance.wht_certificates_missing", path: "/finance/receivables/wht", permission: "receivables.manage" },
  { key: "finance.overdue_b2b_invoices", path: "/finance/receivables/aging", permission: "receivables.manage" },
  { key: "finance.refunds_to_pay", path: "/finance/refunds", permission: "refunds.complete" },
  { key: "finance.close_tasks", path: "/finance/close", permission: "close.read" },
];

/**
 * The domain mocks' own queues, which hold the live counts. Each registers what it can count; the
 * dashboard takes the count of a getpack-api queue from the provider with the same key and reports 0
 * for a queue no mock counts yet. A provider whose key is not
 * one of getpack-api's 21 feeds nothing: the API never sends it.
 */
export const queueRegistry: { permission: string; queue: (persona: StaffPersona) => Queue | null }[] = [];

export function registerQueue(permission: string, queue: (persona: StaffPersona) => Queue | null) {
  queueRegistry.push({ permission, queue });
}

/** Approvals waiting on this person: the inbox, which the dashboard page shows on its own. */
registerQueue("approvals.act", (persona) => {
  const waiting = approvals.filter((item) => mayDecide(item, persona));
  const due = waiting.flatMap((item) =>
    item.steps.filter((step) => step.stepNo === item.currentStepNo && step.dueAt).map((step) => step.dueAt!),
  );
  return {
    key: "approvals.inbox",
    path: "/approvals",
    count: waiting.length,
    overdueCount: due.filter((at) => Date.parse(at) < Date.now()).length,
    nextDueAt: due.sort()[0] ?? null,
  };
});

export function dashboardFor(persona: StaffPersona): Queue[] {
  const counted = new Map<string, Queue>();
  for (const entry of queueRegistry) {
    const queue = entry.queue(persona);
    if (queue) counted.set(queue.key, queue);
  }
  return DASHBOARD_QUEUES.filter((definition) => can(persona, definition.permission)).map((definition) => {
    const live = counted.get(definition.key);
    return {
      key: definition.key,
      path: definition.path,
      count: live?.count ?? 0,
      overdueCount: live?.overdueCount ?? 0,
      nextDueAt: live?.nextDueAt ?? null,
    };
  });
}

/* --------------------------------------------------------------------------- list exports */

/** What each exportable list needs to be read, and which search records stand for its rows. */
const LIST_EXPORTS: Record<Schemas["ListExportResource"], { permission: string; type: SearchResult["type"] | null }> = {
  orders: { permission: "orders.read", type: "order" },
  customers: { permission: "customers.read", type: "customer" },
  companies: { permission: "companies.read", type: "company" },
  shipments: { permission: "shipments.read", type: "shipment" },
  claims: { permission: "claims.read", type: "claim" },
  // C1f (D-451): the customer file access log page — rows from the log mock, with the typed reason.
  customer_file_access_logs: { permission: "customer_file_access_logs.read", type: null },
};

/* ----------------------------------------------------------------------- saved views */

const savedViews: SavedView[] = [];

const QUERY_KEY = /^[A-Za-z][A-Za-z0-9_.[\]-]{0,63}$/;

export const consoleHandlers = [
  published.get("/v1/admin/saved-views", null, ({ query, persona }) => {
    if (!query.resource) return problem(422, "validation.failed", "ต้องระบุ resource");
    const visible = savedViews
      .filter((view) => view.resource === query.resource && (view.shared || view.owner.id === persona.id))
      .sort((a, b) => a.name.localeCompare(b.name, "th"))
      // Mine first, then colleagues' shared views (getpack-api's order).
      .sort((a, b) => Number(a.owner.id !== persona.id) - Number(b.owner.id !== persona.id));
    return paginate(visible, query);
  }),
  published.post("/v1/admin/saved-views", { permission: null, status: 201 }, ({ body, persona }) => {
    const entries = Object.entries(body.query ?? {});
    if (entries.length > 30) return problem(422, "validation.failed", "เก็บตัวกรองได้ไม่เกิน 30 รายการ");
    if (entries.some(([key, value]) => !QUERY_KEY.test(key) || typeof value !== "string" || value.length > 500))
      return problem(422, "validation.failed", "ตัวกรองไม่ถูกต้อง");
    const name = body.name.trim();
    if (
      savedViews.some((view) => view.resource === body.resource && view.owner.id === persona.id && view.name === name)
    )
      return problem(409, "http.conflict", "มีมุมมองชื่อนี้อยู่แล้ว");
    const view: SavedView = {
      id: mockId("view", savedViews.length + 1),
      resource: body.resource,
      name,
      query: body.query,
      columns: body.columns ?? null,
      shared: body.shared ?? false,
      owner: { id: persona.id, displayName: persona.displayName },
      createdAt: bangkokIso(),
    };
    savedViews.push(view);
    return view;
  }),
  published.delete("/v1/admin/saved-views/{viewId}", { permission: null, status: 204 }, ({ params, persona }) => {
    const index = savedViews.findIndex((view) => view.id === params.viewId);
    const view = savedViews[index];
    if (!view || (view.owner.id !== persona.id && !view.shared))
      return problem(404, "http.not_found", "ไม่พบมุมมองนี้");
    if (view.owner.id !== persona.id) return problem(403, "auth.forbidden", "ลบได้เฉพาะมุมมองของคุณ");
    savedViews.splice(index, 1);
  }),

  published.get("/v1/admin/search", null, ({ query, persona }) => {
    const q = String(query.q ?? "").trim();
    if (q.length < 2) return problem(422, "validation.failed", "พิมพ์อย่างน้อย 2 ตัวอักษร");
    const limit = Math.min(Number(query.limit ?? 10), 20);
    const data = searchIndex
      .filter(
        (entry) =>
          can(persona, entry.permission) && matchesQuery(q, entry.code, entry.title, entry.subtitle, entry.keywords),
      )
      .slice(0, limit)
      .map(({ type, id, code, title, subtitle }) => ({ type, id, code, title, subtitle }));
    return { data };
  }),

  published.get("/v1/admin/dashboard", null, ({ persona }) => ({
    queues: dashboardFor(persona),
    generatedAt: bangkokIso(),
  })),

  published.get("/v1/admin/sod-rules", "users.read", () => [...SOD_RULES].sort((a, b) => a.key.localeCompare(b.key))),

  // admin.exports.create (U-B0.3): the list's rows as a file, behind the list's read permission and
  // `reports.export`; contact details are left out. The mock writes what search knows of each row.
  published.post("/v1/admin/exports", { permission: "reports.export" }, ({ body, persona }) => {
    const list = LIST_EXPORTS[body.resource];
    if (!list) return problem(422, "validation.failed", "resource ไม่ถูกต้อง");
    if (!can(persona, list.permission)) return problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ดูรายการนี้");
    const quote = (value: string | null | undefined) => `"${(value ?? "").replace(/"/g, '""')}"`;
    if (list.type === null) {
      const query = (body.query ?? {}) as Record<string, string>;
      const days = (d: string | undefined, plus = 0) =>
        d ? new Date(Date.parse(`${d}T00:00:00+07:00`) + plus * 86_400_000).toISOString() : null;
      const logRows = filterFileAccessLog((name) =>
        name === "from" ? days(query.from) : name === "to" ? days(query.to, 1) : (query[name] ?? null),
      );
      const logCsv = [
        "occurredAt,actor,orderCode,fileKind,purpose,reason",
        ...logRows.map((e) =>
          [e.occurredAt, e.actor.name, e.order?.orderCode, e.fileKind, e.purpose, e.reason].map(quote).join(","),
        ),
      ].join("\n");
      return {
        fileId: mockId("export", logRows.length + 1),
        url: `data:text/csv;charset=utf-8,${encodeURIComponent(logCsv)}`,
        rows: logRows.length,
        truncated: false,
        expiresAt: bangkokIso(5),
      };
    }
    const rows = searchIndex.filter((entry) => entry.type === list.type);
    const csv = ["code,title", ...rows.map((row) => `${quote(row.code)},${quote(row.title)}`)].join("\n");
    return {
      fileId: mockId("export", rows.length + 1),
      url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
      rows: rows.length,
      truncated: false,
      expiresAt: bangkokIso(5),
    };
  }),

  published.get("/v1/admin/staff-directory", null, ({ query }) => {
    if (query.q !== undefined && String(query.q).length < 2)
      return problem(422, "validation.failed", "พิมพ์อย่างน้อย 2 ตัวอักษร");
    return PERSONAS.filter(
      (persona) =>
        matchesQuery(query.q, persona.displayName) &&
        (!query.role || persona.roles.includes(query.role)) &&
        (!query.permission || can(persona, query.permission)),
    )
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "th"))
      .slice(0, Math.min(Number(query.limit ?? 50), 50))
      .map((persona) => ({ id: persona.id, displayName: persona.displayName, roles: [...persona.roles].sort() }));
  }),
];
