/**
 * Mocks for the back-office building blocks — every one a contract request, so every one goes
 * through `mockRequest` and is held to its schema.
 */

import type { z } from "zod";

import type { savedView, searchResult, importJob, queueSummary } from "@/lib/api/requests/admin-console";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, problem } from "../support";
import { approvals, mayDecide, SOD_RULES, users } from "./platform";

type SavedView = z.output<typeof savedView>;
type SearchResult = z.output<typeof searchResult>;
type ImportJob = z.output<typeof importJob>;
type Queue = z.output<typeof queueSummary>;

/* --------------------------------------------------------------------------- search index */

/**
 * What ⌘K can find. Each domain's mocks add their records here, so search covers whatever the
 * mock API holds without this file knowing every domain.
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
 * The dashboard's queues, each gated on the permission that lets someone work it. Counts are
 * functions so the domain mocks can report live numbers once they exist.
 */
export const queueRegistry: { permission: string; queue: (persona: StaffPersona) => Queue | null }[] = [];

export function registerQueue(permission: string, queue: (persona: StaffPersona) => Queue | null) {
  queueRegistry.push({ permission, queue });
}

/** Approvals waiting on this person, the inbox as a queue (D-052, D-121, D-022 …). */
registerQueue("approvals.act", (persona) => {
  const waiting = approvals.filter((item) => mayDecide(item, persona));
  const due = waiting.flatMap((item) =>
    item.steps.filter((step) => step.stepNo === item.currentStepNo && step.dueAt).map((step) => step.dueAt!),
  );
  return {
    key: "approvals.inbox",
    path: "/admin/approvals",
    count: waiting.length,
    overdueCount: due.filter((at) => Date.parse(at) < Date.now()).length,
    nextDueAt: due.sort()[0] ?? null,
  };
});

/* ----------------------------------------------------------------------- saved views */

const savedViews: SavedView[] = [];

/* ------------------------------------------------------------------------------ imports */

const imports = new Map<string, ImportJob>();

function previewFor(resource: string): ImportJob["preview"] {
  return [
    {
      rowNo: 4,
      action: "skip",
      values: { code: "", name: "แถวที่ไม่มีรหัส" },
      errors: [{ column: "code", message: "ต้องระบุรหัส" }],
    },
    {
      rowNo: 2,
      action: "create",
      values: { code: `${resource.toUpperCase()}-NEW-01`, name: "รายการใหม่ (ข้อมูลจำลอง)" },
      errors: [],
    },
    {
      rowNo: 3,
      action: "update",
      values: { code: `${resource.toUpperCase()}-0001`, name: "รายการเดิม ปรับราคา (ข้อมูลจำลอง)" },
      errors: [],
    },
  ];
}

export const consoleHandlers = [
  mockRequest("GET /v1/admin/saved-views", ({ query, request }) => {
    const persona = staffPersonaOf(request);
    return {
      data: savedViews.filter(
        (view) => view.resource === query.resource && (view.shared || view.owner.id === persona?.id),
      ),
    };
  }),
  mockRequest("POST /v1/admin/saved-views", ({ body, request }) => {
    const persona = staffPersonaOf(request)!;
    const view: SavedView = {
      ...body,
      id: mockId("view", savedViews.length + 1),
      owner: { id: persona.id, displayName: persona.displayName },
      createdAt: bangkokIso(),
    };
    savedViews.push(view);
    return view;
  }),
  mockRequest("DELETE /v1/admin/saved-views/{viewId}", ({ params, request }) => {
    const persona = staffPersonaOf(request);
    const index = savedViews.findIndex((view) => view.id === params.viewId);
    if (index < 0) return problem(404, "http.not_found", "ไม่พบมุมมองนี้");
    if (savedViews[index]!.owner.id !== persona?.id) return problem(403, "auth.forbidden", "ลบได้เฉพาะมุมมองของคุณ");
    savedViews.splice(index, 1);
  }),

  mockRequest("GET /v1/admin/search", ({ query, request }) => {
    const persona = staffPersonaOf(request);
    const data = searchIndex
      .filter(
        (entry) =>
          can(persona, entry.permission) &&
          matchesQuery(query.q, entry.code, entry.title, entry.subtitle, entry.keywords),
      )
      .slice(0, query.limit ?? 10)
      .map(({ permission, keywords, ...result }) => {
        void permission;
        void keywords;
        return result;
      });
    return { data };
  }),

  mockRequest("GET /v1/admin/dashboard", ({ request }) => {
    const persona = staffPersonaOf(request);
    return {
      queues: persona
        ? queueRegistry
            .filter((entry) => can(persona, entry.permission))
            .map((entry) => entry.queue(persona))
            .filter((queue): queue is Queue => queue !== null)
        : [],
      generatedAt: bangkokIso(),
    };
  }),

  mockRequest("GET /v1/admin/sod-rules", () => ({ data: SOD_RULES })),

  mockRequest("POST /v1/admin/imports", ({ body }) => {
    const job: ImportJob = {
      id: mockId("imp", imports.size + 1),
      resource: body.resource,
      status: "ready",
      fileName: "import.xlsx",
      totals: { rows: 3, create: 1, update: 1, invalid: 1 },
      preview: previewFor(body.resource),
      createdAt: bangkokIso(),
      appliedAt: null,
    };
    imports.set(job.id, job);
    return job;
  }),
  mockRequest(
    "GET /v1/admin/imports/{importId}",
    ({ params }) => imports.get(params.importId!) ?? problem(404, "http.not_found", "ไม่พบงานนำเข้านี้"),
  ),
  mockRequest("POST /v1/admin/imports/{importId}/actions/apply", ({ params }) => {
    const job = imports.get(params.importId!);
    if (!job) return problem(404, "http.not_found", "ไม่พบงานนำเข้านี้");
    if (job.status !== "ready") return problem(409, "import.not_ready", "งานนำเข้านี้ยังไม่พร้อมหรือถูกนำเข้าไปแล้ว");
    Object.assign(job, { status: "applied", appliedAt: bangkokIso() });
    return job;
  }),

  mockRequest("POST /v1/admin/exports", ({ body }) => ({
    fileId: mockId("exp", 1),
    url: `data:text/csv;charset=utf-8,${encodeURIComponent(`resource,${body.resource}\nfilters,${JSON.stringify(body.query).replaceAll(",", ";")}`)}`,
    expiresAt: bangkokIso(5),
    rows: 1,
    truncated: false,
  })),
];

consoleHandlers.push(
  mockRequest("GET /v1/admin/staff-directory", ({ query }) => ({
    data: PERSONAS.filter(
      (persona) => matchesQuery(query.q, persona.displayName, persona.email) && (!query.role || persona.roles.includes(query.role)),
    )
      .slice(0, query.limit ?? 20)
      .map((persona) => ({ id: persona.id, displayName: persona.displayName, roles: persona.roles })),
  })),
);
