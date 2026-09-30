/**
 * Requests for the back-office building blocks (F2 2.1): saved views, global search, the
 * dashboard's queues and segregation-of-duties rules. The Excel import is the published
 * per-kind preview → confirm (`admin.catalogImports.*`); exports are per report
 * (`admin.reports.export`) — a generic list export is CONTRACT-GAP admin.exports.
 */

import { z } from "zod";

import { dateTime, request, userRef, uuid } from "./define";

/* -------------------------------------------------------------------------------- saved views */

export const savedView = z
  .object({
    id: uuid(),
    /** The list it belongs to — the resource key, e.g. `order`. */
    resource: z.string(),
    name: z.string(),
    /** The list's URL query: filters, sort, page size. Values as they appear in a URL. */
    query: z.record(z.string(), z.string()),
    /** Visible columns in order; `null` means the list's defaults. */
    columns: z.array(z.string()).nullable(),
    /** Visible to every staff member who can open the list, not only the owner. */
    shared: z.boolean(),
    owner: userRef(),
    createdAt: dateTime(),
  })
  .meta({ id: "SavedViewDto" });

export const createSavedView = z
  .object({
    resource: z.string().min(1),
    name: z.string().min(1).max(80),
    query: z.record(z.string(), z.string()),
    columns: z.array(z.string()).nullable(),
    shared: z.boolean(),
  })
  .meta({ id: "CreateSavedViewDto" });

/* ------------------------------------------------------------------------------------- search */

export const searchResultType = z
  .enum(["order", "order_group", "quote", "rfq", "customer", "company", "factory", "shipment", "claim", "user"])
  .meta({ id: "SearchResultType" });

export const searchResult = z
  .object({
    type: searchResultType,
    id: uuid(),
    /** The business key staff type: order code, company tax id, factory code. */
    code: z.string(),
    title: z.string(),
    subtitle: z.string().nullable(),
  })
  .meta({ id: "SearchResultDto" });

/* -------------------------------------------------------------------------------- dashboard */

export const queueSummary = z
  .object({
    /** Stable key, e.g. `orders.waiting_payment`; the frontend owns the label (like `MenuEntryDto`). */
    key: z.string(),
    /** Where the queue opens, host-absolute like `MenuEntryDto.path`. */
    path: z.string(),
    count: z.number().int(),
    /** Items already past their SLA — the API does the business-day maths. */
    overdueCount: z.number().int(),
    /** The earliest SLA deadline in the queue, for the "next due" hint. */
    nextDueAt: dateTime().nullable(),
  })
  .meta({ id: "QueueSummaryDto" });

export const dashboard = z
  .object({
    /** Only the queues this actor may work, in the order the API chooses. */
    queues: z.array(queueSummary),
    generatedAt: dateTime(),
  })
  .meta({ id: "AdminDashboardDto" });

/* ------------------------------------------------------------------------ segregation of duties */

export const sodRule = z
  .object({
    id: uuid(),
    kind: z.enum(["role_pair", "action_pair"]).meta({ id: "SodRuleKind" }),
    /** Role keys for `role_pair`, action keys for `action_pair`. */
    left: z.string(),
    right: z.string(),
    enforcement: z.enum(["block", "warn"]).meta({ id: "SodEnforcement" }),
    description: z.string(),
    decisions: z.array(z.string()),
  })
  .meta({ id: "SodRuleDto" });

/* ------------------------------------------------------------------------------ staff directory */

export const staffRef = z
  .object({ id: uuid(), displayName: z.string(), roles: z.array(z.string()) })
  .meta({ id: "StaffDirectoryEntryDto" });

/* ----------------------------------------------------------------------------------- requests */

export const adminConsoleRequests = {
  "GET /v1/admin/saved-views": request({
    request: "admin.saved-views",
    summary: "My saved views and the shared ones, for one list",
    query: z.object({ resource: z.string() }),
    response: z.object({ data: z.array(savedView) }),
  }),
  "POST /v1/admin/saved-views": request({
    request: "admin.saved-views",
    summary: "Save the current filters, sort and columns of a list",
    body: createSavedView,
    response: savedView,
    status: 201,
  }),
  "DELETE /v1/admin/saved-views/{viewId}": request({
    request: "admin.saved-views",
    summary: "Delete one of my saved views",
    status: 204,
  }),
  "GET /v1/admin/search": request({
    request: "admin.search",
    summary: "Jump to a record by code, phone, e-mail or name (the command palette)",
    query: z.object({ q: z.string().min(2), limit: z.coerce.number().int().max(20).optional() }),
    response: z.object({ data: z.array(searchResult) }),
  }),
  "GET /v1/admin/dashboard": request({
    request: "admin.dashboard",
    summary: "The work queues this actor may work, with counts and SLA state",
    response: dashboard,
  }),
  "GET /v1/admin/staff-directory": request({
    request: "admin.staff-directory",
    summary: "Active staff by name, for pickers: delegate an approval, assign a queue item, @mention",
    query: z.object({
      q: z.string().optional(),
      role: z.string().optional(),
      /** Only people who hold this permission — "who can take this RFQ". */
      permission: z.string().optional(),
      limit: z.coerce.number().int().max(50).optional(),
    }),
    response: z.object({ data: z.array(staffRef) }),
  }),
  "GET /v1/admin/sod-rules": request({
    request: "admin.sod-rules",
    summary: "Segregation-of-duties rules, so a role grant can warn before it is refused",
    decisions: ["D-140", "D-168"],
    response: z.object({ data: z.array(sodRule) }),
  }),
} as const;
