/**
 * Loyalty P1.5 (API-CHANGES-P15): the deals the mock serves — the same set as the Stitch review copy and the UAT
 * seed (which ships `hidden`; here they are public so the screens have something to show). All fake. One deal is
 * `hidden` and one has ended, so the mock proves neither is ever served (PLAN §8 Phase 1.5).
 *
 * The list is built the way the API builds it: shown = public ∧ active ∧ now in [startsAt, endsAt); `endingSoon` =
 * less than 72 h left; text in the request's locale; `myStatus` per signed-in persona.
 */

import type { Deal, DealDetail, DealList, DealMyStatus } from "@/lib/api/requests/store-deals";

import { bangkokIso, mockId } from "../support";

type Lang = "th" | "en";
type Text = Record<Lang, string>;

export interface DealFixture {
  n: number;
  slug: string;
  visibility: "public" | "unlisted" | "hidden";
  featured: boolean;
  headline: Text;
  subline: Text | null;
  badge: Text | null;
  benefit: { kind: Deal["benefit"]["kind"]; value: string; maxDiscount: string | null; summary: Text };
  conditions: { label: Text; value: Text }[];
  productTypeCodes: string[];
  code: string | null;
  /** Days from now; negative = already over. */
  startsInDays: number;
  endsInDays: number | null;
  terms: Text;
  /** What a signed-in customer sees when they have not saved it. */
  forCustomer: DealMyStatus | null;
  notEligibleReason?: string;
}

const t = (th: string, en: string): Text => ({ th, en });
const MIN = t("ขั้นต่ำ", "Minimum");
const WITH = t("ใช้ร่วมกับ", "Combines with");
const FOR = t("ใช้กับ", "Applies to");

