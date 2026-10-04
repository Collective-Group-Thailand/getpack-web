/**
 * The style library (`store.styles.*`, `store.styleFavourites.*`, U3.B1–B6), mocked over the
 * programme's master file (`docs/design-tool/style-library-master.json`): every base is published,
 * 105 styles and 960 variants, so the library is measured at the size it launches at (U3.5 §4).
 *
 * A wave-1 base publishes the variants the engine draws (`@packio/dieline/library`) — what the API
 * does once its recipes are approved (D-243); a later-wave base publishes its axes' combinations
 * up to its master count. Prices, lead times, partner counts and use cases are the mock's own fake
 * figures; the shapes are the published DTOs.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import { variantsOf } from "@packio/dieline";
import { ALL_RECIPES } from "@packio/dieline/library";

import type { Schemas } from "@/lib/api/types";

import master from "../../docs/design-tool/style-library-master.json" with { type: "json" };
import { bangkokIso, problem } from "../support";
import { customerOf } from "./customers";

type Card = Schemas["StyleCardDto"];
type Detail = Schemas["StyleDetailDto"];
type Row = (typeof master.styles)[number];

const axesOf = (row: Row) => row.variant_axes.split(";").filter(Boolean);
const MULTI = new Set(["pouch_feat"]);

/** Closure axes and feature axes, for the two option facets (`axis:value`). */
const CLOSURE_AXES = new Set(["tuck_top", "tuck_bottom", "lock", "mailer_front", "closure_rigid", "corner", "joint"]);

/** Thai / English synonyms a shopper types (U3.5 §1, D-245): the mock's own short list. */
const SYNONYMS: Record<string, string[]> = {
  "PK-CF-01": ["หูช้าง", "กล่องไปรษณีย์", "mailer", "shipping box"],
  "PK-CF-02": ["พิซซ่า", "pizza"],
  "PK-PG-01": ["ถุงกระดาษ", "shopping bag", "carrier bag"],
  "PK-PB-01": ["ซองตั้ง", "doypack", "standing pouch"],
  "PK-SP-01": ["กล่องหมอน", "pillow pack"],
  "PK-SL-02": ["กล่องไม้ขีด", "matchbox", "drawer box"],
  "PK-CS-01": ["กล่องลูกฟูก", "rsc", "กล่องพัสดุ", "carton box"],
  "PK-TE-01": ["กล่องครีม", "กล่องเครื่องสำอาง", "cosmetic box"],
};

const USE_CASES: Record<string, string[]> = {
  folding_carton: ["cosmetics", "food", "retail"],
  corrugated: ["shipping", "ecommerce"],
  rigid: ["gift", "luxury"],
  flexible: ["food", "ecommerce"],
  insert: ["protection"],
  label: ["branding"],
  tag_sleeve: ["branding", "retail"],
};

/** A short, stable variant code from its option key, as the API's `PK-…-XXXX`. */
function variantCode(base: string, key: string): string {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[(h >>> (i * 5)) & 31];
  return `${base}-${out}`;
}

/** The variants a base publishes: the engine's for a drawn base, else its axes' combinations. */
function variantsFor(row: Row): Record<string, unknown>[] {
  const recipes = ALL_RECIPES.filter((r) => r.base === row.code);
  const values = master.axes as Record<string, string[]>;
  if (recipes.length) {
    return recipes.flatMap((r) =>
      variantsOf(r)
        // Only master values (the F4 chamfered tag is not one).
        .filter((v) => Object.entries(v.axes).every(([k, x]) => !values[k] || MULTI.has(k) || values[k].includes(x)))
        .map((v) => {
          const options: Record<string, unknown> = {};
          for (const axis of axesOf(row)) {
            const value = v.axes[axis];
            if (value === undefined) continue;
            options[axis] = MULTI.has(axis) ? (value === "none" ? [] : value.split("+")) : value;
          }
          return options;
        }),
    );
  }
  let combos: Record<string, unknown>[] = [{}];
  for (const axis of axesOf(row))
    combos = combos.flatMap((c) =>
      MULTI.has(axis)
        ? [[], ...values[axis].map((x) => [x])].map((x) => ({ ...c, [axis]: x }))
        : values[axis].map((x) => ({ ...c, [axis]: x })),
    );
  return combos.slice(0, row.distinct_variants);
}

