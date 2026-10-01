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

import { toCatalogView } from "@/features/designer/data/catalog-view";

import { inferPrint, stateForDesign } from "./PriceWidget";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

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
// Built per call: a client made before `server.listen()` would hold the unpatched `fetch`.
const api = (persona?: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("customer", persona) });
const anonymous = () => createApiClient({ baseUrl: "http://api.mock" });
/** The configurator, parked as a request until U2.F1. */
const client = () => createRequestClient(REQUESTS, anonymous() as unknown as Client<never>);
/** A catalogue product's id, as its designer catalogue names it: a published design needs one. */
const PRODUCT = async () =>
  (await anonymous().GET("/v1/store/designer/catalog", { params: { query: { product: "tuck-end-box" } } })).data!
    .product.id;
const published = { document: { spec, content: blank } as unknown as Record<string, never>, schemaVersion: 2 };

describe("store.designs (mock)", () => {
  it("creates, saves under If-Match, refuses a stale save with 412, and keeps every version", async () => {
    const catalogProductId = await PRODUCT();
    const created = await api().POST("/v1/store/designs", {
      body: { title: "กล่องทดสอบ", catalogProductId, ...published },
    });
    const first = created.response.headers.get("etag")!;
    expect(first).toBe('"v1"');
    const id = created.data!.id;
    expect(created.data!.catalogProductId).toBe(catalogProductId);

    const saved = await api().PUT("/v1/store/designs/{designId}", {
      params: { path: { designId: id }, header: { "If-Match": first } },
      body: { title: "กล่องทดสอบ", kind: "manual", ...published },
    });
    expect(saved.data!.versionNo).toBe(2);
    const second = saved.response.headers.get("etag")!;
    expect(second).toBe('"v2"');

    // Another tab saving from version 1 again is refused, not merged.
    const stale = await failure(
      api().PUT("/v1/store/designs/{designId}", {
        params: { path: { designId: id }, header: { "If-Match": first } },
        body: { title: "จากแท็บอื่น", kind: "manual", ...published },
      }),
    );
    expect(stale?.status).toBe(412);
    expect(stale?.code).toBe("concurrency.stale");

    const { data: versions } = await api().GET("/v1/store/designs/{designId}/versions", {
      params: { path: { designId: id } },
    });
    expect(versions!.map((v) => v.versionNo)).toEqual([2, 1]);

    // Restore makes a new version (kind `restore`), under the same ETag chain.
    const restored = await api().POST("/v1/store/designs/{designId}/versions/{versionNo}/actions/restore", {
      params: { path: { designId: id, versionNo: 1 }, header: { "If-Match": second } },
    });
    expect(restored.data!.versionNo).toBe(3);
    const { data: history } = await api().GET("/v1/store/designs/{designId}/versions", {
      params: { path: { designId: id } },
    });
    expect(history!.find((version) => version.versionNo === 3)?.kind).toBe("restore");
  });

  it("refuses a design without a product, hides another customer's, and replays an import by local id", async () => {
    const orphan = await failure(
      api().POST("/v1/store/designs", { body: { title: "ไม่มีสินค้า", catalogProductId: "", ...published } }),
    );
    expect(orphan?.status).toBe(422);

    const { data: mine } = await api().POST("/v1/store/designs", {
      body: { title: "ของฉัน", catalogProductId: await PRODUCT(), ...published },
    });
    const theirs = await failure(
      api("receiver").GET("/v1/store/designs/{designId}", { params: { path: { designId: mine!.id } } }),
    );
    expect(theirs?.status).toBe(404);

    const row = { localId: "abc123", title: "จากเบราว์เซอร์", ...published };
    const body = {
      designs: [
        { ...row, catalogProductId: await PRODUCT() },
        { ...row, localId: "no-product" },
      ],
    };
    const { data: first } = await api().POST("/v1/store/designs/actions/import", {
      params: { header: { "Idempotency-Key": crypto.randomUUID() } },
      body,
    });
    // A row without a product is skipped with its reason, not filed under some product.
    expect(first!.skipped).toEqual([{ localId: "no-product", reason: "product_not_found" }]);
    const { data: again } = await api().POST("/v1/store/designs/actions/import", {
      params: { header: { "Idempotency-Key": crypto.randomUUID() } },
      body,
    });
    expect(again!.imported[0]!.designId).toBe(first!.imported[0]!.designId);
  });

  it("serves a product's designer catalogue publicly, read with calipers and flute allowances", async () => {
    const { data } = await anonymous().GET("/v1/store/designer/catalog", {
      params: { query: { product: "tuck-end-box" } },
    });
    const catalog = toCatalogView(data!);
    expect(catalog.materials.length).toBeGreaterThan(0);
    const flute = catalog.materials.find((m) => m.kind === "corrugated");
    expect(flute?.caliperMm).toBeGreaterThan(1);
    expect(flute?.allowances?.panel).not.toBeNull();
    expect(catalog.rules.bleedMm).toBe(3);
    expect(catalog.product.slug).toBe("tuck-end-box");
  });

  it("shares a view-only link that stops opening once revoked (D-226)", async () => {
    const { data: design } = await api().POST("/v1/store/designs", {
      body: { title: "แชร์", catalogProductId: await PRODUCT(), ...published },
    });
    const { data: share } = await api().POST("/v1/store/designs/{designId}/actions/share", {
      params: { path: { designId: design!.id } },
    });
    const { data: shared } = await anonymous().GET("/v1/store/shared-designs/{token}", {
      params: { path: { token: share!.shareToken } },
    });
    expect(shared).toMatchObject({ title: "แชร์", product: { slug: "tuck-end-box" } });
    await api().DELETE("/v1/store/designs/{designId}/share", { params: { path: { designId: design!.id } } });
    const gone = await failure(
      anonymous().GET("/v1/store/shared-designs/{token}", { params: { path: { token: share!.shareToken } } }),
    );
    expect(gone?.status).toBe(404);
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
