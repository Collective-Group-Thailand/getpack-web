// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { resetDealsMock } from "../../../mocks/store/deals";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";
import { isApiError } from "./problem";

/**
 * The deals mock keeps the P1.5 acceptance rules (PLAN §8 Phase 1.5) in the generated contract's shapes, so the
 * screens are built against them: a hidden or ended promotion is never served, an unlisted one only by its link, the
 * PDP filter returns only deals for that product type, `?ref=` is echoed in the share link, and a saved deal answers
 * 409 `promotions.already_saved` the second time.
 */
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => resetDealsMock());
afterAll(() => server.close());

const client = (token?: string) =>
  createApiClient({ baseUrl: "http://api.mock", ...(token ? { accessToken: token } : {}) });
const list = async (token?: string, query: { productTypeCode?: string; ref?: string } = {}) =>
  (await client(token).GET("/v1/store/promotions", { params: { query } })).data!;

describe("deals mock (store.promotions.*)", () => {
  it("never serves a hidden or ended deal, and serves an unlisted one only by its link", async () => {
    const { items, counts } = await list();
    const slugs = items.map((deal) => deal.slug);
    expect(slugs).not.toContain("staff-preview");
    expect(slugs).not.toContain("ended-deal");
    expect(slugs).not.toContain("agent-link-only");
    expect(counts.all).toBe(items.length);
    await expect(
      client().GET("/v1/store/promotions/{slug}", { params: { path: { slug: "staff-preview" } } }),
    ).rejects.toSatisfy((error) => isApiError(error) && error.status === 404);
    const { data: unlisted } = await client().GET("/v1/store/promotions/{slug}", {
      params: { path: { slug: "agent-link-only" } },
    });
    expect(unlisted!.code).toBe("AGENT200");
  });

  it("serves every benefit kind, tiered and perk included", async () => {
    const kinds = new Set((await list()).items.map((deal) => deal.benefit.kind));
    expect([...kinds].sort()).toEqual(["amount", "free_shipping", "percent", "perk", "points_multiplier", "tiered"]);
  });

  it("gives a guest no per-customer status and a signed-in customer one", async () => {
    expect((await list()).items.every((deal) => deal.myStatus === null)).toBe(true);
    expect((await list(accessToken("customer"))).items.some((deal) => deal.myStatus === "saved")).toBe(true);
  });

  it("filters by product type for the PDP badge and echoes ?ref in the share link", async () => {
    const { items } = await list(undefined, { productTypeCode: "corrugated", ref: "AG123" });
    expect(items.map((deal) => deal.code)).toEqual(["BOX10"]);
    expect(new URL(items[0]!.shareUrl).searchParams.get("ref")).toBe("AG123");
  });

  it("saves once, then answers 409 promotions.already_saved", async () => {
    const token = accessToken("customer");
    const box10 = (await list(token)).items.find((deal) => deal.code === "BOX10")!;
    const save = () =>
      client(token).POST("/v1/store/promotions/{promotionId}/actions/save", {
        params: { path: { promotionId: box10.id } },
      });
    await expect(save().then(({ data }) => data)).resolves.toEqual({ myStatus: "saved" });
    await expect(save()).rejects.toSatisfy(
      (error) => isApiError(error) && error.status === 409 && error.code === "promotions.already_saved",
    );
  });
});
