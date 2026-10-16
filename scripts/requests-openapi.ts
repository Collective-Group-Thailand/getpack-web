/**
 * Renders the contract-request registry (`src/lib/api/requests`) as an OpenAPI 3.1 document —
 * `docs/contract-requests.openapi.json`, the handoff to getpack-api.
 *
 * The backend owns the contract (api-conventions §1); this document is a *request*, never a
 * contract. It exists so the backend can diff what it builds against what the frontend asked
 * for, operation by operation, instead of reading prose. Named zod schemas (`.meta({ id })`)
 * become `components.schemas`, which is the convention the real contract follows.
 */

import { z } from "zod";

import type { RequestDefinition } from "../src/lib/api/requests/define";
import { isStillOpen } from "../src/lib/api/requests/awaiting-triage";
import { REQUESTS } from "../src/lib/api/requests/registry";

type JsonSchema = Record<string, unknown>;

/** `#/$defs/Foo` → `#/components/schemas/Foo`, recursively, and hoist the `$defs`. */
function hoist(schema: JsonSchema, components: Record<string, JsonSchema>): JsonSchema {
  const defs = (schema.$defs ?? {}) as Record<string, JsonSchema>;
  for (const [name, definition] of Object.entries(defs)) components[name] = rewrite(definition) as JsonSchema;
  const { $defs, $schema, ...rest } = schema;
  void $defs;
  void $schema;
  return rewrite(rest) as JsonSchema;
}

function rewrite(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rewrite);
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && typeof value === "string") out[key] = value.replace("#/$defs/", "#/components/schemas/");
    // zod spells uuid as a format *and* a long regex; the format is the part that means something.
    else if (key === "pattern" && (node as Record<string, unknown>).format === "uuid") continue;
    else out[key] = rewrite(value);
  }
  return out;
}

function toSchema(schema: z.ZodType, io: "input" | "output", components: Record<string, JsonSchema>): JsonSchema {
  return hoist(z.toJSONSchema(schema, { io, unrepresentable: "any" }) as JsonSchema, components);
}

const problem = {
  description: "Problem details (api-conventions §3)",
  content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } },
};

const camel = (text: string) => text.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** `DELETE /v1/admin/saved-views/{viewId}` → `admin.savedViews.delete`, as api-conventions §5 spells ids. */
export function operationId(method: string, path: string): string {
  const [, , surface = "", ...rest] = path.split("/");
  const segments = rest.filter((segment) => !segment.startsWith("{"));
  const actionAt = segments.indexOf("actions");
  if (actionAt >= 0) {
    const resource = segments.slice(0, actionAt).map(camel).join(".");
    return `${surface}.${resource}.${camel(segments[actionAt + 1] ?? "act")}`;
  }
  const resource = segments.map(camel).join(".");
  const endsWithId = rest.at(-1)?.startsWith("{") ?? false;
  const verb = { GET: endsWithId ? "get" : "list", POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" }[
    method
  ];
  return `${surface}.${resource}.${verb ?? method.toLowerCase()}`;
}

const byPath = (key: string) => `${key.split(" ")[1]} ${key.split(" ")[0]}`;

export function buildRequestsDocument(): string {
  const components: Record<string, JsonSchema> = {};
  const paths: Record<string, Record<string, unknown>> = {};

  // Only what getpack-api still has to build (U1 U-F0.1): a request it has published — as asked
  // or in another shape — is its contract now, even while a screen still calls the definition.
  const entries = (Object.entries(REQUESTS) as [string, RequestDefinition][]).filter(([key]) => isStillOpen(key));
  for (const [key, definition] of entries.sort(([a], [b]) => byPath(a).localeCompare(byPath(b)))) {
    const [method, path] = key.split(" ") as [string, string];
    const parameters: unknown[] = [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
      name,
      in: "path",
      required: true,
      // Public ids are uuids (api-conventions §3); a slug or a business key is plain text.
      schema: name.endsWith("Id") ? { type: "string", format: "uuid" } : { type: "string" },
    }));

    if (definition.query) {
      const query = toSchema(definition.query, "input", components);
      const required = new Set((query.required as string[] | undefined) ?? []);
      for (const [name, schema] of Object.entries((query.properties ?? {}) as Record<string, unknown>)) {
        parameters.push({ name, in: "query", required: required.has(name), schema });
      }
    }
    if (definition.idempotent) {
      parameters.push({
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: { type: "string", format: "uuid" },
      });
    }
    if (definition.concurrency) {
      parameters.push({ name: "If-Match", in: "header", required: true, schema: { type: "string" } });
    }

    const status = String(definition.status ?? 200);
    const operation: Record<string, unknown> = {
      operationId: operationId(method, path),
      summary: definition.summary,
      tags: [path.split("/")[2]],
      "x-contract-request": definition.request,
      ...(definition.decisions ? { "x-decisions": definition.decisions } : {}),
      // `@Public()`: anonymous, or the customer's own token (the contract's `[{}, {customer}]`).
      ...(definition.public ? { security: [{}, { customer: [] }] } : {}),
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(definition.body
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: toSchema(definition.body, "input", components) } },
            },
          }
        : {}),
      responses: {
        [status]: definition.response
          ? {
              description: definition.summary,
              content: { "application/json": { schema: toSchema(definition.response, "output", components) } },
            }
          : { description: definition.summary },
        "4XX": problem,
      },
    };

    paths[path] = { ...(paths[path] ?? {}), [method.toLowerCase()]: operation };
  }

  components.ProblemDetails = { description: "As defined in contract/openapi.json (api-conventions §3)." };

  const document = {
    openapi: "3.1.0",
    info: {
      title: "getpack-web contract requests",
      version: "requested",
      description:
        "Endpoints getpack-web needs and getpack-api has not published: the operations its triage (src/lib/api/requests/triage.ts, from getpack-api docs/contract-requests-triage.md) marks `implement here`, plus any written since the triage. A request, not a contract: the backend owns the contract (api-conventions §1). The why for each operation is its row in docs/contract-requests.md (`x-contract-request`). Generated by `pnpm gen:api` from src/lib/api/requests — do not edit.",
    },
    paths,
    components: { schemas: Object.fromEntries(Object.entries(components).sort(([a], [b]) => a.localeCompare(b))) },
  };

  return `${JSON.stringify(document, null, 2)}\n`;
}