export const DEAL_FIXTURES: DealFixture[] = [
  {
    n: 1,
    slug: "box10-corrugated",
    visibility: "public",
    featured: true,
    headline: t("กล่องลูกฟูก 1,000 ใบขึ้นไป ลด 10%", "10% off 1,000+ corrugated boxes"),
    subline: t("เฉพาะกล่องลูกฟูกฝาชน", "Regular slotted cartons only"),
    badge: t("ดีลเด่น", "Featured"),
    benefit: {
      kind: "percent",
      value: "10",
      maxDiscount: "1500.00",
      summary: t("ลด 10% สูงสุด ฿1,500", "10% off, up to ฿1,500"),
    },
    conditions: [
      { label: MIN, value: t("1,000 ใบ", "1,000 pcs") },
      { label: WITH, value: t("คูปองส่งฟรี", "Free-shipping coupon") },
    ],
    productTypeCodes: ["corrugated"],
    code: "BOX10",
    startsInDays: -10,
    endsInDays: 26,
    terms: t(
      "ลด 10% ของราคาสินค้า (รวม VAT) สูงสุด ฿1,500 ต่อคำสั่งซื้อ เมื่อสั่งกล่องลูกฟูกฝาชนตั้งแต่ 1,000 ใบในรายการเดียว ใช้ร่วมกับคูปองส่งฟรีได้ ใช้ร่วมกับส่วนลดสินค้าอื่นไม่ได้",
      "10% off the goods (incl. VAT), up to ฿1,500 per order, for 1,000 or more regular slotted cartons on one line. Combines with a free-shipping coupon, not with other product discounts.",
    ),
    forCustomer: "claimable",
  },
  {
    n: 2,
    slug: "free-shipping-5000",
    visibility: "public",
    featured: false,
    headline: t("ส่งฟรีเมื่อสั่งครบ ฿5,000", "Free shipping on orders of ฿5,000"),
    subline: t("ค่าจัดส่งมาตรฐานทุกปลายทาง", "Standard delivery to any address"),
    badge: null,
    benefit: { kind: "free_shipping", value: "", maxDiscount: null, summary: t("ส่งฟรี", "Free shipping") },
    conditions: [
      { label: MIN, value: t("ยอดสินค้า ฿5,000", "฿5,000 of goods") },
      { label: t("สิทธิ์", "Uses"), value: t("1 ครั้งต่อบัญชี", "Once per account") },
    ],
    productTypeCodes: [],
    code: "FREESHIP",
    startsInDays: -20,
    endsInDays: 57,
    terms: t(
      "ไม่คิดค่าจัดส่งมาตรฐานเมื่อยอดสินค้า (รวม VAT) ครบ ฿5,000 ในคำสั่งซื้อเดียว ใช้ได้ 1 ครั้งต่อบัญชี",
      "Standard delivery is free when the goods (incl. VAT) reach ฿5,000 in one order. Once per account.",
    ),
    forCustomer: "claimable",
  },
  {
    n: 3,
    slug: "label8-5000",
    visibility: "public",
    featured: false,
    headline: t("สติกเกอร์ฉลาก 5,000 ดวงขึ้นไป ลด 8%", "8% off 5,000+ labels"),
    subline: t("ฉลากม้วนทุกเนื้อวัสดุ", "Roll labels, any material"),
    badge: null,
    benefit: {
      kind: "percent",
      value: "8",
      maxDiscount: "800.00",
      summary: t("ลด 8% สูงสุด ฿800", "8% off, up to ฿800"),
    },
    conditions: [{ label: MIN, value: t("5,000 ดวง", "5,000 labels") }],
    productTypeCodes: ["label_sticker"],
    code: "LABEL8",
    startsInDays: -5,
    endsInDays: 2,
    terms: t(
      "ลด 8% ของราคาสติกเกอร์ฉลาก (รวม VAT) สูงสุด ฿800 เมื่อสั่งตั้งแต่ 5,000 ดวงในรายการเดียว",
      "8% off labels (incl. VAT), up to ฿800, for 5,000 or more on one line.",
    ),
    forCustomer: "claimable",
  },
  {
    n: 4,
    slug: "welcome-300",
    visibility: "public",
    featured: false,
    headline: t("คำสั่งซื้อแรก ลด ฿300", "฿300 off your first order"),
    subline: t("สำหรับบัญชีที่ยังไม่เคยสั่งซื้อ", "For accounts that have not ordered yet"),
    badge: null,
    benefit: { kind: "amount", value: "300.00", maxDiscount: null, summary: t("ลด ฿300", "฿300 off") },
    conditions: [{ label: MIN, value: t("ยอดสินค้า ฿1,200", "฿1,200 of goods") }],
    productTypeCodes: [],
    code: "WELCOME300",
    startsInDays: -30,
    endsInDays: 57,
    terms: t(
      "ลด ฿300 จากราคาสินค้า เมื่อยอดสินค้า (รวม VAT) ครบ ฿1,200 ใช้ได้กับคำสั่งซื้อแรกของบัญชีเท่านั้น",
      "฿300 off the goods when they reach ฿1,200 (incl. VAT). First order of the account only.",
    ),
    forCustomer: "not_eligible",
    notEligibleReason: "first_order_only",
  },
  {
    n: 5,
    slug: "reorder-points-x2",
    visibility: "public",
    featured: false,
    headline: t("สั่งซ้ำภายใน 30 วัน รับแต้ม ×2", "Reorder within 30 days for ×2 points"),
    subline: t("นับจากวันจัดส่งคำสั่งซื้อก่อนหน้า", "Counted from the previous delivery"),
    badge: null,
    benefit: {
      kind: "points_multiplier",
      value: "2",
      maxDiscount: null,
      summary: t("แต้มสะสม 2 เท่า", "Double points"),
    },
    conditions: [{ label: FOR, value: t("การสั่งซ้ำแบบเดิม", "Repeat orders") }],
    productTypeCodes: [],
    code: "REORDER2X",
    startsInDays: -3,
    endsInDays: 41,
    terms: t(
      "รับแต้มสะสม 2 เท่าของแต้มปกติ เมื่อสั่งซ้ำสเปกเดิมภายใน 30 วันนับจากวันที่ได้รับคำสั่งซื้อก่อนหน้า",
      "Earn twice the usual points when you reorder the same specification within 30 days of the previous delivery.",
    ),
    forCustomer: "saved",
  },
  {
    n: 6,
    slug: "rigid-box-5",
    visibility: "public",
    featured: false,
    headline: t("กล่องกระดาษแข็ง 500 ใบขึ้นไป ลด 5%", "5% off 500+ folding cartons"),
    subline: t("กล่องฝาเสียบและกล่องฝาครอบ", "Tuck-end and lid boxes"),
    badge: null,
    benefit: { kind: "percent", value: "5", maxDiscount: null, summary: t("ลด 5%", "5% off") },
    conditions: [
      { label: MIN, value: t("500 ใบ", "500 pcs") },
      { label: WITH, value: t("ใช้ร่วมกับคูปองอื่นไม่ได้", "No other coupons") },
    ],
    productTypeCodes: ["folding_carton"],
    code: null,
    startsInDays: -1,
    endsInDays: 51,
    terms: t(
      "ลด 5% ของราคากล่องกระดาษแข็ง (รวม VAT) เมื่อสั่งตั้งแต่ 500 ใบในรายการเดียว ไม่ต้องใช้โค้ด ใช้ร่วมกับคูปองอื่นไม่ได้",
      "5% off folding cartons (incl. VAT) from 500 pieces on one line. No code needed; does not combine with coupons.",
    ),
    forCustomer: null,
  },
  {
    n: 7,
    slug: "matte-free-2000",
    visibility: "public",
    featured: false,
    headline: t("เคลือบด้านฟรี เมื่อสั่ง 2,000 ใบขึ้นไป", "Free matte lamination on 2,000+"),
    subline: null,
    badge: null,
    benefit: { kind: "amount", value: "0.00", maxDiscount: null, summary: t("เคลือบด้านฟรี", "Free matte lamination") },
    conditions: [{ label: MIN, value: t("2,000 ใบ", "2,000 pcs") }],
    productTypeCodes: ["folding_carton"],
    code: "MATTEFREE",
    startsInDays: -8,
    endsInDays: 57,
    terms: t(
      "ไม่คิดค่าเคลือบด้านเมื่อสั่งกล่องกระดาษแข็งตั้งแต่ 2,000 ใบในรายการเดียว",
      "Matte lamination is free on 2,000 or more folding cartons on one line.",
    ),
    forCustomer: "used",
  },
  {
    n: 8,
    slug: "staff-preview",
    visibility: "hidden",
    featured: false,
    headline: t("ดีลทดสอบ (ซ่อน)", "Hidden test deal"),
    subline: null,
    badge: null,
    benefit: { kind: "percent", value: "50", maxDiscount: null, summary: t("ลด 50%", "50% off") },
    conditions: [],
    productTypeCodes: [],
    code: "HIDDEN50",
    startsInDays: -1,
    endsInDays: 10,
    terms: t("ไม่แสดงต่อลูกค้า", "Never shown"),
    forCustomer: "claimable",
  },
  {
    n: 9,
    slug: "ended-deal",
    visibility: "public",
    featured: false,
    headline: t("ดีลที่หมดเวลาแล้ว", "An ended deal"),
    subline: null,
    badge: null,
    benefit: { kind: "percent", value: "15", maxDiscount: null, summary: t("ลด 15%", "15% off") },
    conditions: [],
    productTypeCodes: [],
    code: "OVER15",
    startsInDays: -40,
    endsInDays: -1,
    terms: t("หมดเวลาแล้ว", "Over"),
    forCustomer: "claimable",
  },
];

