/**
 * Loyalty P1.5 (API-CHANGES-P15): the deals surface, kept in memory — the public list and detail, saving a deal to
 * the wallet, the cart's applicable codes and the price ladder. Fixtures and the API's rules are in
 * `./deals-fixtures.ts`; a hidden or ended deal is never served (list, detail, PDP filter).
 *
 * Registered after the quotation handlers, so the published `GET /v1/store/promotions/mine` is answered there
 * before `/promotions/{slug}` could take "mine" for a slug.
 */

import { HttpResponse } from "msw";

import type { PriceLadder } from "@/lib/api/requests/store-deals";

import { mockRequest } from "../route";
import { mockId, problem } from "../support";
import { cartOf } from "./cart";
import { customerOf } from "./customers";
import { buildDealList, DEAL_FIXTURES, HELD_CODES, isShown, NOT_YET, toDealDetail } from "./deals-fixtures";
import { checkCode, findQuote } from "./quotes";

/** Deals each persona saved in this session (`customer_saved_coupons`). */
const saved = new Map<string, Set<string>>();
const savedOf = (persona: string) => {
  if (!saved.has(persona)) saved.set(persona, new Set(["reorder-points-x2"]));
  return saved.get(persona)!;
};

/** Back to the fixture state — for tests that save a deal. */
export function resetDealsMock() {
  saved.clear();
}

const langOf = (request: Request) =>
  (request.headers.get("accept-language") ?? "th").toLowerCase().startsWith("en") ? ("en" as const) : ("th" as const);
/** The share links the API builds point at the public storefront. */
const ORIGIN = "https://getpack.co";

export const dealsHandlers = [
  // CONTRACT-REQUEST store.promotions.list-public
  mockRequest("GET /v1/store/promotions", ({ request, query }) => {
    const customer = customerOf(request);
    return buildDealList(
      langOf(request),
      {
        origin: ORIGIN,
        ref: query.ref ?? null,
        signedIn: Boolean(customer),
        saved: false,
        savedSlugs: customer ? savedOf(customer.persona) : new Set(),
      },
      { productTypeCode: query.productTypeCode, tab: query.tab },
    );
  }),
  // CONTRACT-REQUEST store.promotions.list-public
  mockRequest("GET /v1/store/promotions/{slug}", ({ request, params }) => {
    const fixture = DEAL_FIXTURES.find((entry) => entry.slug === params.slug);
    if (!fixture || !isShown(fixture)) return problem(404, "promotion.not_found", "ไม่พบดีลนี้");
    const customer = customerOf(request);
    return toDealDetail(fixture, langOf(request), {
      origin: ORIGIN,
      ref: new URL(request.url).searchParams.get("ref"),
      signedIn: Boolean(customer),
      saved: customer ? savedOf(customer.persona).has(fixture.slug) : false,
    });
  }),
  // CONTRACT-REQUEST store.promotions.save
  mockRequest("POST /v1/store/promotions/{promotionId}/actions/save", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    const fixture = DEAL_FIXTURES.find((entry) => mockId("deal", entry.n) === params.promotionId);
    if (!fixture || !isShown(fixture)) return problem(404, "promotion.not_found", "ไม่พบดีลนี้");
    const mine = savedOf(customer.persona);
    if (mine.has(fixture.slug)) return problem(409, "promotion.already_saved", "เก็บโค้ดนี้ไว้แล้ว");
    if (!fixture.code || fixture.forCustomer === "not_eligible" || fixture.forCustomer === "used")
      return problem(409, "promotion.not_saveable", "ดีลนี้เก็บโค้ดไม่ได้");
    mine.add(fixture.slug);
    return HttpResponse.json({ myStatus: "saved" as const }, { status: 201 });
  }),
  // CONTRACT-REQUEST store.cart.applicable-codes
  mockRequest("GET /v1/store/cart/applicable-codes", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    const lang = langOf(request);
    const types = [...new Set(cartOf(customer).items.map((item) => item.productType.code))];
    if (types.length === 0) return { applicable: [], notYet: [], maxCodes: 3 };
    const headlineOf = (code: string) => DEAL_FIXTURES.find((entry) => entry.code === code)?.headline[lang] ?? code;
    const idOf = (code: string) => mockId("deal", DEAL_FIXTURES.find((entry) => entry.code === code)?.n ?? 0);
    // The same check as manual entry: a held code is applicable when some line's type passes it.
    const passing = Object.entries(HELD_CODES).filter(([code]) =>
      types.some((type) => checkCode(code, type).promotion),
    );
    const best = passing.reduce<string | null>(
      (top, [code, held]) =>
        top === null || held.saving.localeCompare(HELD_CODES[top]!.saving, undefined, { numeric: true }) > 0
          ? code
          : top,
      null,
    );
    return {
      applicable: passing.map(([code, held]) => ({
        code,
        promotionId: idOf(code),
        headline: headlineOf(code),
        benefitSummary: held.benefitSummary[lang],
        saving: held.saving,
        stackGroup: held.stackGroup,
        conflictsWith: passing
          .filter(
            ([other, entry]) => other !== code && held.stackGroup !== null && entry.stackGroup === held.stackGroup,
          )
          .map(([other]) => other),
        best: code === best,
      })),
      notYet: Object.entries(NOT_YET).map(([code, entry]) => ({
        code,
        headline: headlineOf(code),
        reason: entry.reason,
        reasonText: entry.reasonText[lang],
      })),
      maxCodes: 3,
    };
  }),
  // CONTRACT-REQUEST store.quotations.ladder
  mockRequest("GET /v1/store/quotations/{quotationId}/ladder", ({ request, params }) => {
    if (!customerOf(request)) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    const quote = findQuote(params.quotationId!);
    if (!quote) return problem(404, "quotation.not_found", "ไม่พบใบเสนอราคา");
    return ladderFor(quote.quantity, quote.productType.code === "corrugated");
  }),
  // CONTRACT-REQUEST store.quotations.ladder
  mockRequest("GET /v1/store/pricing/ladder", ({ query }) => ladderFor(query.quantity ?? 500, true)),
];

/** The fake engine's ladder: the mock prices nothing real, it only keeps the shape and the hint honest. */
function ladderFor(current: number, corrugated: boolean): PriceLadder {
  const rows = [
    { quantity: 300, unitPrice: "16.20" },
    { quantity: 500, unitPrice: "14.79", savingPct: "9" },
    { quantity: 1000, unitPrice: "13.31", savingPct: "18" },
    { quantity: 2000, unitPrice: "12.13", savingPct: "25" },
  ].map((row) => ({ ...row, ...(row.quantity === current ? { current: true } : {}) }));
  const box10 = DEAL_FIXTURES.find((entry) => entry.code === "BOX10")!;
  return {
    unit: "ใบ",
    current,
    rows,
    promoHint:
      corrugated && current < 1000 && isShown(box10)
        ? { promotionId: mockId("deal", box10.n), text: "ลดเพิ่ม 10% เมื่อสั่ง ≥ 1,000 ใบ", estimatedTotal: "11979.00" }
        : null,
  };
}
