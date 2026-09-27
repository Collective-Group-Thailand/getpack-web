// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SPEC_VERSION } from "@packio/dieline";

import { handlers } from "../../../../mocks/handlers";
import { accessToken } from "../../../../mocks/support";
import { seedFromDesign } from "@/features/customer/configurator/state";
import type { DesignContent, DesignSpec } from "@/features/designer/types";
import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { createRequestClient } from "@/lib/api/requests/client";
import { REQUESTS } from "@/lib/api/requests/registry";

import { inferPrint, stateForDesign } from "./PriceWidget";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// Built per call: a client made before `server.listen()` would hold the unpatched `fetch`.
const client = (audience?: "customer" | "staff", persona?: string) =>
  createRequestClient(
    REQUESTS,
    createApiClient({
      baseUrl: "http://api.mock",
      ...(audience ? { accessToken: accessToken(audience, persona) } : {}),
    }) as unknown as Client<never>,
  );
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (isApiError(error) ? error : Promise.reject(error)),
  );

const spec: DesignSpec = {
  specVersion: SPEC_VERSION,
  styleId: "tuck-end",
  values: { length: 70, width: 40, height: 150 },
  material: { caliperMm: 0.45, kind: "paperboard" },
  materialId: null,
};
const blank: DesignContent = {
  elements: [],
  pattern: { kind: "none", color: "#000000", background: "#ffffff", size: 12 },
};
const document = {
  schemaVersion: 2,
  spec: spec as unknown as Record<string, unknown>,
  content: blank as unknown as Record<string, unknown>,
};

describe("store.designs (mock)", () => {
  it("creates, saves under If-Match, refuses a stale save with 412, and keeps every version", async () => {
    const api = client("customer");
    const created = await api.read("POST /v1/store/designs", {
      body: { name: "กล่องทดสอบ", document, source: "blank" },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(created.etag).toBe('"v1"');
    const id = created.data.id;

    const saved = await api.read("PUT /v1/store/designs/{designId}", {
      path: { designId: id },
      body: { name: "กล่องทดสอบ", document, kind: "autosave" },
      etag: created.etag!,
    });
    expect(saved.data.versionNo).toBe(2);
    expect(saved.etag).toBe('"v2"');

    // Another tab saving from version 1 again is refused, not merged.
    const stale = await failure(
      api.call("PUT /v1/store/designs/{designId}", {
        path: { designId: id },
        body: { name: "จากแท็บอื่น", document, kind: "manual" },
        etag: created.etag!,
      }),
    );
    expect(stale?.status).toBe(412);
    expect(stale?.code).toBe("concurrency.stale");

    const versions = await api.call("GET /v1/store/designs/{designId}/versions", { path: { designId: id } });
    expect(versions.data.map((v) => v.versionNo)).toEqual([2, 1]);

    const restored = await api.read("POST /v1/store/designs/{designId}/versions/{versionNo}/actions/restore", {
      path: { designId: id, versionNo: "1" },
      etag: saved.etag!,
    });
    expect(restored.data.versionNo).toBe(3);
  });

  it("hides another customer's design and replays an import by local id", async () => {
    const mine = await client("customer").call("POST /v1/store/designs", {
      body: { name: "ของฉัน", document, source: "blank" },
      idempotencyKey: crypto.randomUUID(),
    });
    const theirs = await failure(
      client("customer", "receiver").call("GET /v1/store/designs/{designId}", { path: { designId: mine.id } }),
    );
    expect(theirs?.status).toBe(404);

    const body = {
      designs: [
        {
          localId: "abc123",
          name: "จากเบราว์เซอร์",
          document,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    const first = await client("customer").call("POST /v1/store/designs/actions/import", {
      body,
      idempotencyKey: crypto.randomUUID(),
    });
    const again = await client("customer").call("POST /v1/store/designs/actions/import", {
      body,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(again.imported[0]!.designId).toBe(first.imported[0]!.designId);
  });

  it("serves the designer catalogue publicly, with calipers and flute allowances", async () => {
    const catalog = await client().call("GET /v1/store/designer/catalog", { query: {} });
    expect(catalog.materials.length).toBeGreaterThan(0);
    const flute = catalog.materials.find((m) => m.kind === "corrugated");
    expect(flute?.caliperMm).toBeGreaterThan(1);
    expect(flute?.allowances?.panel).not.toBeNull();
    expect(catalog.rules.bleedMm).toBe(3);
  });
});

describe("the price widget's reading of a design", () => {
  it("infers print from the artwork: nothing, flat colours, or full colour", () => {
    expect(inferPrint(blank)).toEqual({ printed: false, colours: 0 });
    const text = {
      id: "t",
      type: "text" as const,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      text: "a",
      fontSize: 5,
      fontFamily: "x",
      fontStyle: "normal" as const,
      fill: "#112233",
      align: "left" as const,
    };
    expect(inferPrint({ ...blank, elements: [text] })).toEqual({ printed: true, colours: 1 });
    const image = {
      id: "i",
      type: "image" as const,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      src: "data:",
      width: 10,
      height: 10,
    };
    expect(inferPrint({ ...blank, elements: [text, image] })).toEqual({ printed: true, colours: 4 });
  });

  it("maps a design onto the product's configurator: size, material, print that covers the artwork", async () => {
    const configurator = await client().call("GET /v1/store/catalog/products/{slug}/configurator", {
      path: { slug: "tuck-end-box" },
    });
    const material = configurator.groups.find((g) => g.kind === "material")!.options.at(-1)!;
    const state = stateForDesign(configurator, { ...spec, materialId: material.id }, blank, 1000);
    expect(state.dims).toMatchObject({ l: 70, w: 40, d: 150 });
    expect(state.choices.material).toEqual([material.id]);
    expect(state.quantity).toBe(1000);

    const seed = seedFromDesign(configurator, { l: "70", w: "40", d: "150", material: material.id });
    expect(seed?.choices?.material).toEqual([material.id]);
    expect(seedFromDesign(configurator, {})).toBeUndefined();
  });
});
