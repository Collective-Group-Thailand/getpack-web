/**
 * Loyalty P4 (D-508, D-509, D-510): which loyalty surfaces are open, the `loyalty.feature_disabled` guards on the store
 * endpoints, and the company one-off claims on the earn checklist.
 *
 * - `store.loyalty.surfaces` (`mockOperation`, typed by the generated contract). Flags are the `loyalty.surfaces` setting of the
 *   admin mock (so a switch on `/marketing/loyalty` shows at once); with a token they are ANDed with the caller's
 *   cohort, without one they are the anonymous view (open only at stage `all`).
 * - The mock's cohort stands in for the API's hash: at stage `percent` every persona but `newcomer` is in (the
 *   newcomer shows the out-of-cohort state); at `internal` / `uat` only the allowlisted `returning` and company
 *   personas; at `all` everyone.
 * - The guards answer 404 `loyalty.feature_disabled` for the store reads and writes API-CHANGES-P4 lists, and pass
 *   through (to the P1.5 / P3 handlers) otherwise. Guests follow the flags only, as the API's guard does for a call
 *   without a cohort key.
 * - `companybuyer` is the second member of a verified company: `tax_profile` and `brand_kit` were earned by the
 *   company's first member, so its checklist shows them `claimed_by_company` (never who).
 */

import { http, HttpResponse } from "msw";

import type { LoyaltyTasks } from "@/features/customer/account/loyalty-types";
import type { LoyaltySurfaces, StoreLoyaltySurface } from "@/features/shared/loyalty-p4/types";

import { rolloutInForce, surfaceSetting } from "../admin/loyalty-p4";
import { mockOperation } from "../route";
import { principalOf, problem } from "../support";
import { customerOf, type MockCustomer } from "./customers";

const ALLOWLISTED = new Set(["returning", "companyadmin", "companybuyer"]);

/** Whether a signed-in customer is in the rollout cohort (the mock's stand-in for the API's bucket). */
export function inCohort(customer: MockCustomer): boolean {
  const { stage } = rolloutInForce();
  if (stage === "all") return true;
  if (stage === "percent") return customer.persona !== "newcomer";
  return ALLOWLISTED.has(customer.persona);
}

/** The seven store flags for this request (never `capacityDeals`). */
export function surfacesFor(request: Request): LoyaltySurfaces {
  const flags = surfaceSetting();
  const customer = principalOf(request)?.audience === "customer" ? customerOf(request) : null;
  const open = customer ? inCohort(customer) : rolloutInForce().stage === "all";
  const pick = (key: StoreLoyaltySurface) => flags[key] && open;
  return {
    deals: pick("deals"),
    dealsLiff: pick("dealsLiff"),
    redeem: pick("redeem"),
    tierPerks: pick("tierPerks"),
    checklist: pick("checklist"),
    pointsLiff: pick("pointsLiff"),
    quoteRecovery: pick("quoteRecovery"),
  };
}

/** `store.publicConfig.get` `loyaltySurfaces`: the setting, open only at stage `all` (the anonymous view). */
export function anonymousSurfaces(): LoyaltySurfaces {
  return surfacesFor(new Request("http://api.mock/v1/store/public-config"));
}

/** The guard of a store endpoint: guests by the flag, customers by the flag and their cohort. */
function closed(request: Request, surface: "deals" | "redeem" | "checklist"): Response | undefined {
  const customer = principalOf(request)?.audience === "customer" ? customerOf(request) : null;
  const open = surfaceSetting()[surface] && (!customer || inCohort(customer));
  return open
    ? undefined
    : HttpResponse.json(
        {
          type: "https://errors.getpack/loyalty.feature_disabled",
          title: "Not available",
          status: 404,
          code: "loyalty.feature_disabled",
          detail: "ส่วนนี้ยังไม่เปิดให้บริการ",
          params: { surface },
        },
        { status: 404, headers: { "content-type": "application/problem+json" } },
      );
}

const CLAIMED_BY_COMPANY = new Set(["tax_profile", "brand_kit"]);

/**
 * The checklist as the API answers it for a second member of a verified company: the company's one-offs are
 * `claimed_by_company`, out of `remainingPoints` and never recommended, after the open tasks (D-508).
 */
export function withCompanyClaims(tasks: LoyaltyTasks, customer: MockCustomer | null): LoyaltyTasks {
  if (customer?.persona !== "companybuyer") return tasks;
  const claimed = tasks.tasks
    .filter((task) => CLAIMED_BY_COMPANY.has(task.code) && task.status === "todo")
    .map((task) => ({ ...task, status: "claimed_by_company" as const, recommended: false }));
  if (claimed.length === 0) return tasks;
  const rest = tasks.tasks.filter((task) => !claimed.some((other) => other.code === task.code));
  const open = rest.filter((task) => task.status !== "done");
  const done = rest.filter((task) => task.status === "done");
  const todoPoints = open.filter((task) => task.status === "todo").reduce((sum, task) => sum + task.points, 0);
  const recommended = open.find((task) => task.status === "todo");
  return {
    ...tasks,
    tasks: [
      ...open.map((task) => ({ ...task, recommended: task === recommended && tasks.capRemainingPoints > 0 })),
      ...claimed,
      ...done,
    ],
    remainingPoints: Math.min(todoPoints, tasks.capRemainingPoints),
  };
}

const passThrough = (slug: string | undefined) => slug === "mine" || slug === "actions";

export const loyaltyP4Handlers = [
  mockOperation(
    "get",
    "/v1/store/loyalty/surfaces",
    ({ request }) => {
      if (!principalOf(request) && request.headers.get("authorization"))
        return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน");
      return surfacesFor(request);
    },
    { public: true },
  ),
  // Guards (D-509, D-510): answered before the P1.5 / P3 handlers, which they pass through to when open.
  http.get("*/v1/store/promotions", ({ request }) => closed(request, "deals")),
  http.get("*/v1/store/promotions/:slug", ({ request, params }) =>
    passThrough(params.slug as string) ? undefined : closed(request, "deals"),
  ),
  http.post("*/v1/store/promotions/:promotionId/actions/save", ({ request }) => closed(request, "deals")),
  http.get("*/v1/store/rewards", ({ request }) => closed(request, "redeem")),
  http.get("*/v1/store/rewards/:itemId/preview", ({ request }) => closed(request, "redeem")),
  http.post("*/v1/store/rewards/:itemId/actions/redeem", ({ request }) => closed(request, "redeem")),
  http.get("*/v1/store/loyalty/tasks", ({ request }) => closed(request, "checklist")),
];