const DAY_MINUTES = 24 * 60;
const SOON_MS = 72 * 60 * 60 * 1000;

/** Shown = public ∧ active ∧ now in [startsAt, endsAt). */
export function isShown(fixture: DealFixture): boolean {
  return (
    fixture.visibility === "public" &&
    fixture.startsInDays <= 0 &&
    (fixture.endsInDays === null || fixture.endsInDays > 0)
  );
}

export function toDeal(
  fixture: DealFixture,
  lang: Lang,
  options: { origin: string; ref?: string | null; signedIn: boolean; saved: boolean },
): Deal {
  const endsAt = fixture.endsInDays === null ? null : bangkokIso(fixture.endsInDays * DAY_MINUTES);
  const myStatus: DealMyStatus | null = !options.signedIn ? null : options.saved ? "saved" : fixture.forCustomer;
  const share = new URL(`/deals/${fixture.slug}`, options.origin);
  if (options.ref) share.searchParams.set("ref", options.ref);
  return {
    id: mockId("deal", fixture.n),
    slug: fixture.slug,
    featured: fixture.featured,
    headline: fixture.headline[lang],
    subline: fixture.subline?.[lang] ?? null,
    badge: fixture.badge?.[lang] ?? null,
    benefit: { ...fixture.benefit, summary: fixture.benefit.summary[lang] },
    conditions: fixture.conditions.map((entry) => ({ label: entry.label[lang], value: entry.value[lang] })),
    productTypeCodes: fixture.productTypeCodes,
    code: fixture.code,
    startsAt: bangkokIso(fixture.startsInDays * DAY_MINUTES),
    endsAt,
    endingSoon: fixture.endsInDays !== null && fixture.endsInDays * DAY_MINUTES * 60_000 < SOON_MS,
    terms: fixture.terms[lang],
    heroImageUrl: null,
    myStatus,
    notEligibleReason: myStatus === "not_eligible" ? (fixture.notEligibleReason ?? null) : null,
    shareUrl: share.toString(),
  };
}

