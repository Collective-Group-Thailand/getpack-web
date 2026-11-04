/**
 * Loyalty P1.5: the deals surface, kept in memory — `store.promotions.listPublic` / `getPublic` / `save`,
 * `store.cart.applicableCodes` and `store.quotes.ladder`, in the generated contract's shapes. Fixtures and the API's
 * rules are in `./deals-fixtures.ts`: a hidden or ended deal is never served, an unlisted one only by its link.
 *
 * Registered after the quotation handlers, so the published `GET /v1/store/promotions/mine` is answered there
 * before `/promotions/:slug` could take "mine" for a slug.
 */

import { http, HttpResponse } from "msw";

import type { ApplicableCodes, QuoteLadder } from "@/features/shared/deals/types";

import { mockId, problem } from "../support";
import { cartOf, codes } from "./cart";
import { customerOf } from "./customers";
import {
  buildDealList,
  DEAL_FIXTURES,
  HELD_CODES,
  isLinkable,
  isShown,
  NOT_YET,
  servedTo,
  toDealDetail,
} from "./deals-fixtures";
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
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบข้อมูล");
const DEAL_TABS = new Set(["all", "for_you", "ending_soon", "points"]);

export const dealsHandlers = [
  // store.promotions.listPublic (public; per-customer status when signed in)
  http.get("*/v1/store/promotions", ({ request }) => {
    const query = new URL(request.url).searchParams;
    const tab = query.get("tab");
    if (tab && !DEAL_TABS.has(tab))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "tab", code: "isEnum", message: "tab must be one of all, for_you, ending_soon, points" },
      ]);
    const customer = customerOf(request);
    return HttpResponse.json(
      buildDealList(
        langOf(request),
        {
          origin: ORIGIN,
          ref: query.get("ref"),
          signedIn: Boolean(customer),
          saved: false,
          savedSlugs: customer ? savedOf(customer.persona) : new Set(),
        },
        { productTypeCode: query.get("productTypeCode") ?? undefined, tab: tab ?? undefined },
      ),
    );
  }),
  // store.promotions.getPublic (public): a listed or unlisted deal by its link; 404 for hidden or out of window
  http.get("*/v1/store/promotions/:slug", ({ request, params }) => {
    const fixture = DEAL_FIXTURES.find((entry) => entry.slug === params.slug);
    const customer = customerOf(request);
    // Loyalty P2: a `matching_only` deal answers 404 to a guest.
    if (!fixture || !isLinkable(fixture) || !servedTo(fixture, Boolean(customer))) return notFound();
    return HttpResponse.json(
      toDealDetail(fixture, langOf(request), {
        origin: ORIGIN,
        ref: new URL(request.url).searchParams.get("ref"),
        signedIn: Boolean(customer),
        saved: customer ? savedOf(customer.persona).has(fixture.slug) : false,
      }),
    );
  }),
  // store.promotions.save: 409 promotions.already_saved / promotions.not_saveable
  http.post("*/v1/store/promotions/:promotionId/actions/save", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const fixture = DEAL_FIXTURES.find((entry) => mockId("deal", entry.n) === params.promotionId);
    if (!fixture || !isLinkable(fixture)) return notFound();
    const mine = savedOf(customer.persona);
    if (mine.has(fixture.slug))
      return problem(409, "promotions.already_saved", "โค้ดของดีลนี้อยู่ในบัญชีของคุณแล้ว เลือกใช้ได้ในตะกร้า");
    if (!fixture.code || fixture.forCustomer === "not_eligible" || fixture.forCustomer === "used")
      return problem(409, "promotions.not_saveable", "ดีลนี้ไม่มีโค้ดให้เก็บ หรือคุณใช้สิทธิ์ของดีลนี้ไม่ได้ในตอนนี้");
    mine.add(fixture.slug);
    return HttpResponse.json({ myStatus: "saved" as const }, { status: 201 });
  }),
  // store.cart.applicableCodes: `saving` is ex-VAT
  http.get("*/v1/store/cart/applicable-codes", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const lang = langOf(request);
    const cart = cartOf(customer);
    const types = [...new Set(cart.items.map((item) => item.productType.code))];
    if (types.length === 0) return HttpResponse.json<ApplicableCodes>({ applicable: [], notYet: [], maxCodes: 3 });
    const fixtureOf = (code: string) => DEAL_FIXTURES.find((entry) => entry.code === code);
    const headlineOf = (code: string) => fixtureOf(code)?.headline[lang] ?? code;
    const idOf = (code: string) => mockId("deal", fixtureOf(code)?.n ?? 0);
    const onCart = new Set((codes.get(customer.persona) ?? []).map((entry) => entry.code));
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
    return HttpResponse.json<ApplicableCodes>({
      applicable: passing.map(([code, held]) => ({
        code,
        promotionId: idOf(code),
        headline: headlineOf(code),
        benefitSummary: held.benefitSummary[lang],
        saving: held.saving,
        stackGroup: held.stackGroup,
        stacking: held.stacking,
        conflictsWith: passing
          .filter(
            ([other, entry]) => other !== code && held.stackGroup !== null && entry.stackGroup === held.stackGroup,
          )
          .map(([other]) => other),
        best: code === best,
        onCart: onCart.has(code),
      })),
      notYet: Object.entries(NOT_YET).map(([code, entry]) => ({
        code,
        promotionId: idOf(code),
        headline: headlineOf(code),
        reason: entry.reason,
        reasonText: entry.reasonText[lang],
      })),
      maxCodes: 3,
    });
  }),
  // store.quotes.ladder (public): the owner only — signed in, or the anonymous session that saved it
  http.get("*/v1/store/quotes/:quoteId/ladder", ({ request, params }) => {
    const query = new URL(request.url).searchParams;
    if (!customerOf(request) && !query.get("anonymousId")) return notFound();
    const quote = findQuote(String(params.quoteId));
    if (!quote) return notFound();
    const asked = query.get("quantity");
    const ladder = ladderFor(quote.quantity, asked === null ? quote.quantity : Number(asked), quote.productType.code);
    if (!ladder)
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "quantity", code: "option", message: "not a quantity of this quotation" },
      ]);
    return HttpResponse.json(ladder);
  }),
];

/** The fake engine's ladder: the mock prices nothing real, it only keeps the shape and the hint honest. */
function ladderFor(saved: number, current: number, productTypeCode: string): QuoteLadder | null {
  const steps = [
    { quantity: 300, unitPrice: "16.20", savingPct: null },
    { quantity: 500, unitPrice: "14.79", savingPct: "9" },
    { quantity: 1000, unitPrice: "13.31", savingPct: "18" },
    { quantity: 2000, unitPrice: "12.13", savingPct: "25" },
  ];
  const options = steps.some((step) => step.quantity === saved)
    ? steps
    : [...steps, { quantity: saved, unitPrice: "14.79", savingPct: null }].sort((a, b) => a.quantity - b.quantity);
  if (!options.some((row) => row.quantity === current)) return null;
  const box10 = DEAL_FIXTURES.find((entry) => entry.code === "BOX10")!;
  return {
    unit: "ใบ",
    current,
    rows: options.map((row) => ({ ...row, current: row.quantity === current })),
    promoHint:
      productTypeCode === "corrugated" && current < 1000 && isShown(box10)
        ? { promotionId: mockId("deal", box10.n), text: "ลดเพิ่ม 10% เมื่อสั่ง ≥ 1,000 ใบ", estimatedTotal: "11979.00" }
        : null,
  };
}
