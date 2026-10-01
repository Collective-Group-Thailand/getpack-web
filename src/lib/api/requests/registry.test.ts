import { readFileSync } from "node:fs";

import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { createApiClient } from "../client";
import { createRequestClient } from "./client";
import { request } from "./define";
import { CUSTOMER_ZONE_PARKED, PUBLISHED_AWAITING_MIGRATION } from "./awaiting-migration";
import { AWAITING_TRIAGE, isStillOpen } from "./awaiting-triage";
import { REQUESTS, type RequestKey } from "./registry";
import { OPERATION_TRIAGE, REQUEST_TRIAGE } from "./triage";
import type { Client } from "openapi-fetch";

const contract = JSON.parse(readFileSync(`${process.cwd()}/contract/openapi.json`, "utf8")) as {
  paths: Record<string, Record<string, { operationId?: string }>>;
};
const requestsOpenApi = JSON.parse(readFileSync(`${process.cwd()}/docs/contract-requests.openapi.json`, "utf8")) as {
  paths: Record<string, Record<string, unknown>>;
};
const requestsDoc = readFileSync(`${process.cwd()}/docs/contract-requests.md`, "utf8");

const entries = Object.entries(REQUESTS) as [RequestKey, (typeof REQUESTS)[RequestKey]][];

describe("the contract-request registry", () => {
  it("holds nothing the backend has already shipped", () => {
    // The day packio-api publishes one of these, this fails and names it: delete the entry,
    // call browserApi/serverApi instead, and let the type errors say what the real shape changed.
    const shipped = entries
      .map(([key]) => key.split(" ") as [string, string])
      .filter(([method, path]) => contract.paths[path]?.[method.toLowerCase()] !== undefined)
      .map(([method, path]) => `${method} ${path}`)
      .filter((key) => !PUBLISHED_AWAITING_MIGRATION.includes(key));
    expect(shipped).toEqual([]);
  });

  it("keeps the published-awaiting-migration list shrinking", () => {
    // Every entry must still be a request and still be published — at its own path, or where the
    // triage says it was published instead; a migrated one is deleted from the registry and then
    // has to leave the list too.
    const stale = PUBLISHED_AWAITING_MIGRATION.filter((key) => {
      const [method, path] = key.split(" ") as [string, string];
      const verdict = OPERATION_TRIAGE[key]?.verdict;
      const published =
        contract.paths[path]?.[method.toLowerCase()] !== undefined ||
        verdict === "published" ||
        verdict === "published_differently";
      return !(key in REQUESTS) || !published;
    });
    expect(stale).toEqual([]);
    // U-F0.4 moved every zone onto contract v0.6.0; only the configurator parked for U2.F1 is left.
    expect(PUBLISHED_AWAITING_MIGRATION.length).toBeLessThanOrEqual(1);
  });

  it("leaves nothing published on a request but what is parked on purpose", () => {
    expect([...PUBLISHED_AWAITING_MIGRATION].sort()).toEqual([...CUSTOMER_ZONE_PARKED].sort());
  });

  /**
   * A zone's requests are only what packio-api has not built — verdict `implement`, `deferred` by
   * a decision, or written after the triage — plus the published ones still on the migration list.
   * Anything else is called through serverApi/browserApi with the generated types.
   */
  function offContract(surface: "store" | "admin" | "partner"): string[] {
    return entries
      .map(([key]) => key)
      .filter((key) => key.includes(` /v1/${surface}/`))
      .filter(
        (key) =>
          !["implement", "deferred"].includes(OPERATION_TRIAGE[key]?.verdict ?? "") && !AWAITING_TRIAGE.includes(key),
      )
      .filter((key) => !PUBLISHED_AWAITING_MIGRATION.includes(key));
  }

  it("keeps the customer zone on the published contract", () => {
    // U-F0.2, re-opened by v0.4.0 (U-F0.4).
    expect(offContract("store")).toEqual([]);
    // A parked operation is still a published one awaiting its screen, never a way to hide a new request.
    expect(CUSTOMER_ZONE_PARKED.filter((key) => !PUBLISHED_AWAITING_MIGRATION.includes(key))).toEqual([]);
  });

  it("keeps the admin zone on the published contract", () => {
    // U-F0.3, re-opened by v0.5.0 and v0.6.0 (U-F0.4).
    expect(offContract("admin")).toEqual([]);
  });

  it("keeps the partner zone on the published contract", () => {
    // U-F0.4.
    expect(offContract("partner")).toEqual([]);
  });

  it("spells every key as a method and a surface path template", () => {
    for (const [key] of entries) {
      expect(key).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \/v1\/(admin|store|partner)(\/[a-z0-9-]+|\/\{[a-zA-Z]+\})+$/);
    }
  });

  it("has a response exactly when the status is not 204", () => {
    for (const [key, definition] of entries) {
      const status = definition.status ?? 200;
      expect(Boolean(definition.response), key).toBe(status !== 204);
    }
  });

  it("points every entry at a row in docs/contract-requests.md", () => {
    // The markdown is where the backend reads *why*; an entry without a row is a request nobody
    // was told about.
    const missing = [...new Set(entries.map(([, definition]) => definition.request))].filter(
      (id) => !requestsDoc.includes(`| ${id} |`),
    );
    expect(missing).toEqual([]);
  });

  it("makes only store reads public", () => {
    // A read, or a side-effect-free store action like the published `store.quotes.calculate`
    // and `store.catalog.quotePath` (a promotion check posts its code rather than put it in a URL).
    for (const [key, definition] of entries) {
      if (definition.public) expect(/^(GET \/v1\/store\/|POST \/v1\/store\/.+\/actions\/)/.test(key), key).toBe(true);
    }
  });

  it("marks only mutations idempotent", () => {
    for (const [key, definition] of entries) {
      if (definition.idempotent) expect(key.startsWith("GET "), key).toBe(false);
    }
  });
});