const GLOBAL_FAQ: { q: Text; a: Text }[] = [
  {
    q: t("ใช้คูปองหลายใบพร้อมกันได้ไหม", "Can I use several coupons at once?"),
    a: t(
      "ได้สูงสุด 3 ใบต่อคำสั่งซื้อ คูปองที่อยู่กลุ่มเดียวกัน เช่น ส่วนลดสินค้าสองใบ ใช้ได้ทีละใบ ตะกร้าจะบอกว่าใบไหนใช้ร่วมกันไม่ได้",
      "Up to 3 per order. Coupons in the same group, such as two product discounts, work one at a time; the cart says which ones do not combine.",
    ),
  },
  {
    q: t("คูปองที่เก็บไว้อยู่ที่ไหน", "Where are the coupons I keep?"),
    a: t(
      "อยู่ในกระเป๋าคูปองของบัญชี และขึ้นในสรุปคำสั่งซื้อของตะกร้าเมื่อใช้กับสินค้าในตะกร้าได้",
      "In your account's coupon wallet; they appear in the cart's order summary when they apply to what is in it.",
    ),
  },
];

export function toDealDetail(fixture: DealFixture, lang: Lang, options: Parameters<typeof toDeal>[2]): DealDetail {
  return {
    ...toDeal(fixture, lang, options),
    faq: [
      { q: lang === "th" ? "เงื่อนไขของดีลนี้คืออะไร" : "What are this deal's terms?", a: fixture.terms[lang] },
      ...GLOBAL_FAQ.map((entry) => ({ q: entry.q[lang], a: entry.a[lang] })),
    ],
  };
}

export function buildDealList(
  lang: Lang,
  options: Parameters<typeof toDeal>[2] & { savedSlugs: ReadonlySet<string> },
  filter: { productTypeCode?: string; tab?: string },
): DealList {
  const shown = DEAL_FIXTURES.filter(isShown).map((fixture) =>
    toDeal(fixture, lang, { ...options, saved: options.savedSlugs.has(fixture.slug) }),
  );
  const byType = filter.productTypeCode
    ? shown.filter((entry) => entry.productTypeCodes.includes(filter.productTypeCode!))
    : shown;
  const soon = byType.filter((entry) => entry.endingSoon);
  const items = filter.tab === "ending_soon" ? soon : filter.tab === "points" ? [] : byType;
  return {
    // Featured first, then the soonest end — the API's display order (the web never re-sorts).
    items: [...items].sort(
      (a, b) => Number(b.featured) - Number(a.featured) || (a.endsAt ?? "9").localeCompare(b.endsAt ?? "9"),
    ),
    counts: { all: byType.length, for_you: byType.length, ending_soon: soon.length, points: 0 },
  };
}

/** What the cart picker offers, per persona: the codes held and the fake engine's savings (a mock is a fake engine). */
export const HELD_CODES: Record<string, { saving: string; stackGroup: string | null; benefitSummary: Text }> = {
  BOX10: { saving: "1331.00", stackGroup: "product", benefitSummary: t("ลด 10% กล่องลูกฟูก", "10% off corrugated") },
  FREESHIP: { saving: "250.00", stackGroup: "shipping", benefitSummary: t("ส่งฟรีทั่วประเทศ", "Free shipping") },
  LABEL8: { saving: "340.00", stackGroup: "product", benefitSummary: t("ลด 8% สติกเกอร์ฉลาก", "8% off labels") },
};

export const NOT_YET: Record<string, { reason: string; reasonText: Text }> = {
  MATTEFREE: { reason: "min_quantity", reasonText: t("สั่งกล่องเพิ่มอีก 1,000 ใบ", "Add 1,000 more boxes") },
  WELCOME300: { reason: "first_order_only", reasonText: t("ใช้ได้เฉพาะคำสั่งซื้อแรก", "First order only") },
};

/** One fixture deal in a given state, for stories and tests (Thai, as the storefront's default). */
export function fixtureDeal(slug: string, myStatus: DealMyStatus | null = "claimable", signedIn = true): Deal {
  const fixture = DEAL_FIXTURES.find((entry) => entry.slug === slug);
  if (!fixture) throw new Error(`no deal fixture ${slug}`);
  const deal = toDeal(fixture, "th", { origin: "https://getpack.co", signedIn, saved: myStatus === "saved" });
  return {
    ...deal,
    myStatus: signedIn ? myStatus : null,
    notEligibleReason: myStatus === "not_eligible" ? (fixture.notEligibleReason ?? "other") : null,
  };
}
