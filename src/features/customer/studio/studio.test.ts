// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SPEC_VERSION } from "@packio/dieline";

import { handlers } from "../../../../mocks/handlers";
import { accessToken } from "../../../../mocks/support";
import type { Configurator } from "@/features/customer/configurator/model";
import { diff, type JsonValue } from "@/features/designer/lib/json-patch";
import type { DesignContent, DesignSpec } from "@/features/designer/types";
import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";

import { printSidesOf, studioFieldsOf } from "./spec";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const api = () => createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("customer") });
const anonymous = () => createApiClient({ baseUrl: "http://api.mock" });
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (isApiError(error) ? error : Promise.reject(error)),
  );

const blank: DesignContent = {
  elements: [],
  pattern: { kind: "none", color: "#000000", background: "#ffffff", size: 12 },
};
const printed: DesignContent = {
  ...blank,
  elements: [
    {
      id: "t1",
      type: "text",
      x: 10,
      y: 10,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      text: "Packio",
      fontFamily: "Sarabun",
      fontSize: 12,
      fontStyle: "normal",
      fill: "#c0392b",
      align: "left",
      width: 40,
    } as unknown as DesignContent["elements"][number],
  ],
};

async function setup() {
  const configurator = (
    await anonymous().GET("/v1/store/catalog/products/{slug}/configurator", {
      params: { path: { slug: "tuck-end-box" } },
    })
  ).data! as Configurator;
  const material = configurator.optionGroups.find((g) => g.kind === "material")!.options[0]!.id;
  const spec: DesignSpec = {
    specVersion: SPEC_VERSION,
    styleId: "tuck-end",
    values: { length: 70, width: 40, height: 150 },
    material: { caliperMm: 0.45, kind: "paperboard" },
    materialId: material,
    patternId: configurator.patterns[0]!.id,
  };
  return { configurator, spec };
}

describe("studio fields (D-275)", () => {
  it("write the box and the spec from one configuration, so they agree", async () => {
    const { configurator, spec } = await setup();
    const fields = studioFieldsOf(configurator, spec, printed)!;
    expect(fields.lengthMm).toBe(fields.spec.l);
    expect(fields.widthMm).toBe(fields.spec.w);
    expect(fields.heightMm).toBe(fields.spec.d);
    expect(fields.materialId).toBe(fields.spec.materialId);
    expect(fields.measurementBasis).toBe("internal");
    expect(fields.printSides).toBe("outside");
    expect(fields.spec.quantities).toBeUndefined();
    expect(studioFieldsOf(configurator, spec, blank)!.printSides).toBe("none");
    expect(studioFieldsOf(configurator, null, blank)).toBeNull();
  });

  it("tell print sides as packio-api does", () => {
    expect(printSidesOf({ parts: [{ printFront: [1], printBack: [] }] })).toBe("outside");
    expect(printSidesOf({ parts: [{ printFront: [], printBack: [1] }] })).toBe("inside");
    expect(printSidesOf({ parts: [{ printFront: [1], printBack: [1] }] })).toBe("both");
    expect(printSidesOf({ printFront: { inkColourIds: ["x"] } })).toBe("outside");
    expect(printSidesOf({})).toBe("none");
  });
});

describe("store.studio.quote and patch autosave (mock)", () => {
  it("prices the saved version, explains the next price and keeps the spec through a patch", async () => {
    const { configurator, spec } = await setup();
    const fields = studioFieldsOf(configurator, spec, blank)!;
    const created = await api().POST("/v1/store/designs", {
      body: {
        title: "สตูดิโอ",
        catalogProductId: configurator.catalogProductId,
        document: { spec, content: blank } as unknown as Record<string, never>,
        schemaVersion: 2,
        ...fields,
      },
    });
    const id = created.data!.id;
    expect(created.data!.spec).toEqual(fields.spec);
    expect(created.data!.printSides).toBe("none");

    const first = await api().POST("/v1/store/studio/{designId}/quote", {
      params: { path: { designId: id } },
      body: { quantities: [500], versionNo: created.data!.versionNo! },
    });
    expect(first.data!.mode).toBe("instant");
    expect(first.data!.specHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.data!.calculation!.steps[0]!.unitPrice).toBeTruthy();

    // Printed now: the box changes (print sides), so the save is a PUT with the new fields.
    const printedFields = studioFieldsOf(configurator, spec, printed)!;
    const saved = await api().PUT("/v1/store/designs/{designId}", {
      params: { path: { designId: id }, header: { "If-Match": created.response.headers.get("etag")! } },
      body: {
        kind: "autosave",
        document: { spec, content: printed } as unknown as Record<string, never>,
        schemaVersion: 2,
        ...printedFields,
      },
    });
    const second = await api().POST("/v1/store/studio/{designId}/quote", {
      params: { path: { designId: id } },
      body: { quantities: [500], versionNo: saved.data!.versionNo!, previousSpecHash: first.data!.specHash },
    });
    expect(second.data!.specHash).not.toBe(first.data!.specHash);
    expect(second.data!.reasons).toEqual(["print_changed"]);
    expect(second.data!.changes[0]).toMatchObject({ quantity: 500, previousUnitPrice: expect.any(String) });

    // A content-only change goes as JSON Patch; the version keeps the box and prices the same.
    const moved = { ...printed, elements: [{ ...printed.elements[0]!, x: 20 }] } as DesignContent;
    const operations = diff(
      { spec, content: printed } as unknown as JsonValue,
      { spec, content: moved } as unknown as JsonValue,
    );
    const patched = await api().PATCH("/v1/store/designs/{designId}/document", {
      params: { path: { designId: id }, header: { "If-Match": saved.response.headers.get("etag")! } },
      body: { kind: "autosave", operations: operations as never },
    });
    expect((patched.data!.document as { content: DesignContent }).content.elements[0]!.x).toBe(20);
    const third = await api().POST("/v1/store/studio/{designId}/quote", {
      params: { path: { designId: id } },
      body: { quantities: [500], versionNo: patched.data!.versionNo!, previousSpecHash: second.data!.specHash },
    });
    expect(third.data!.specHash).toBe(second.data!.specHash);
    expect(third.data!.cached).toBe(true);
    expect(third.data!.reasons).toEqual([]);

    // A stale patch is refused like a stale save.
    const stale = await failure(
      api().PATCH("/v1/store/designs/{designId}/document", {
        params: { path: { designId: id }, header: { "If-Match": saved.response.headers.get("etag")! } },
        body: { kind: "autosave", operations: operations as never },
      }),
    );
    expect(stale?.status).toBe(412);
  });

  it("refuses a design that was never saved with a spec", async () => {
    const { configurator, spec } = await setup();
    const created = await api().POST("/v1/store/designs", {
      body: {
        title: "ไม่มีสเปก",
        catalogProductId: configurator.catalogProductId,
        document: { spec, content: blank } as unknown as Record<string, never>,
        schemaVersion: 2,
      },
    });
    const error = await failure(
      api().POST("/v1/store/studio/{designId}/quote", {
        params: { path: { designId: created.data!.id } },
        body: { quantities: [500] },
      }),
    );
    expect(error?.status).toBe(409);
    expect(error?.code).toBe("studio.spec_missing");
  });
});