const optionKey = (options: Record<string, unknown>) =>
  Object.entries(options)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? [...v].sort().join("+") || "none" : String(v)}`)
    .join(";");

interface MockStyle {
  row: Row;
  variants: Schemas["StyleVariantRefDto"][];
  pricePath: Schemas["QuoteMode"];
  popularity: number;
  publishedAt: string;
}

const STYLES: MockStyle[] = master.styles.map((row, index) => {
  const pricePath: Schemas["QuoteMode"] = row.pricing_path_at_launch.startsWith("instant") ? "instant" : "rfq";
  return {
    row,
    pricePath,
    // Fake popularity: the first wave first, then the master's order.
    popularity: (row.wave === 1 ? 1000 : 0) - index,
    publishedAt: bangkokIso(-(index + 1) * 60 * 24),
    variants: variantsFor(row).map((options) => ({
      code: variantCode(row.code, optionKey(options)),
      configurationPatches: [],
      options,
      pricePath,
      priceReasons: pricePath === "instant" ? [] : ["calculator_not_signed"],
    })),
  };
});

const byCode = new Map(STYLES.map((s) => [s.row.code, s]));

/** The mock's "starting from": a fake unit price for instant styles only (D-220). */
function startingPrice(s: MockStyle): Schemas["StylePriceDto"] | null {
  if (s.pricePath !== "instant") return null;
  const n = 2 + (s.row.code.split("").reduce((h, c) => h + c.charCodeAt(0), 0) % 40) / 4;
  return {
    catalogProductSlug: s.row.category === "corrugated" ? "shipping-box" : "tuck-end-box",
    computedAt: bangkokIso(-60),
    currency: "THB",
    quantity: 1000,
    unitPrice: n.toFixed(2),
  };
}

/** Favourites per customer (D-246). */
const favourites = new Map<string, Map<string, string>>();
const favouritesOf = (customerId: string) => {
  let set = favourites.get(customerId);
  if (!set) favourites.set(customerId, (set = new Map()));
  return set;
};

function card(s: MockStyle, favourite: boolean | null): Card {
  return {
    category: s.row.category,
    code: s.row.code,
    family: s.row.family,
    favourite,
    featured: s.row.code === "PK-TE-01" || s.row.code === "PK-CF-01",
    materialClass: s.row.material_class,
    nameEn: s.row.name_en,
    nameTh: s.row.name_th,
    pricePath: s.pricePath,
    referenceCode: null,
    startingPrice: startingPrice(s),
    variantCount: s.variants.length,
  };
}

function detail(s: MockStyle, favourite: boolean | null): Detail {
  const values = new Map<string, Set<string>>();
  for (const v of s.variants)
    for (const [axis, value] of Object.entries(v.options)) {
      const set = values.get(axis) ?? new Set<string>();
      for (const x of Array.isArray(value) ? value : [value]) set.add(String(x));
      values.set(axis, set);
    }
  const range = (min: number, max: number) => ({ min, max });
  const size =
    s.row.category === "corrugated"
      ? { l: range(100, 800), w: range(80, 600), h: range(40, 600) }
      : s.row.category === "label" || s.row.category === "tag_sleeve"
        ? { l: range(20, 300), w: range(15, 200), h: range(0, 0) }
        : { l: range(20, 400), w: range(15, 300), h: range(20, 450) };
  return {
    ...card(s, favourite),
    assets: [],
    axes: axesOf(s.row)
      .filter((axis) => values.has(axis))
      .map((axis) => ({ axis, multiSelect: MULTI.has(axis), values: [...values.get(axis)!] })),
    construction: s.row.construction,
    descriptionEn: null,
    descriptionTh: null,
    leadTime: s.pricePath === "instant" ? { minDays: 7, maxDays: 12 } : null,
    partnersCount: s.row.wave === 1 ? 4 : null,
    sizeRanges: [
      {
        materialClass: s.row.material_class,
        minLMm: size.l.min,
        maxLMm: size.l.max,
        minWMm: size.w.min,
        maxWMm: size.w.max,
        minHMm: size.h.max ? size.h.min : null,
        maxHMm: size.h.max ? size.h.max : null,
        source: s.row.wave === 1 ? "recipe" : "pattern_rules",
      },
    ],
    useCases: USE_CASES[s.row.category] ?? [],
    variants: s.variants,
  };
}

const norm = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

function matches(s: MockStyle, q: string): boolean {
  const hay = [
    s.row.code,
    s.row.name_th,
    s.row.name_en,
    s.row.family.replaceAll("_", " "),
    ...(SYNONYMS[s.row.code] ?? []),
  ]
    .map(norm)
    .join(" | ");
  return norm(q)
    .split(" ")
    .every((word) => hay.includes(word));
}

/** Every `axis:value` a style offers, split into closures and features. */
function optionFacets(s: MockStyle) {
  const closure = new Set<string>();
  const feature = new Set<string>();
  for (const v of s.variants)
    for (const [axis, value] of Object.entries(v.options))
      for (const x of Array.isArray(value) ? value : [value]) {
        if (x === "none") continue;
        (CLOSURE_AXES.has(axis) ? closure : feature).add(`${axis}:${String(x)}`);
      }
  return { closure, feature };
}

type Filters = Partial<
  Record<"category" | "family" | "closure" | "feature" | "materialClass" | "pricePath" | "useCase", string>
>;

function filterStyles(filters: Filters, q: string | undefined, skip?: keyof Filters): MockStyle[] {
  return STYLES.filter((s) => {
    const f = { ...filters };
    if (skip) delete f[skip];
    if (f.category && s.row.category !== f.category) return false;
    if (f.family && s.row.family !== f.family) return false;
    if (f.materialClass && s.row.material_class !== f.materialClass) return false;
    if (f.pricePath && s.pricePath !== f.pricePath) return false;
    if (f.useCase && !(USE_CASES[s.row.category] ?? []).includes(f.useCase)) return false;
    const options = optionFacets(s);
    if (f.closure && !options.closure.has(f.closure)) return false;
    if (f.feature && !options.feature.has(f.feature)) return false;
    return !q || matches(s, q);
  });
}

function count(rows: MockStyle[], values: (s: MockStyle) => Iterable<string>): Schemas["StyleFacetValueDto"][] {
  const counts = new Map<string, number>();
  for (const s of rows) for (const v of new Set(values(s))) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .map(([value, n]) => ({ value, count: n }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

const SORTS: Record<string, (a: MockStyle, b: MockStyle) => number> = {
  popular: (a, b) => b.popularity - a.popularity,
  new: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
  instant_first: (a, b) =>
    Number(b.pricePath === "instant") - Number(a.pricePath === "instant") || b.popularity - a.popularity,
  name: (a, b) => a.row.name_th.localeCompare(b.row.name_th, "th"),
};

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบแบบกล่องนี้");

export const storeStyleHandlers: HttpHandler[] = [
  http.get("*/v1/store/styles", ({ request }) => {
    const url = new URL(request.url);
    const p = (k: string) => url.searchParams.get(k)?.trim() || undefined;
    const filters: Filters = {
      category: p("category"),
      family: p("family"),
      closure: p("closure"),
      feature: p("feature"),
      materialClass: p("materialClass"),
      pricePath: p("pricePath"),
      useCase: p("useCase"),
    };
    const q = p("q");
    const sort = p("sort") ?? (q ? "relevance" : "popular");
    const limit = Math.min(100, Math.max(1, Number(p("limit")) || 24));
    const start = Number(p("cursor") ?? 0) || 0;
    const rows = filterStyles(filters, q);
    if (sort !== "relevance") rows.sort(SORTS[sort] ?? SORTS.popular);
    const customer = customerOf(request);
    const mine = customer ? favouritesOf(customer.id) : null;
    const page = rows.slice(start, start + limit);
    // Facet counts over the matches, each ignoring its own filter so its other values stay offered.
    const facets: Schemas["StyleFacetsDto"] = {
      category: count(filterStyles(filters, q, "category"), (s) => [s.row.category]),
      family: count(filterStyles(filters, q, "family"), (s) => [s.row.family]),
      closure: count(filterStyles(filters, q, "closure"), (s) => optionFacets(s).closure),
      feature: count(filterStyles(filters, q, "feature"), (s) => optionFacets(s).feature),
      materialClass: count(filterStyles(filters, q, "materialClass"), (s) => [s.row.material_class]),
      pricePath: count(filterStyles(filters, q, "pricePath"), (s) => [s.pricePath]),
      useCase: count(filterStyles(filters, q, "useCase"), (s) => USE_CASES[s.row.category] ?? []),
    };
    return HttpResponse.json({
      data: page.map((s) => card(s, mine ? mine.has(s.row.code) : null)),
      facets,
      meta: { nextCursor: start + limit < rows.length ? String(start + limit) : null },
    } satisfies Schemas["StyleListDto"]);
  }),

  http.get("*/v1/store/styles/compare", ({ request }) => {
    const codes = (new URL(request.url).searchParams.get("codes") ?? "").split(",").filter(Boolean);
    if (codes.length === 0 || codes.length > 3) return problem(400, "validation.failed", "เลือกแบบกล่องได้ 1–3 แบบ");
    const customer = customerOf(request);
    const mine = customer ? favouritesOf(customer.id) : null;
    const found = codes.map((c) => byCode.get(c));
    if (found.some((s) => !s)) return notFound();
    return HttpResponse.json(found.map((s) => detail(s!, mine ? mine.has(s!.row.code) : null)));
  }),

  http.get("*/v1/store/styles/:code", ({ request, params }) => {
    const s = byCode.get(String(params.code));
    if (!s) return notFound();
    const customer = customerOf(request);
    return HttpResponse.json(detail(s, customer ? favouritesOf(customer.id).has(s.row.code) : null));
  }),

  http.get("*/v1/store/style-favourites", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const mine = favouritesOf(customer.id);
    return HttpResponse.json(
      [...mine]
        .reverse()
        .map(
          ([code, addedAt]) =>
            ({ addedAt, style: card(byCode.get(code)!, true) }) satisfies Schemas["StyleFavouriteDto"],
        ),
    );
  }),

  http.put("*/v1/store/style-favourites/:code", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const code = String(params.code);
    if (!byCode.has(code)) return notFound();
    const mine = favouritesOf(customer.id);
    if (!mine.has(code)) mine.set(code, bangkokIso());
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("*/v1/store/style-favourites/:code", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    favouritesOf(customer.id).delete(String(params.code));
    return new HttpResponse(null, { status: 204 });
  }),
];
