import { readFileSync } from "node:fs";

import { describe, expect, expectTypeOf, it } from "vitest";

import { createApiClient } from "../client";
import { createRequestClient } from "./client";
import { REQUESTS, type RequestKey } from "./registry";
import type { Client } from "openapi-fetch";

const contract = JSON.parse(readFileSync(`${process.cwd()}/contract/openapi.json`, "utf8")) as {
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
      .map(([method, path]) => `${method} ${path}`);
    expect(shipped).toEqual([]);
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
    for (const [key, definition] of entries) {
      if (definition.public) expect(key.startsWith("GET /v1/store/"), key).toBe(true);
    }
  });

  it("marks only mutations idempotent", () => {
    for (const [key, definition] of entries) {
      if (definition.idempotent) expect(key.startsWith("GET "), key).toBe(false);
    }
  });
});

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
    return { seen, requests: createRequestClient(REQUESTS, client as unknown as Client<never>) };
  }

  it("fills path parameters and sends the idempotency key it was given", async () => {
    const { seen, requests } = recorder();
    await requests.call("POST /v1/admin/imports/{importId}/actions/apply", {
      path: { importId: "0192f3a0-7c1e-7d2a-9b1f-00000000a001" },
      idempotencyKey: "k-1",
    });

    expect(seen[0]?.url).toBe(
      "https://api.example/v1/admin/imports/0192f3a0-7c1e-7d2a-9b1f-00000000a001/actions/apply",
    );
    expect(seen[0]?.headers.get("Idempotency-Key")).toBe("k-1");
  });

  it("reads the ETag for an edit and sends it back as If-Match", async () => {
    const { seen, requests } = recorder();
    const campaignId = "0192f3a0-7c1e-7d2a-9b1f-00000000a002";
    const { etag } = await requests.read("GET /v1/admin/campaigns/{campaignId}", { path: { campaignId } });
    await requests.call("PATCH /v1/admin/campaigns/{campaignId}", {
      path: { campaignId },
      body: { name: "ใหม่" },
      etag: etag!,
    });

    expect(etag).toBe('W/"v1"');
    expect(seen[1]?.headers.get("If-Match")).toBe('W/"v1"');
  });

  it("drops empty filters instead of sending them as empty strings", async () => {
    const { seen, requests } = recorder();
    await requests.call("GET /v1/admin/saved-views", { query: { resource: "order" } });
    await requests.call("GET /v1/admin/search", { query: { q: "PK", limit: undefined } });

    expect(new URL(seen[0]!.url).search).toBe("?resource=order");
    expect(new URL(seen[1]!.url).search).toBe("?q=PK");
  });

  it("is typed by the registry", () => {
    const { requests } = recorder();
    type Views = Awaited<ReturnType<typeof requests.call<"GET /v1/admin/saved-views">>>;
    expectTypeOf<Views["data"][number]["name"]>().toEqualTypeOf<string>();
    type Deleted = Awaited<ReturnType<typeof requests.call<"DELETE /v1/admin/saved-views/{viewId}">>>;
    expectTypeOf<Deleted>().toEqualTypeOf<void>();

    // Compile-time guarantees, checked by `pnpm typecheck` rather than at runtime:
    const never = () => {
      // @ts-expect-error — an irreversible action needs the caller's idempotency key
      void requests.call("POST /v1/admin/imports/{importId}/actions/apply", { path: { importId: "x" } });
      // @ts-expect-error — a path parameter cannot be forgotten
      void requests.call("GET /v1/admin/imports/{importId}");
      // @ts-expect-error — neither can a body
      void requests.call("POST /v1/admin/saved-views");
      // @ts-expect-error — nor can a key be misspelt
      void requests.call("GET /v1/admin/saved-view");
    };
    expect(typeof never).toBe("function");
  });
});
