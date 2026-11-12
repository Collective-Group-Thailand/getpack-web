// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { resetCofundingMock } from "../../../mocks/admin/cofunding-state";
import { resetLoyaltyP4AdminMock, setMockBudgetSpent } from "../../../mocks/admin/loyalty-p4";
import { settings } from "../../../mocks/admin/platform";
import { handlers } from "../../../mocks/handlers";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";
import { isApiError } from "./problem";

/**
 * The P4 mocks keep API-CHANGES-P4's rules, so the screens are built against them: the surfaces a store caller gets
 * (seven flags, never `capacityDeals`, guests at stage `all` only), the `loyalty.feature_disabled` guards, the company
 * claims on the checklist, the co-funding offer life cycle on both sides, the budget and the rollout's grow / shrink
 * rule.
 */
const server = setupServer(...handlers);
beforeAll(() => {
  resetLoyaltyP4AdminMock({ rollout: "percent" });
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  resetCofundingMock();
  resetLoyaltyP4AdminMock({ rollout: "percent" });
  setFlag("deals", true);
});
afterAll(() => server.close());

const api = (token?: string) =>
  createApiClient({ baseUrl: "http://api.mock", ...(token ? { accessToken: token } : {}) });
const customer = (persona?: string) => accessToken("customer", persona);
const staff = (persona: string) => accessToken("staff", persona);

function setFlag(flag: string, value: boolean) {
  const row = settings.find((candidate) => candidate.key === "loyalty.surfaces")!;
  row.current = { ...row.current!, value: { ...(row.current!.value as object), [flag]: value } as never };
}

async function problemOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    if (isApiError(error)) return { status: error.status, code: error.code };
    throw error;
  }
  return null;
}

describe("store.loyalty.surfaces", () => {
  it("answers seven flags for a customer in the cohort and never capacityDeals", async () => {
    const flags = (await api(customer()).GET("/v1/store/loyalty/surfaces")).data!;
    expect(Object.keys(flags).sort()).toEqual(
      ["checklist", "deals", "dealsLiff", "pointsLiff", "quoteRecovery", "redeem", "tierPerks"].sort(),
    );
    expect(Object.values(flags).every(Boolean)).toBe(true);
  });

  it("closes everything for an account outside the cohort and for a guest before stage all", async () => {
    const newcomer = (await api(customer("newcomer")).GET("/v1/store/loyalty/surfaces")).data!;
    expect(Object.values(newcomer).some(Boolean)).toBe(false);
    const guest = (await api().GET("/v1/store/loyalty/surfaces")).data!;
    expect(Object.values(guest).some(Boolean)).toBe(false);
    const config = (await api().GET("/v1/store/public-config")).data!;
    expect(config.loyaltySurfaces).toEqual(guest);
  });

  it("follows the setting: a closed flag closes its surface and its store endpoints", async () => {
    setFlag("deals", false);
    expect((await api(customer()).GET("/v1/store/loyalty/surfaces")).data!.deals).toBe(false);
    expect(await problemOf(api(customer()).GET("/v1/store/promotions"))).toEqual({
      status: 404,
      code: "loyalty.feature_disabled",
    });
    // `/promotions/mine` is not a deals surface read.
    expect(await problemOf(api(customer()).GET("/v1/store/promotions/mine"))).toBeNull();
  });

  it("answers loyalty.feature_disabled to an out-of-cohort account on the reward catalogue and the checklist", async () => {
    expect(await problemOf(api(customer("newcomer")).GET("/v1/store/rewards"))).toMatchObject({ status: 404 });
    expect(await problemOf(api(customer("newcomer")).GET("/v1/store/loyalty/tasks"))).toMatchObject({
      code: "loyalty.feature_disabled",
    });
  });
});

