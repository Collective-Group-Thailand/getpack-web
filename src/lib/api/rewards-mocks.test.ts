// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { resetRewardsMock } from "../../../mocks/store/loyalty-p3";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";
import { isApiError } from "./problem";

/**
 * The reward catalogue mock keeps API-CHANGES-P3's rules in the generated shapes, so the redeem page is built against
 * them: a guest sees costs and no verdict, the preview answers the balance after (the web subtracts nothing),
 * redeeming takes the cost off the same balance `store.loyalty.get` reports and answers the coupon with `balanceAfter`,
 * a cancel inside the window gives the points back, and the free sample says when it can be redeemed again.
 */
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => resetRewardsMock());
afterAll(() => server.close());

const client = (token?: string) =>
  createApiClient({ baseUrl: "http://api.mock", ...(token ? { accessToken: token } : {}) });
const catalogue = async (token?: string) => (await client(token).GET("/v1/store/rewards")).data!;

describe("rewards mock (store.rewards.*)", () => {
  it("shows a guest the costs without a balance or a verdict, and the cancel window on every item", async () => {
    const { balance, items } = await catalogue();
    expect(balance).toBeNull();
    expect(items).toHaveLength(8);
    expect(items.every((item) => item.canRedeem === null && item.blockedReason === null)).toBe(true);
    expect(items.every((item) => item.cancelWindowDays === 7)).toBe(true);
  });

  it("previews, redeems with the preview's balance after, and gives the points back on cancel", async () => {
    const token = accessToken("customer");
    const customer = client(token);
    const before = await catalogue(token);
    const item = before.items.find((candidate) => candidate.code === "cash_off_50")!;
    const { data: preview } = await customer.GET("/v1/store/rewards/{itemId}/preview", {
      params: { path: { itemId: item.id } },
    });
    expect(preview).toEqual({
      costPoints: item.costPoints,
      balanceAfter: before.balance! - item.costPoints,
      eligible: true,
      reason: null,
    });
    const { data: redeemed } = await customer.POST("/v1/store/rewards/{itemId}/actions/redeem", {
      params: { path: { itemId: item.id }, header: { "Idempotency-Key": "test-redeem-1" } },
      body: { expectedCostPoints: item.costPoints },
    });
    expect(redeemed!.status).toBe("issued");
    expect(redeemed!.balanceAfter).toBe(preview!.balanceAfter);
    expect(redeemed!.cancellableUntil).not.toBeNull();

    const { data: cancelled } = await customer.POST("/v1/store/rewards/redemptions/{redemptionId}/actions/cancel", {
      params: { path: { redemptionId: redeemed!.id } },
    });
    expect(cancelled!.status).toBe("cancelled");
    expect((await catalogue(token)).balance).toBe(before.balance);
  });

  it("refuses a changed cost, previews a blocked item without a balance after, and dates the free sample", async () => {
    const token = accessToken("customer");
    const customer = client(token);
    const { items } = await catalogue(token);
    const sample = items.find((candidate) => candidate.code === "free_sample")!;
    expect(sample.blockedReason).toBe("frequency");
    expect(sample.nextAvailableAt).not.toBeNull();
    const { data: blocked } = await customer.GET("/v1/store/rewards/{itemId}/preview", {
      params: { path: { itemId: sample.id } },
    });
    expect(blocked).toMatchObject({ eligible: false, balanceAfter: null, reason: "frequency" });
    const shipping = items.find((candidate) => candidate.code === "free_shipping")!;
    await expect(
      customer.POST("/v1/store/rewards/{itemId}/actions/redeem", {
        params: { path: { itemId: shipping.id }, header: { "Idempotency-Key": "test-redeem-2" } },
        body: { expectedCostPoints: shipping.costPoints + 1 },
      }),
    ).rejects.toSatisfy((error) => isApiError(error) && error.code === "rewards.cost_changed");
  });

  it("lists my coupons by status (paginated) and never offers a tier perk's cancel", async () => {
    const { data: issued } = await client(accessToken("customer")).GET("/v1/store/rewards/redemptions", {
      params: { query: { status: "issued" } },
    });
    expect(issued!.meta.total).toBe(issued!.data.length);
    expect(issued!.data.every((row) => row.status === "issued")).toBe(true);
    expect(issued!.data.filter((row) => row.source === "tier_perk").every((row) => row.cancellableUntil === null)).toBe(
      true,
    );
  });
});
