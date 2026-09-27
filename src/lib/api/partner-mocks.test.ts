// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { accessToken, mockId } from "../../../mocks/support";
import { createApiClient } from "./client";
import { createRequestClient } from "./requests/client";
import { REQUESTS } from "./requests/registry";

/**
 * The partner surface's mock behaves like the API it stands in for (F5 5.1): a factory reaches
 * its own rows only — another factory's id is a 404 (D-044) — roles are checked against rbac.md,
 * irreversible actions replay by key, and what a factory does lands in the back office's rows.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const F001 = "00000000-0000-4000-8000-0000000000f1";
const F005 = mockId("fac", 5);
const F006 = mockId("fac", 6);
const partner = (persona?: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("partner", persona) });
const staff = (persona: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("staff", persona) });
const requestsAs = (persona: string) => createRequestClient(REQUESTS, partner(persona) as unknown as Client<never>);

describe("partner sign-in", () => {
  it("signs each factory role in as itself, with rbac.md's permissions", async () => {
    const api = createApiClient({ baseUrl: "http://api.mock" });
    const { data } = await api.POST("/v1/auth/partner/login", {
      body: { email: "operator@factory.invalid", password: "mock-password" },
    });
    const me = (
      await createApiClient({ baseUrl: "http://api.mock", accessToken: data!.accessToken }).GET("/v1/partner/me")
    ).data!;
    expect(me.roles).toEqual(["factory_operator"]);
    // rbac.md's key plus the floor keys proposed in docs/contract-requests.md (partner.permissions).
    expect(me.permissions).toEqual(["factory_profile.read", "factory_jobs.read", "factory_jobs.update"]);
    expect(me.factories).toEqual([{ factoryId: F001, roles: ["factory_operator"] }]);
  });
});

describe("the partner surface's scope rules", () => {
  it("answers another factory's id with 404, never 403 (D-044)", async () => {
    for (const path of [
      "/v1/partner/factories/{factoryId}",
      "/v1/partner/factories/{factoryId}/onboarding-steps",
    ] as const) {
      await expect(partner("owner").GET(path, { params: { path: { factoryId: F006 } } })).rejects.toMatchObject({
        status: 404,
      });
    }
    await expect(
      requestsAs("owner").call("GET /v1/partner/factories/{factoryId}/change-requests", { path: { factoryId: F006 } }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lists only the token's own factories", async () => {
    const { data } = await partner("owner").GET("/v1/partner/factories", {});
    expect(data!.data.map((factory) => factory.id)).toEqual([F001]);
  });

  it("refuses a role without the permission, and a staff token", async () => {
    await expect(
      partner("operator").GET("/v1/partner/factories/{factoryId}/price-lists", {
        params: { path: { factoryId: F001 } },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      staff("superadmin").GET("/v1/partner/factories/{factoryId}", { params: { path: { factoryId: F001 } } }),
    ).rejects.toMatchObject({ status: 403, code: "auth.wrong_audience" });
  });

  it("never hands a factory a suggestion, a benchmark or another factory's price (D-044)", async () => {
    const api = partner("owner");
    const bodies = await Promise.all([
      api.GET("/v1/partner/factories/{factoryId}/price-lists", { params: { path: { factoryId: F001 } } }),
      api.GET("/v1/partner/factories/{factoryId}/price-proposals", { params: { path: { factoryId: F001 } } }),
      api.GET("/v1/partner/factories/{factoryId}/configuration", { params: { path: { factoryId: F001 } } }),
    ]);
    const text = JSON.stringify(bodies.map((body) => body.data));
    expect(text).not.toMatch(/suggest|benchmark|peer|p75|median/i);
    const proposals = bodies[1]!.data as { data: { factoryId: string }[] };
    expect(proposals.data.every((item) => item.factoryId === F001)).toBe(true);
  });
});

describe("an applicant completing its application (F005)", () => {
  it("adds its details and submits, and the Partner team sees it under review", async () => {
    const api = partner("applicant");
    const path = { params: { path: { factoryId: F005 } } };
    await api.POST("/v1/partner/factories/{factoryId}/contacts", {
      ...path,
      body: { name: "ผู้ติดต่อ ทดสอบ", isPrimary: true },
    });
    const { data: file } = await api.POST("/v1/partner/files/presign", {
      body: { fileName: "cert.pdf", mimeType: "application/pdf", sizeBytes: 10, purpose: "document" },
    });
    await api.POST("/v1/partner/factories/{factoryId}/kyc-documents", {
      ...path,
      body: { docType: "company_certificate", fileId: file!.fileId },
    });
    const { response } = await api.GET("/v1/partner/factories/{factoryId}", path);
    const etag = response.headers.get("etag")!;
    // A stale ETag is refused: two tabs cannot both submit.
    await expect(
      api.POST("/v1/partner/factories/{factoryId}/actions/submit-application", {
        params: { path: { factoryId: F005 }, header: { "If-Match": 'W/"stale"' } },
        body: { reason: "ส่งใบสมัคร" },
      }),
    ).rejects.toMatchObject({ status: 412 });
    const { data } = await api.POST("/v1/partner/factories/{factoryId}/actions/submit-application", {
      params: { path: { factoryId: F005 }, header: { "If-Match": etag } },
      body: { reason: "ส่งใบสมัคร" },
    });
    expect(data!.status).toBe("under_review");
    const admin = await staff("partner_manager").GET("/v1/admin/factories/{factoryId}", path);
    expect(admin.data!.status).toBe("under_review");
  });
});

describe("assisted onboarding and a rate card (F006)", () => {
  it("signs off what Packio entered, once", async () => {
    const api = partner("assisted");
    const steps = (
      await api.GET("/v1/partner/factories/{factoryId}/onboarding-steps", { params: { path: { factoryId: F006 } } })
    ).data!;
    const waiting = steps.find((step) => step.enteredByStaff && !step.factorySignedOffAt)!;
    expect(waiting.step).toBe("capability");
    const { data } = await api.POST("/v1/partner/factories/{factoryId}/onboarding-steps/{step}/actions/sign-off", {
      params: { path: { factoryId: F006, step: waiting.step } },
    });
    expect(data!.factorySignedOffAt).not.toBeNull();
  });

  it("accepts a rate card whole, and a replayed key does not act twice", async () => {
    const api = partner("assisted");
    const list = (
      await api.GET("/v1/partner/factories/{factoryId}/price-proposals", {
        params: { path: { factoryId: F006 }, query: { direction: "packio_to_factory" } },
      })
    ).data!.data;
    const card = list.find((item) => item.status === "submitted")!;
    const init = {
      params: { path: { factoryId: F006, proposalId: card.id }, header: { "Idempotency-Key": "k-rate-card-1" } },
      body: {},
    };
    const first = (
      await api.POST("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/actions/respond", init)
    ).data!;
    expect(first.status).toBe("accepted_by_factory");
    expect(first.resultingVersion).not.toBeNull();
    const again = (
      await api.POST("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/actions/respond", init)
    ).data!;
    expect(again.resultingVersion?.id).toBe(first.resultingVersion?.id);
  });
});

describe("a factory price-list proposal (F001)", () => {
  it("refuses a back-dated proposal, takes a future one, and lands it in the admin queue", async () => {
    const api = partner("owner");
    const lists = (
      await api.GET("/v1/partner/factories/{factoryId}/price-lists", { params: { path: { factoryId: F001 } } })
    ).data!;
    const food = lists.find((list) => list.productTypeCode === "food_packaging")!;
    await expect(
      api.POST("/v1/partner/factories/{factoryId}/price-proposals", {
        params: { path: { factoryId: F001 } },
        body: { productTypeId: food.productTypeId, proposedEffectiveFrom: "2020-01-01T00:00:00+07:00" },
      }),
    ).rejects.toMatchObject({ status: 422 });
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const { data: draft } = await api.POST("/v1/partner/factories/{factoryId}/price-proposals", {
      params: { path: { factoryId: F001 } },
      body: {
        productTypeId: food.productTypeId,
        proposedEffectiveFrom: `${future}T00:00:00+07:00`,
        comment: "ค่าแรงขึ้น",
      },
    });
    const rows = (
      await api.GET("/v1/partner/factories/{factoryId}/price-list-versions/{versionId}/lines", {
        params: { path: { factoryId: F001, versionId: food.current!.id }, query: { component: "print_wastes" } },
      })
    ).data!.data;
    const edited = await api.PUT("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/lines", {
      params: { path: { factoryId: F001, proposalId: draft!.id } },
      body: {
        lines: [
          {
            action: "change",
            component: "print_wastes",
            lineKey: rows[0]!.lineKey,
            values: { ...(rows[0]!.values as object), sheets: 60 },
          },
        ],
      },
    });
    expect(edited.data!.lines[0]!.currentValues).toMatchObject({ sheets: 80 });
    await api.POST("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/actions/submit", {
      params: { path: { factoryId: F001, proposalId: draft!.id }, header: { "Idempotency-Key": "k-submit-1" } },
    });
    const queue = (
      await staff("partner_manager").GET("/v1/admin/price-proposals", {
        params: { query: { direction: "factory_to_packio", status: "submitted" } },
      })
    ).data!.data;
    expect(queue.map((item) => item.id)).toContain(draft!.id);
    // One open proposal per price list.
    await expect(
      api.POST("/v1/partner/factories/{factoryId}/price-proposals", {
        params: { path: { factoryId: F001 } },
        body: { productTypeId: food.productTypeId, proposedEffectiveFrom: `${future}T00:00:00+07:00` },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