describe("packio-api's triage (U1 U-F0.1)", () => {
  it("has a verdict for every request, or lists it as awaiting triage", () => {
    // A request written after the triage goes into awaiting-triage.ts; one nobody listed is a
    // request packio-api was never asked about.
    const unaccounted = entries
      .map(([key]) => key)
      .filter((key) => !OPERATION_TRIAGE[key] && !AWAITING_TRIAGE.includes(key));
    expect(unaccounted).toEqual([]);
  });

  it("lets awaiting-triage.ts hold only untriaged requests", () => {
    const stale = AWAITING_TRIAGE.filter((key) => !(key in REQUESTS) || OPERATION_TRIAGE[key] !== undefined);
    expect(stale).toEqual([]);
  });

  it("names, for every published verdict, an operation the pinned contract has", () => {
    // The mapping a screen follows when it migrates starts at this operationId; a verdict that
    // points at nothing in contract/openapi.json means the triage and the lock disagree.
    const dangling = Object.entries(OPERATION_TRIAGE)
      .filter(([, triage]) => triage.verdict === "published" || triage.verdict === "published_differently")
      .filter(([, triage]) => {
        const [method, path] = (triage.publishedAs ?? " ").split(" ") as [string, string];
        return contract.paths[path]?.[method.toLowerCase()]?.operationId !== triage.operationId;
      })
      .map(([key, triage]) => `${key} → ${triage.operationId} (${triage.publishedAs})`);
    expect(dangling).toEqual([]);
  });

  it("keeps every open row's status in docs/contract-requests.md in line with it", () => {
    // `pnpm gen:triage` writes these cells; a hand edit that contradicts the triage fails here.
    const prefix: Record<string, string> = {
      published: "Published as ",
      published_differently: "Published differently (see mapping)",
      implement: "Open — packio-api ",
      deferred: "Deferred by decision",
      mixed: "Mixed — ",
      reject: "Rejected",
    };
    const open = requestsDoc.split("\n## Resolved")[0]!;
    const wrong = [...open.matchAll(/^\| ([a-z][\w.-]+) \| \d{4}-\d{2}-\d{2} \|.*\| ([^|]+) \|$/gm)]
      .map(([, id, status]) => [id!, status!.trim()] as const)
      .filter(([id, status]) => {
        const triage = REQUEST_TRIAGE[id];
        const expected = triage
          ? prefix[triage.verdict]! + (triage.verdict === "implement" ? triage.group : "")
          : "Open — awaiting packio-api triage";
        return !status.startsWith(expected);
      })
      .map(([id, status]) => `${id}: ${status.slice(0, 60)}`);
    expect(wrong).toEqual([]);
  });

  it("hands packio-api only what it still has to build", () => {
    const handedOver = Object.entries(requestsOpenApi.paths).flatMap(([path, item]) =>
      Object.keys(item)
        .filter((method) => ["get", "post", "put", "patch", "delete"].includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`),
    );
    const open = entries.map(([key]) => key).filter((key) => isStillOpen(key));
    expect([...handedOver].sort()).toEqual([...open].sort());
  });
});

/**
 * The client's own behaviour, against a fixture registry rather than the live one: the live
 * registry only shrinks as packio-api ships (U-F0.4 leaves almost nothing in it), and these
 * properties hold for any request.
 */
const FIXTURE = {
  "POST /v1/admin/fixture-documents/{documentId}/actions/send": request({
    request: "fixture",
    summary: "An irreversible action with a path parameter",
    body: z.object({ channels: z.array(z.enum(["email", "line"])).min(1) }),
    response: z.object({ documentId: z.string() }),
    idempotent: true,
  }),
  "GET /v1/admin/fixture-views": request({
    request: "fixture",
    summary: "A read with filters",
    query: z.object({ resource: z.string(), q: z.string().optional(), limit: z.coerce.number().int().optional() }),
    response: z.object({ data: z.array(z.object({ id: z.string(), name: z.string() })) }),
  }),
  "POST /v1/admin/fixture-views": request({
    request: "fixture",
    summary: "A create with a body",
    body: z.object({ name: z.string() }),
    response: z.object({ id: z.string() }),
    status: 201,
  }),
  "PUT /v1/admin/fixture-views/{viewId}": request({
    request: "fixture",
    summary: "An edit of an aggregate, with If-Match",
    body: z.object({ name: z.string() }),
    response: z.object({ id: z.string() }),
    concurrency: true,
  }),
  "DELETE /v1/admin/fixture-views/{viewId}": request({
    request: "fixture",
    summary: "A delete",
    status: 204,
  }),
} as const;

describe("the request client", () => {
  function recorder() {
    const seen: Request[] = [];
    const client = createApiClient({
      baseUrl: "https://api.example",
      fetch: async (input: Request | string | URL) => {
        const request = input instanceof Request ? input : new Request(input);
        seen.push(request);
        return new Response(JSON.stringify({ data: [] }), {
          headers: { "content-type": "application/json", etag: 'W/"v1"' },
        });
      },
    });
    return { seen, requests: createRequestClient(FIXTURE, client as unknown as Client<never>) };
  }

  it("fills path parameters and sends the idempotency key it was given", async () => {
    const { seen, requests } = recorder();
    await requests.call("POST /v1/admin/fixture-documents/{documentId}/actions/send", {
      path: { documentId: "0192f3a0-7c1e-7d2a-9b1f-00000000a001" },
      body: { channels: ["email"] },
      idempotencyKey: "k-1",
    });

    expect(seen[0]?.url).toBe(
      "https://api.example/v1/admin/fixture-documents/0192f3a0-7c1e-7d2a-9b1f-00000000a001/actions/send",
    );
    expect(seen[0]?.headers.get("Idempotency-Key")).toBe("k-1");
  });

  it("reads the ETag for an edit and sends it back as If-Match", async () => {
    const { seen, requests } = recorder();
    const viewId = "0192f3a0-7c1e-7d2a-9b1f-00000000a002";
    const { etag } = await requests.read("GET /v1/admin/fixture-views", { query: { resource: "order" } });
    await requests.call("PUT /v1/admin/fixture-views/{viewId}", {
      path: { viewId },
      body: { name: "mine" },
      etag: etag!,
    });

    expect(etag).toBe('W/"v1"');
    expect(seen[1]?.url).toBe(`https://api.example/v1/admin/fixture-views/${viewId}`);
    expect(seen[1]?.headers.get("If-Match")).toBe('W/"v1"');
  });

  it("drops empty filters instead of sending them as empty strings", async () => {
    const { seen, requests } = recorder();
    await requests.call("GET /v1/admin/fixture-views", { query: { resource: "order" } });
    await requests.call("GET /v1/admin/fixture-views", { query: { resource: "order", q: "PK", limit: undefined } });

    expect(new URL(seen[0]!.url).search).toBe("?resource=order");
    expect(new URL(seen[1]!.url).search).toBe("?resource=order&q=PK");
  });

  it("is typed by the registry", () => {
    const { requests } = recorder();
    type Views = Awaited<ReturnType<typeof requests.call<"GET /v1/admin/fixture-views">>>;
    expectTypeOf<Views["data"][number]["name"]>().toEqualTypeOf<string>();
    type Deleted = Awaited<ReturnType<typeof requests.call<"DELETE /v1/admin/fixture-views/{viewId}">>>;
    expectTypeOf<Deleted>().toEqualTypeOf<void>();

    // Compile-time guarantees, checked by `pnpm typecheck` rather than at runtime:
    const never = () => {
      // @ts-expect-error — an irreversible action needs the caller's idempotency key
      void requests.call("POST /v1/admin/fixture-documents/{documentId}/actions/send", {
        path: { documentId: "x" },
        body: { channels: ["email"] },
      });
      // @ts-expect-error — a path parameter cannot be forgotten
      void requests.call("DELETE /v1/admin/fixture-views/{viewId}");
      // @ts-expect-error — neither can a body
      void requests.call("POST /v1/admin/fixture-views");
      // @ts-expect-error — nor can a key be misspelt
      void requests.call("GET /v1/admin/fixture-view");
    };
    expect(typeof never).toBe("function");
  });
});
