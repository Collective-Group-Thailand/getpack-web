/**
 * Mocks for the back-office building blocks — every one a contract request, so every one goes
 * through `mockRequest` and is held to its schema.
 */

import type { z } from "zod";

import type { queueSummary, savedView, searchResult } from "@/lib/api/requests/admin-console";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, problem } from "../support";
import { approvals, mayDecide, SOD_RULES, users } from "./platform";

type SavedView = z.output<typeof savedView>;
type SearchResult = z.output<typeof searchResult>;
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
];

consoleHandlers.push(
  mockRequest("GET /v1/admin/staff-directory", ({ query }) => ({
    data: PERSONAS.filter(
      (persona) =>
        matchesQuery(query.q, persona.displayName, persona.email) &&
        (!query.role || persona.roles.includes(query.role)) &&
        (!query.permission || can(persona, query.permission)),
    )
      .slice(0, query.limit ?? 20)
      .map((persona) => ({ id: persona.id, displayName: persona.displayName, roles: persona.roles })),
  })),
);
