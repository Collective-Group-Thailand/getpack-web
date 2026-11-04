// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { resetDealsMock } from "../../../mocks/store/deals";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";
import { isApiError } from "./problem";
import { createRequestClient } from "./requests/client";
import { REQUESTS } from "./requests/registry";

/**
 * The deals mock keeps the P1.5 acceptance rules (PLAN §8 Phase 1.5) so the screens are built against them: a hidden
 * or ended promotion is never served, the PDP filter returns only deals for that product type, `?ref=` is echoed in
 * the share link, and a saved deal answers 409 the second time.
 */
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => resetDealsMock());
afterAll(() => server.close());

const client = (token?: string) =>
  createRequestClient(
    REQUESTS,
    createApiClient({
      baseUrl: "http://api.mock",
      ...(token ? { accessToken: token } : {}),
    }) as unknown as Client<never>,
  );

describe("deals mock (API-CHANGES-P15)", () => {
  it("never serves a hidden or ended deal", async () => {
    const list = await client().call("GET /v1/store/promotions");
    const slugs = list.items.map((deal) => deal.slug);
    expect(slugs).not.toContain("staff-preview");
    expect(slugs).not.toContain("ended-deal");
    expect(list.counts.all).toBe(list.items.length);
    await expect(
      client().call("GET /v1/store/promotions/{slug}", { path: { slug: "staff-preview" } }),
    ).rejects.toSatisfy((error) => isApiError(error) && error.status === 404);
  });

  it("gives a guest no per-customer status and a signed-in customer one", async () => {
    const guest = await client().call("GET /v1/store/promotions");
    expect(guest.items.every((deal) => deal.myStatus === null)).toBe(true);
    const mine = await client(accessToken("customer")).call("GET /v1/store/promotions");
    expect(mine.items.some((deal) => deal.myStatus === "saved")).toBe(true);
  });

  it("filters by product type for the PDP badge and echoes ?ref in the share link", async () => {
    const list = await client().call("GET /v1/store/promotions", {
      query: { productTypeCode: "corrugated", ref: "AG123" },
    });
    expect(list.items.map((deal) => deal.code)).toEqual(["BOX10"]);
    expect(new URL(list.items[0]!.shareUrl).searchParams.get("ref")).toBe("AG123");
  });

  it("saves once, then answers 409", async () => {
    const customer = client(accessToken("customer"));
    const box10 = (await customer.call("GET /v1/store/promotions")).items.find((deal) => deal.code === "BOX10")!;
    await expect(
      customer.call("POST /v1/store/promotions/{promotionId}/actions/save", { path: { promotionId: box10.id } }),
    ).resolves.toEqual({ myStatus: "saved" });
    await expect(
      customer.call("POST /v1/store/promotions/{promotionId}/actions/save", { path: { promotionId: box10.id } }),
    ).rejects.toSatisfy((error) => isApiError(error) && error.code === "promotion.already_saved");
  });
});
