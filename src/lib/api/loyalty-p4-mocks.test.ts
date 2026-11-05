// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { resetCofundingMock } from "../../../mocks/admin/cofunding-state";
import { resetLoyaltyP4AdminMock, setMockBudgetSpent } from "../../../mocks/admin/loyalty-p4";
import { settings } from "../../../mocks/admin/platform";
import { handlers } from "../../../mocks/handlers";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";
import { isApiError } from "./problem";
import { createRequestClient } from "./requests/client";
import { REQUESTS } from "./requests/registry";

/**
 * The P4 mocks keep API-CHANGES-P4's rules, so the screens are built against them: the surfaces a store caller gets
 * (seven flags, never `capacityDeals`, guests at stage `all` only), the `loyalty.feature_disabled` guards, the company
 * claims on the checklist, the co-funding offer life cycle on both sides, the budget and the rollout's grow / shrink
 * rule.
 */
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  resetCofundingMock();
  resetLoyaltyP4AdminMock();
  setFlag("deals", true);
});
afterAll(() => server.close());

const api = (token?: string) =>
  createApiClient({ baseUrl: "http://api.mock", ...(token ? { accessToken: token } : {}) });
const requests = (token?: string) => createRequestClient(REQUESTS, api(token) as unknown as Client<never>);
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
    const flags = await requests(customer()).call("GET /v1/store/loyalty/surfaces");
    expect(Object.keys(flags).sort()).toEqual(
      ["checklist", "deals", "dealsLiff", "pointsLiff", "quoteRecovery", "redeem", "tierPerks"].sort(),
    );
    expect(Object.values(flags).every(Boolean)).toBe(true);
  });

  it("closes everything for an account outside the cohort and for a guest before stage all", async () => {
    const newcomer = await requests(customer("newcomer")).call("GET /v1/store/loyalty/surfaces");
    expect(Object.values(newcomer).some(Boolean)).toBe(false);
    const guest = await requests().call("GET /v1/store/loyalty/surfaces");
    expect(Object.values(guest).some(Boolean)).toBe(false);
    const config = (await api().GET("/v1/store/public-config")).data as unknown as { loyaltySurfaces: object };
    expect(config.loyaltySurfaces).toEqual(guest);
  });

  it("follows the setting: a closed flag closes its surface and its store endpoints", async () => {
    setFlag("deals", false);
    expect((await requests(customer()).call("GET /v1/store/loyalty/surfaces")).deals).toBe(false);
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
    const claimed = tasks.tasks.filter((task) => (task.status as string) === "claimed_by_company");
    expect(claimed.map((task) => task.code).sort()).toEqual(["brand_kit", "tax_profile"]);
    expect(claimed.some((task) => task.recommended)).toBe(false);
    const todo = tasks.tasks.filter((task) => task.status === "todo").reduce((sum, task) => sum + task.points, 0);
    expect(tasks.remainingPoints).toBe(Math.min(todo, tasks.capRemainingPoints));
    expect(JSON.stringify(claimed)).not.toMatch(/user|member|name/i);
  });
});

