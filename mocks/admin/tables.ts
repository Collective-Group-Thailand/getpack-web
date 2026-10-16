/**
 * A stateful mock for one published CRUD table (getpack-api B2.1's catalogue, CMS and geography):
 * list with the standard query, create, read with an `ETag`, and `PATCH` guarded by `If-Match`
 * — `428` without it, `412` when it is stale — exactly the contract's rules. Rows are archived
 * through `status`, never deleted, unless the contract gives the table a `DELETE`.
 *
 * Rows seed from the contract's own list examples (`mocks/generated/examples.ts`), whose ids
 * already point at each other, plus a few obviously fake variants per table.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import { LIST_EXAMPLES } from "../generated/examples";
import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";

export type Row = { id: string; updatedAt: string } & Record<string, unknown>;

export interface TableConfig {
  /** The collection path, e.g. `/v1/admin/catalog/materials`. */
  path: string;
  read: string;
  manage: string;
  /** Short id namespace for created rows. */
  ns: string;
  /** Fields `q` matches. */
  search: readonly string[];
  /** Query keys that filter by equality on the field of the same name. */
  filters?: readonly string[];
  /** A field that must be unique (a code, a slug, a key). */
  unique?: string;
  /** Variants of the first example row: each is merged over it with a fresh id. */
  variants?: readonly Record<string, unknown>[];
  /** Extra rows written out in full. */
  rows?: readonly Row[];
  /** Seed from the contract's list example too (default). Off when `rows` is the whole table. */
  examples?: boolean;
  /** The contract gives this table a `DELETE`. */
  deletable?: boolean;
  defaultSort?: string;
}

export const etagOf = (row: Row) => `W/"${Date.parse(row.updatedAt).toString(36)}-${row.id.slice(-6)}"`;

export function seedRows(config: TableConfig): Row[] {
  const examples = config.examples === false ? [] : ((LIST_EXAMPLES[config.path] ?? []) as Row[]);
  const base = examples[0];
  const variants: Row[] = base
    ? (config.variants ?? []).map((variant, index) => ({
        ...base,
        ...variant,
        id: (variant.id as string | undefined) ?? mockId(config.ns, index + 1),
        updatedAt: bangkokIso(-(index + 2) * 60 * 24),
      }))
    : [];
  return [...examples.map((row) => ({ ...row })), ...variants, ...(config.rows ?? []).map((row) => ({ ...row }))];
}

/** The store and the handlers for one table. `rows` is exported so other mocks can read it. */
export function table(config: TableConfig): { rows: Row[]; handlers: HttpHandler[] } {
  const rows = seedRows(config);
  let seq = 1000;
  const item = `*${config.path}/:id`;
  const find = (id: unknown) => rows.find((row) => row.id === id);
  const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
  const notFound = () => problem(404, "http.not_found", "ไม่พบรายการนี้");
  const withEtag = (row: Row, status = 200) => HttpResponse.json(row, { status, headers: { ETag: etagOf(row) } });

  const duplicate = (body: Record<string, unknown>, self?: Row) =>
    config.unique &&
    body[config.unique] !== undefined &&
    rows.some((row) => row !== self && row[config.unique!] === body[config.unique!]);

  const handlers: HttpHandler[] = [
    http.get(`*${config.path}`, ({ request }) => {
      if (!can(staffPersonaOf(request), config.read)) return forbidden();
      const url = new URL(request.url);
      const q = url.searchParams.get("q") ?? undefined;
      let result = rows.filter((row) => matchesQuery(q, ...config.search.map((field) => String(row[field] ?? ""))));
      for (const key of ["status", ...(config.filters ?? [])]) {
        const value = url.searchParams.get(key);
        if (value) result = result.filter((row) => String(row[key] ?? "") === value);
      }
      const sort = url.searchParams.get("sort") ?? config.defaultSort;
      const order = (url.searchParams.get("order") as "asc" | "desc" | null) ?? "asc";
      return HttpResponse.json(
        paginate(sortBy(result, sort ?? undefined, order), {
          page: Number(url.searchParams.get("page") ?? 1),
          perPage: Number(url.searchParams.get("perPage") ?? 25),
        }),
      );
    }),
    http.post(`*${config.path}`, async ({ request }) => {
      if (!can(staffPersonaOf(request), config.manage)) return forbidden();
      const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
      if (duplicate(body)) {
        return problem(409, "catalog.duplicate_key", `${String(body[config.unique!])} มีอยู่แล้ว`, [
          { path: config.unique!, code: "unique", message: "ซ้ำกับรายการที่มีอยู่" },
        ]);
      }
      const template = rows[0] ?? ({} as Row);
      const created: Row = {
        ...Object.fromEntries(Object.keys(template).map((key) => [key, Array.isArray(template[key]) ? [] : null])),
        status: "active",
        sort: 0,
        ...body,
        id: mockId(config.ns, seq++),
        updatedAt: bangkokIso(),
      };
      rows.push(created);
      return withEtag(created, 201);
    }),
    http.get(item, ({ request, params }) => {
      if (!can(staffPersonaOf(request), config.read)) return forbidden();
      const row = find(params.id);
      return row ? withEtag(row) : notFound();
    }),
    http.patch(item, async ({ request, params }) => {
      if (!can(staffPersonaOf(request), config.manage)) return forbidden();
      const row = find(params.id);
      if (!row) return notFound();
      const match = request.headers.get("if-match");
      if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
      if (match !== etagOf(row))
        return problem(412, "http.precondition_failed", "รายการนี้ถูกแก้ไขไปแล้ว กรุณาโหลดใหม่แล้วแก้อีกครั้ง");
      const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
      if (duplicate(body, row)) {
        return problem(409, "catalog.duplicate_key", `${String(body[config.unique!])} มีอยู่แล้ว`, [
          { path: config.unique!, code: "unique", message: "ซ้ำกับรายการที่มีอยู่" },
        ]);
      }
      // A new timestamp even within the same millisecond, so the ETag always moves.
      const next = Math.max(Date.now(), Date.parse(row.updatedAt) + 1000);
      Object.assign(row, body, {
        id: row.id,
        updatedAt: `${new Date(next + 7 * 3_600_000).toISOString().slice(0, 19)}+07:00`,
      });
      return withEtag(row);
    }),
  ];

  if (config.deletable) {
    handlers.push(
      http.delete(item, ({ request, params }) => {
        if (!can(staffPersonaOf(request), config.manage)) return forbidden();
        const index = rows.findIndex((row) => row.id === params.id);
        if (index < 0) return notFound();
        const match = request.headers.get("if-match");
        if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
        if (match !== etagOf(rows[index]!)) return problem(412, "http.precondition_failed", "รายการนี้ถูกแก้ไขไปแล้ว");
        rows.splice(index, 1);
        return new HttpResponse(null, { status: 204 });
      }),
    );
  }

  return { rows, handlers };
}