describe("company one-offs on the checklist (D-508)", () => {
  it("shows the company's claimed one-offs to its second member, without points to earn or a recommendation", async () => {
    const tasks = (await api(customer("companybuyer")).GET("/v1/store/loyalty/tasks")).data!;
    const claimed = tasks.tasks.filter((task) => task.status === "claimed_by_company");
    expect(claimed.map((task) => task.code).sort()).toEqual(["brand_kit", "tax_profile"]);
    expect(claimed.some((task) => task.recommended)).toBe(false);
    const todo = tasks.tasks.filter((task) => task.status === "todo").reduce((sum, task) => sum + task.points, 0);
    expect(tasks.remainingPoints).toBe(Math.min(todo, tasks.capRemainingPoints));
    expect(JSON.stringify(claimed)).not.toMatch(/user|member|name/i);
  });
});

describe("co-funding offers", () => {
  it("lets the factory owner accept its proposed offer once, and shows it accepted to Marketing", async () => {
    const owner = api(accessToken("partner", "owner"));
    const list = (await owner.GET("/v1/partner/cofunding-offers")).data!;
    const proposed = list.data.find((offer) => offer.status === "proposed")!;
    expect(proposed.nextActions).toEqual(["accept", "decline"]);
    expect(proposed.termsText).toBe("40 % ของส่วนลดดีล สูงสุด ฿20,000");
    const accepted = (
      await owner.POST("/v1/partner/cofunding-offers/{offerId}/actions/accept", {
        params: { path: { offerId: proposed.id }, header: { "Idempotency-Key": "k-accept" } },
        body: {},
      })
    ).data!;
    expect(accepted).toMatchObject({ status: "accepted", nextActions: [] });
    const again = owner.POST("/v1/partner/cofunding-offers/{offerId}/actions/accept", {
      params: { path: { offerId: proposed.id }, header: { "Idempotency-Key": "k-again" } },
      body: {},
    });
    expect(await problemOf(again)).toEqual({ status: 409, code: "cofunding.invalid_transition" });
    const admin = (
      await api(staff("marketing")).GET("/v1/admin/promotions/{promotionId}/cofunding-offers", {
        params: { path: { promotionId: proposed.promotionId } },
      })
    ).data!;
    expect(admin.data.find((offer) => offer.id === proposed.id)?.status).toBe("accepted");
  });

  it("refuses a second live offer to the same factory on the same deal", async () => {
    const [offer] = (
      await api(staff("marketing")).GET("/v1/admin/promotions/{promotionId}/cofunding-offers", {
        params: { path: { promotionId: "00000000-0000-4000-8000-70726d000028" } },
      })
    ).data!.data;
    const create = api(staff("marketing")).POST("/v1/admin/promotions/{promotionId}/cofunding-offers", {
      params: { path: { promotionId: offer!.promotionId }, header: { "Idempotency-Key": "k-1" } },
      body: {
        factoryId: offer!.factory.id,
        mode: "fixed_per_order",
        sharePct: null,
        fixedAmount: "150.00",
        capAmount: "5000.00",
        validFrom: offer!.validFrom,
        validTo: offer!.validTo,
      },
    });
    expect(await problemOf(create)).toEqual({ status: 409, code: "cofunding.offer_exists" });
  });

  it("does not let an accountant decide, and hides another factory's offer", async () => {
    const list = (await api(accessToken("partner", "accountant")).GET("/v1/partner/cofunding-offers")).data!;
    expect(list.data.every((offer) => offer.nextActions.length === 0)).toBe(true);
    const others = api(accessToken("partner", "owner")).GET("/v1/partner/cofunding-offers/{offerId}", {
      params: { path: { offerId: "00000000-0000-4000-8000-63666f000002" } },
    });
    expect(await problemOf(others)).toMatchObject({ status: 404 });
  });
});

