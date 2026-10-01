// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DASHBOARD_QUEUES } from "../../../mocks/admin/console";
import { handlers } from "../../../mocks/handlers";
import { menuFor, personaByKey } from "../../../mocks/personas";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";

/**
 * The console mocks behave like packio-api's U-B0.3 building blocks (v0.6.0): the menu, the
 * dashboard's queues, saved views, search, the staff directory and the SoD rules.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const staff = (persona: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("staff", persona) });

describe("the menu", () => {
  it("is packio-api's catalogue, business entries and the finance any-of gate included", async () => {
    const { data: me } = await staff("finance").GET("/v1/admin/me");
    expect(me!.menu.map((entry) => entry.key)).toContain("finance");
    expect(me!.menu).toEqual(menuFor(personaByKey("finance")!));
    const { data: cs } = await staff("cs").GET("/v1/admin/me");
    expect(cs!.menu.map((entry) => entry.key)).not.toContain("finance");
    expect(cs!.menu.map((entry) => entry.key)).toContain("orders");
  });
});

describe("the dashboard", () => {
  it("sends only packio-api's queues the role may work, in packio-api's order", async () => {
    const known = DASHBOARD_QUEUES.map((queue) => queue.key);
    const { data: cs } = await staff("cs").GET("/v1/admin/dashboard");
    const { data: finance } = await staff("finance").GET("/v1/admin/dashboard");
    const keys = (dashboard: typeof cs) => dashboard!.queues.map((queue) => queue.key);
    expect(DASHBOARD_QUEUES).toHaveLength(21);
    expect(keys(cs)).not.toEqual(keys(finance));
    expect(keys(finance)).toContain("finance.slips");
    expect(keys(cs)).not.toContain("finance.slips");
    for (const dashboard of [cs, finance]) {
      expect(keys(dashboard).every((key) => known.includes(key))).toBe(true);
      expect(keys(dashboard)).toEqual(known.filter((key) => keys(dashboard).includes(key)));
    }
  });

  it("refuses without a session", async () => {
    await expect(createApiClient({ baseUrl: "http://api.mock" }).GET("/v1/admin/dashboard")).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("saved views", () => {
  it("are mine and the shared ones; only the owner deletes one", async () => {
    const cs = staff("cs");
    const lead = staff("cs_lead");
    const { data: mine } = await cs.POST("/v1/admin/saved-views", {
      body: { resource: "orders", name: "รอชำระ (ทดสอบ)", query: { queue: "waiting_payment" }, shared: false },
    });
    const { data: shared } = await cs.POST("/v1/admin/saved-views", {
      body: { resource: "orders", name: "ทั้งทีม (ทดสอบ)", query: { status: "late" }, shared: true },
    });
    expect(mine!.columns).toBeNull();

    const { data: forLead } = await lead.GET("/v1/admin/saved-views", { params: { query: { resource: "orders" } } });
    expect(forLead!.data.map((view) => view.id)).toContain(shared!.id);
    expect(forLead!.data.map((view) => view.id)).not.toContain(mine!.id);
    expect(forLead!.meta.total).toBe(forLead!.data.length);

    await expect(
      lead.DELETE("/v1/admin/saved-views/{viewId}", { params: { path: { viewId: shared!.id } } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      lead.DELETE("/v1/admin/saved-views/{viewId}", { params: { path: { viewId: mine!.id } } }),
    ).rejects.toMatchObject({ status: 404 });
    await cs.DELETE("/v1/admin/saved-views/{viewId}", { params: { path: { viewId: mine!.id } } });

    await expect(
      cs.POST("/v1/admin/saved-views", {
        body: { resource: "orders", name: "ทั้งทีม (ทดสอบ)", query: {} },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("search", () => {
  it("finds only the types the role may read", async () => {
    const { data: auditor } = await staff("auditor").GET("/v1/admin/search", { params: { query: { q: "ตัวอย่าง" } } });
    expect(auditor!.data.every((hit) => hit.type !== "order")).toBe(true);
    await expect(staff("cs").GET("/v1/admin/search", { params: { query: { q: "x" } } })).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe("the staff directory", () => {
  it("lists active staff by name, with no contact details", async () => {
    const { data } = await staff("cs").GET("/v1/admin/staff-directory", {
      params: { query: { permission: "rfqs.manage" } },
    });
    expect(data!.length).toBeGreaterThan(0);
    expect(Object.keys(data![0]!).sort()).toEqual(["displayName", "id", "roles"]);
    await expect(staff("cs").GET("/v1/admin/staff-directory", { params: { query: { q: "ส" } } })).rejects.toMatchObject(
      { status: 422 },
    );
  });
});

describe("the SoD rules", () => {
  it("need users.read", async () => {
    const { data } = await staff("admin").GET("/v1/admin/sod-rules");
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.map((rule) => rule.key)).toEqual([...data!.map((rule) => rule.key)].sort());
    await expect(staff("cs").GET("/v1/admin/sod-rules")).rejects.toMatchObject({ status: 403 });
  });
});
