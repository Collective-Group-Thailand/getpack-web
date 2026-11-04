// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { resetRewardsMock } from "../../../mocks/store/loyalty-p3";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";
import { isApiError } from "./problem";
import { createRequestClient } from "./requests/client";
import { REQUESTS } from "./requests/registry";

/**
 * The reward catalogue mock keeps API-CHANGES-P3's rules, so the redeem page is built against them: a guest sees
 * costs and no verdict, redeeming takes the cost off the same balance `store.loyalty.get` reports and answers the
 * coupon with `balanceAfter`, a cancel inside the window gives the points back, and the free sample says when it can
 * be redeemed again.
 */
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => resetRewardsMock());
afterAll(() => server.close());

const requests = (token?: string) =>
  createRequestClient(
    REQUESTS,
    createApiClient({
      baseUrl: "http://api.mock",
      ...(token ? { accessToken: token } : {}),
    }) as unknown as Client<never>,
  );

describe("rewards mock (store.rewards.*)", () => {
  it("shows a guest the costs without a balance or a verdict", async () => {
    const { balance, items } = await requests().call("GET /v1/store/rewards");
    expect(balance).toBeNull();
    expect(items).toHaveLength(8);
    expect(items.every((item) => item.canRedeem === null && item.blockedReason === null)).toBe(true);
  });

  it("redeems, reports the balance after, and gives the points back on cancel", async () => {
    const customer = requests(accessToken("customer"));
    const before = await customer.call("GET /v1/store/rewards");
    const item = before.items.find((candidate) => candidate.code === "cash_off_50")!;
    const redeemed = await customer.call("POST /v1/store/rewards/{itemId}/actions/redeem", {
      path: { itemId: item.id },
      body: { expectedCostPoints: item.costPoints },
      idempotencyKey: "test-redeem-1",
    });
    expect(redeemed.status).toBe("issued");
    expect(redeemed.balanceAfter).toBe(before.balance! - item.costPoints);
    expect(redeemed.cancellableUntil).not.toBeNull();

    const cancelled = await customer.call("POST /v1/store/rewards/redemptions/{redemptionId}/actions/cancel", {
      path: { redemptionId: redeemed.id },
    });
    expect(cancelled.status).toBe("cancelled");
    expect((await customer.call("GET /v1/store/rewards")).balance).toBe(before.balance);
  });

  it("refuses a changed cost and says when the free sample comes back", async () => {
    const customer = requests(accessToken("customer"));
    const { items } = await customer.call("GET /v1/store/rewards");
    const sample = items.find((candidate) => candidate.code === "free_sample")!;
    expect(sample.blockedReason).toBe("frequency");
    expect(sample.nextAvailableAt).not.toBeNull();
    const shipping = items.find((candidate) => candidate.code === "free_shipping")!;
    await expect(
      customer.call("POST /v1/store/rewards/{itemId}/actions/redeem", {
        path: { itemId: shipping.id },
        body: { expectedCostPoints: shipping.costPoints + 1 },
        idempotencyKey: "test-redeem-2",
      }),
    ).rejects.toSatisfy((error) => isApiError(error) && error.code === "rewards.cost_changed");
  });

  it("lists my coupons by status and never offers a tier perk's cancel", async () => {
    const customer = requests(accessToken("customer"));
    const issued = await customer.call("GET /v1/store/rewards/redemptions", { query: { status: "issued" } });
    expect(issued.data.every((row) => row.status === "issued")).toBe(true);
    expect(issued.data.filter((row) => row.source === "tier_perk").every((row) => row.cancellableUntil === null)).toBe(
      true,
    );
  });
});