describe("co-funding offers", () => {
  it("lets the factory owner accept its proposed offer once, and shows it accepted to Marketing", async () => {
    const list = await requests(accessToken("partner", "owner")).call("GET /v1/partner/cofunding-offers");
    const proposed = list.data.find((offer) => offer.status === "proposed")!;
    expect(proposed.nextActions).toEqual(["accept", "decline"]);
    expect(proposed.termsText).toBe("40 % ของส่วนลดดีล สูงสุด ฿20,000");
    const accepted = await requests(accessToken("partner", "owner")).call(
      "POST /v1/partner/cofunding-offers/{offerId}/actions/accept",
      { path: { offerId: proposed.id }, body: {}, idempotencyKey: "k-accept" },
    );
    expect(accepted).toMatchObject({ status: "accepted", nextActions: [] });
    const again = requests(accessToken("partner", "owner")).call(
      "POST /v1/partner/cofunding-offers/{offerId}/actions/accept",
      { path: { offerId: proposed.id }, body: {}, idempotencyKey: "k-again" },
    );
    expect(await problemOf(again)).toEqual({ status: 409, code: "cofunding.invalid_transition" });
    const admin = await requests(staff("marketing")).call("GET /v1/admin/promotions/{promotionId}/cofunding-offers", {
      path: { promotionId: proposed.promotionId },
    });
    expect(admin.data.find((offer) => offer.id === proposed.id)?.status).toBe("accepted");
  });

  it("refuses a second live offer to the same factory on the same deal", async () => {
    const [offer] = (
      await requests(staff("marketing")).call("GET /v1/admin/promotions/{promotionId}/cofunding-offers", {
        path: { promotionId: "00000000-0000-4000-8000-70726d000028" },
      })
    ).data;
    const create = requests(staff("marketing")).call("POST /v1/admin/promotions/{promotionId}/cofunding-offers", {
      path: { promotionId: offer!.promotionId },
      idempotencyKey: "k-1",
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
    const list = await requests(accessToken("partner", "accountant")).call("GET /v1/partner/cofunding-offers");
    expect(list.data.every((offer) => offer.nextActions.length === 0)).toBe(true);
    const others = requests(accessToken("partner", "owner")).call("GET /v1/partner/cofunding-offers/{offerId}", {
      path: { offerId: "00000000-0000-4000-8000-63666f000002" },
    });
    expect(await problemOf(others)).toMatchObject({ status: 404 });
  });
});

describe("programme budget and rollout", () => {
  it("reads 84 % as a warning and 100 % as exhausted", async () => {
    const warning = await requests(staff("marketing")).call("GET /v1/admin/loyalty/programme-budget");
    expect(warning).toMatchObject({ usedPct: "84.00", state: "warning" });
    setMockBudgetSpent("250000.00");
    const full = await requests(staff("marketing")).call("GET /v1/admin/loyalty/programme-budget");
    expect(full).toMatchObject({ usedPct: "100.00", state: "exhausted" });
  });

  it("asks an override to raise the budget and refuses a lower amount", async () => {
    const lower = requests(staff("marketing")).call("POST /v1/admin/loyalty/programme-budget/overrides", {
      body: {
        month: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7),
        amount: "1000.00",
        reason: "ลองลดงบดูก่อนนะครับ",
      },
      idempotencyKey: "k-low",
    });
    expect(await problemOf(lower)).toEqual({ status: 422, code: "validation.failed" });
  });

  it("opens an approval to grow the cohort and rolls back at once without one", async () => {
    const before = await requests(staff("marketing")).call("GET /v1/admin/loyalty/rollout");
    const target = { ...before.current, percent: 25, reason: "ผ่านเกณฑ์สองสัปดาห์แล้ว" };
    const { settingVersionId: _v, effectiveFrom: _e, ...grow } = target;
    const pending = await requests(staff("marketing")).call("POST /v1/admin/loyalty/rollout/actions/advance", {
      body: grow,
      idempotencyKey: "k-adv",
    });
    expect(pending.status).toBe("pending");
    const rolled = await requests(staff("marketing")).call("POST /v1/admin/loyalty/rollout/actions/rollback", {
      body: { ...grow, stage: "uat", percent: 0 },
      idempotencyKey: "k-back",
    });
    expect(rolled.current.stage).toBe("uat");
    expect(rolled.pendingAdvance).toBeNull();
    const notAnAdvance = requests(staff("marketing")).call("POST /v1/admin/loyalty/rollout/actions/advance", {
      body: { ...grow, stage: "internal", percent: 0 },
      idempotencyKey: "k-no",
    });
    expect(await problemOf(notAnAdvance)).toEqual({ status: 422, code: "validation.failed" });
  });
});