describe("programme budget and rollout", () => {
  it("reads 84 % as a warning and 100 % as exhausted", async () => {
    const warning = (await api(staff("marketing")).GET("/v1/admin/loyalty/programme-budget")).data;
    expect(warning).toMatchObject({ usedPct: "84.00", state: "warning" });
    setMockBudgetSpent("250000.00");
    const full = (await api(staff("marketing")).GET("/v1/admin/loyalty/programme-budget")).data;
    expect(full).toMatchObject({ usedPct: "100.00", state: "exhausted" });
  });

  it("asks an override to raise the budget and refuses a lower amount", async () => {
    const lower = api(staff("marketing")).POST("/v1/admin/loyalty/programme-budget/overrides", {
      params: { header: { "Idempotency-Key": "k-low" } },
      body: {
        month: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7),
        amount: "1000.00",
        reason: "ลองลดงบดูก่อนนะครับ",
      },
    });
    expect(await problemOf(lower)).toEqual({ status: 422, code: "validation.failed" });
  });

  it("opens an approval to grow the cohort and rolls back at once without one", async () => {
    const marketing = api(staff("marketing"));
    const before = (await marketing.GET("/v1/admin/loyalty/rollout")).data!;
    const { stage, allowlistCompanyIds, allowlistUserIds } = before.current;
    const grow = { stage, percent: 25, allowlistCompanyIds, allowlistUserIds, reason: "ผ่านเกณฑ์สองสัปดาห์แล้ว" };
    const pending = (
      await marketing.POST("/v1/admin/loyalty/rollout/actions/advance", {
        params: { header: { "Idempotency-Key": "k-adv" } },
        body: grow,
      })
    ).data!;
    expect(pending.status).toBe("pending");
    const rolled = (
      await marketing.POST("/v1/admin/loyalty/rollout/actions/rollback", {
        params: { header: { "Idempotency-Key": "k-back" } },
        body: { ...grow, stage: "uat", percent: 0 },
      })
    ).data!;
    expect(rolled.current.stage).toBe("uat");
    expect(rolled.pendingAdvance).toBeNull();
    const notAnAdvance = marketing.POST("/v1/admin/loyalty/rollout/actions/advance", {
      params: { header: { "Idempotency-Key": "k-no" } },
      body: { ...grow, stage: "internal", percent: 0 },
    });
    expect(await problemOf(notAnAdvance)).toEqual({ status: 422, code: "validation.failed" });
  });
});

describe("integration (API-CHANGES-P4 deviations, D-512)", () => {
  it("lets Finance read the co-funding shares, read-only, and words a share reversed for want of a payable", async () => {
    const shares = (
      await api(staff("finance")).GET("/v1/admin/cofunding-contributions", { params: { query: { perPage: 100 } } })
    ).data!.data;
    expect(shares.length).toBeGreaterThan(0);
    expect(shares.some((row) => row.reverseReason === "no_payable")).toBe(true);
    const withdraw = api(staff("finance")).POST("/v1/admin/cofunding-offers/{offerId}/actions/withdraw", {
      params: { path: { offerId: shares[0]!.offerId } },
      body: { reason: "ทดสอบสิทธิ์การเงินเท่านั้น" },
    });
    expect(await problemOf(withdraw)).toMatchObject({ status: 403 });
  });

  it("names the factory share so far on a capacity deal (factoryShareSoFar)", async () => {
    const deals = (await api(staff("marketing")).GET("/v1/admin/promotions/capacity-deals")).data!.data;
    const funded = deals.find((deal) => deal.funding.acceptedCount > 0)!;
    expect(funded.funding.factoryShareSoFar).toMatch(/^\d+\.\d{2}$/);
  });

  it("opens every surface at the mock's default stage all, guests included", async () => {
    resetLoyaltyP4AdminMock();
    const guest = (await api().GET("/v1/store/loyalty/surfaces")).data!;
    expect(Object.values(guest).every(Boolean)).toBe(true);
    const newcomer = (await api(customer("newcomer")).GET("/v1/store/loyalty/surfaces")).data!;
    expect(Object.values(newcomer).every(Boolean)).toBe(true);
  });
});
