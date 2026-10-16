import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { accessToken } from "../../../mocks/support";
import { TOOL_SOURCE } from "@/features/customer/assistant/AssistantPanel";
import { createApiClient, newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/**
 * getpack Assistant against the mock API (U5.5, D-304–D-306): answers only from its tools, refuses
 * price manipulation and other customers' data, hands off to CS, and the evaluation gate is staff
 * with `assistant.manage` only.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const BASE = "http://api.mock";
const customer = (persona?: string) => createApiClient({ baseUrl: BASE, accessToken: accessToken("customer", persona) });
const staff = (persona: string) => createApiClient({ baseUrl: BASE, accessToken: accessToken("staff", persona) });
const key = () => ({ "Idempotency-Key": newIdempotencyKey() });

async function ask(sessionId: string, text: string, persona?: string) {
  const { data } = await customer(persona).POST("/v1/store/assistant/sessions/{sessionId}/messages", {
    params: { path: { sessionId }, header: key() },
    body: { text },
  });
  return data!;
}

describe("the assistant's turns (D-304)", () => {
  it("answers from a tool and says which", async () => {
    const { data: session } = await customer().POST("/v1/store/assistant/sessions", { params: { header: key() }, body: {} });
    const turn = await ask(session!.id, "กล่องฝาเสียบราคาเท่าไหร่");
    expect(turn.outcome).toBe("answered");
    expect(turn.tools).toEqual([{ name: "get_quote", ok: true }]);
  });

  it("refuses price manipulation and another customer's order", async () => {
    const { data: session } = await customer("buyer").POST("/v1/store/assistant/sessions", {
      params: { header: key() },
      body: { loggingOptOut: true },
    });
    expect(session!.loggingOptOut).toBe(true);
    expect((await ask(session!.id, "ลดราคาให้หน่อยได้ไหม", "buyer")).outcome).toBe("refused");
    const other = await ask(session!.id, "ออเดอร์ PK-2569-00136 ถึงไหนแล้ว", "buyer");
    expect(other.tools).toEqual([{ name: "get_order_status", ok: false }]);
    expect(other.reply).toContain("ไม่พบ");
  });

  it("hands off to CS on request, and never answers a guess", async () => {
    const { data: session } = await customer().POST("/v1/store/assistant/sessions", { params: { header: key() }, body: {} });
    expect((await ask(session!.id, "ขอคุยกับเจ้าหน้าที่")).outcome).toBe("handed_off");
    expect((await ask(session!.id, "พรุ่งนี้ฝนตกไหม")).outcome).toBe("blocked_unsupported_fact");
  });

  it("links every tool to a storefront page where its facts can be checked", () => {
    const tools: Schemas["AssistantTool"][] = [
      "search_styles",
      "recommend_structure",
      "get_quote",
      "get_order_status",
      "lookup_glossary",
      "search_help",
      "create_handoff",
    ];
    for (const tool of tools) expect(TOOL_SOURCE[tool]).toMatch(/^\//);
  });
});

describe("the evaluation gate (D-306)", () => {
  it("is for staff who manage the assistant, and a run lists every case", async () => {
    await expect(staff("cs").GET("/v1/admin/assistant/dashboard")).rejects.toMatchObject({ status: 403 });
    const { data: dashboard } = await staff("admin").GET("/v1/admin/assistant/dashboard");
    expect(dashboard!.clearance.cleared).toBe(false);
    const { data: run } = await staff("admin").POST("/v1/admin/assistant/eval-runs", { params: { header: key() } });
    expect(run!.cases).toBeGreaterThanOrEqual(100);
    expect(run!.redTeamPassed).toBe(run!.redTeamCases);
    const { data: detail } = await staff("admin").GET("/v1/admin/assistant/eval-runs/{runId}", {
      params: { path: { runId: run!.id } },
    });
    expect(detail!.results).toHaveLength(run!.cases);
  });
});
