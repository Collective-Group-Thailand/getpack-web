/**
 * The style library (`store.styles.*`, `store.styleFavourites.*`, U3.B1–B6), mocked over the
 * programme's master file (`docs/design-tool/style-library-master.json`): every base is published,
 * 122 styles and 986 variants, so the library is measured at the size it launches at (U3.5 §4).
 *
 * A wave-1 base publishes the variants the engine draws (`@getpack/dieline/library`) — what the API
 * does once its recipes are approved (D-243); a later-wave base publishes its axes' combinations
 * up to its master count. Use cases are the master's (D-410); prices, lead times and partner counts
 * are the mock's own fake figures; the shapes are the published DTOs.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import { variantsOf } from "@getpack/dieline";
import { ALL_RECIPES } from "@getpack/dieline/library";

import type { Schemas } from "@/lib/api/types";

import master from "../../docs/design-tool/style-library-master.json" with { type: "json" };
import { catalogueRows } from "../admin/catalogue";
import { bangkokIso, problem } from "../support";
import { catalogProducts } from "./catalog";
import { customerOf } from "./customers";
import { startingOf } from "./quotes";

type Card = Schemas["StyleCardDto"];
type Detail = Schemas["StyleDetailDto"];
type Row = (typeof master.styles)[number];
/** The master's product types as getpack-api maps them (`PRODUCT_TYPE_OF`, D-407). */
const PRODUCT_TYPE_OF: Record<string, string> = {
  folding: "folding_carton",
  corrugate: "corrugated",
  label: "label_sticker",
  tag_sleeve: "tag_sleeve",
  pouch: "flexible_pouch",
  rigid: "rigid_box",
  paper_bag: "paper_bag",
  mailer: "flexible_pouch",
  shrink_sleeve: "label_sticker",
};

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

/** The products a style suits — the master file's `use_cases` (D-410). */
const caseCodesOf = (row: Row): string[] => (row as Row & { use_cases?: string[] }).use_cases ?? [];

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

/** C1: a published style's names, for a product page's "แบบกล่องที่ใช้ได้" (`./catalog.ts`). */
export function publishedStyle(code: string | null | undefined): Schemas["StoreProductStyleDto"] | null {
  const style = code ? byCode.get(code) : undefined;
  return style
    ? { code: style.row.code, nameTh: style.row.name_th, nameEn: style.row.name_en, category: style.row.category }
    : null;
}

/**
 * C1 (products Phase 2): the active catalogue products whose pattern is this style — the admin mock's
 * `patterns.styleCode` — each with its own (mock) starting price, priced ones cheapest first.
 */
function productsOfStyle(code: string): Schemas["StyleProductDto"][] {
  const patternIds = new Set(
    catalogueRows("patterns")
      .filter((p) => p.styleCode === code)
      .map((p) => p.id),
  );
  if (!patternIds.size) return [];
  return catalogProducts()
    .filter((p) => ((p.patterns as { patternId: string }[] | undefined) ?? []).some((e) => patternIds.has(e.patternId)))
    .map((p) => {
      const starting = startingOf(p);
      return {
        slug: String(p.slug),
        nameTh: String(p.nameTh),
        nameEn: String(p.nameEn),
        startingPrice: starting
          ? {
              unitPrice: starting.unitPrice,
              currency: "THB" as const,
              quantity: starting.spec.quantity,
              catalogProductSlug: String(p.slug),
              computedAt: bangkokIso(-60),
              label: starting.spec.specLabel,
            }
          : null,
      };
    })
    .sort((a, b) =>
      a.startingPrice && b.startingPrice
        ? Number(a.startingPrice.unitPrice) - Number(b.startingPrice.unitPrice)
        : a.startingPrice
          ? -1
          : b.startingPrice
            ? 1
            : 0,
    );
}

/** The mock's "starting from": a fake unit price for instant styles only (D-220). */
function startingPrice(s: MockStyle): Schemas["StylePriceDto"] | null {
  if (s.pricePath !== "instant") return null;
  const n = 2 + (s.row.code.split("").reduce((h, c) => h + c.charCodeAt(0), 0) % 40) / 4;
  return {
    catalogProductSlug: s.row.category === "corrugated" ? "shipping-box" : "tuck-end-box",
    computedAt: bangkokIso(-60),
    currency: "THB",
    label: { en: "Reference configuration", th: "สเปกอ้างอิง" },
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

/** The mock's fake inside fit range (mm): first-wave boxes only, from the category's size band; flats have none. */
function fitRangeOf(s: MockStyle): Card["fitRange"] {
  if (s.row.wave !== 1 || s.row.category === "label" || s.row.category === "tag_sleeve") return null;
  return s.row.category === "corrugated"
    ? { minLMm: 100, maxLMm: 800, minWMm: 80, maxWMm: 600, minHMm: 40, maxHMm: 600 }
    : { minLMm: 20, maxLMm: 400, minWMm: 15, maxWMm: 300, minHMm: 20, maxHMm: 450 };
}

/** The API's fit rule (DECISIONS-STAGE-A §4) over the mock's ranges: +5 mm, L/W may swap. */
function fitOf(s: MockStyle, size: { l: number; w: number; h: number }): Card["fit"] {
  const r = fitRangeOf(s);
  if (!r) return null;
  const [a, b, h] = [size.l + 5, size.w + 5, size.h + 5];
  const inside = (v: number, min: number, max: number) => v >= min && v <= max;
  if (!inside(h, r.minHMm, r.maxHMm)) return null;
  if (inside(a, r.minLMm, r.maxLMm) && inside(b, r.minWMm, r.maxWMm))
    return { insideLMm: a, insideWMm: b, insideHMm: h };
  if (inside(b, r.minLMm, r.maxLMm) && inside(a, r.minWMm, r.maxWMm))
    return { insideLMm: b, insideWMm: a, insideHMm: h };
  return null;
}

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
    options: (() => {
      const { closure, feature } = optionFacets(s);
      return [...[...closure].sort(), ...[...feature].sort()];
    })(),
    thumbnailUrl: null,
    photo: null,
    fitRange: fitRangeOf(s),
    // Fake MOQ for the first wave only, so the card's spec row has something to show in the mock.
    moqUnits: s.row.wave === 1 ? 500 : null,
    dielineUrl: s.row.wave === 1 ? `/style-previews/${s.row.code}` : null,
    fit: null,
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
    products: productsOfStyle(s.row.code),
    axes: axesOf(s.row)
      .filter((axis) => values.has(axis))
      .map((axis) => ({ axis, multiSelect: MULTI.has(axis), values: [...values.get(axis)!] })),
    construction: s.row.construction,
    productTypeCode: PRODUCT_TYPE_OF[s.row.product_type] ?? null,
    descriptionEn: null,
    descriptionTh: null,
    leadTime: s.pricePath === "instant" ? { minDays: 7, maxDays: 12 } : null,
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
    useCases: caseCodesOf(s.row),
    variants: s.variants,
    recyclable: null,
    plasticFree: null,
    certifications: [],
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
    // `a,b;c` = (a or b) and c (the API's useCase groups, C0); one value is one group.
    if (
      f.useCase &&
      !f.useCase
        .split(";")
        .filter(Boolean)
        .every((group) => group.split(",").some((code) => caseCodesOf(s.row).includes(code)))
    )
      return false;
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

/** The bases as search hits (`store.catalog.search`, kind `style`): code, names, no photo in the mock. */
export const styleSearchHits = (): Schemas["StoreSearchHitDto"][] =>
  STYLES.map((s) => ({
    kind: "style",
    key: s.row.code,
    titleTh: s.row.name_th,
    titleEn: s.row.name_en,
    imageUrl: null,
    score: 0,
  }));

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
    const sizeMatch = /^(\d+(?:\.\d)?)x(\d+(?:\.\d)?)x(\d+(?:\.\d)?)$/i.exec(p("size") ?? "");
    if (p("size") && !sizeMatch) return problem(422, "validation.failed", "size is length x width x height in mm");
    const size = sizeMatch ? { l: Number(sizeMatch[1]), w: Number(sizeMatch[2]), h: Number(sizeMatch[3]) } : null;
    const fits = (s: MockStyle) => !size || fitOf(s, size) !== null;
    const rows = filterStyles(filters, q).filter(fits);
    if (sort !== "relevance") rows.sort(SORTS[sort] ?? SORTS.popular);
    const customer = customerOf(request);
    const mine = customer ? favouritesOf(customer.id) : null;
    const page = rows.slice(start, start + limit);
    // Facet counts over the matches, each ignoring its own filter so its other values stay offered.
    const facets: Schemas["StyleFacetsDto"] = {
      category: count(filterStyles(filters, q, "category").filter(fits), (s) => [s.row.category]),
      family: count(filterStyles(filters, q, "family").filter(fits), (s) => [s.row.family]),
      closure: count(filterStyles(filters, q, "closure").filter(fits), (s) => optionFacets(s).closure),
      feature: count(filterStyles(filters, q, "feature").filter(fits), (s) => optionFacets(s).feature),
      materialClass: count(filterStyles(filters, q, "materialClass").filter(fits), (s) => [s.row.material_class]),
      pricePath: count(filterStyles(filters, q, "pricePath").filter(fits), (s) => [s.pricePath]),
      useCase: count(filterStyles(filters, q, "useCase").filter(fits), (s) => caseCodesOf(s.row)),
    };
    return HttpResponse.json({
      data: page.map((s) => ({ ...card(s, mine ? mine.has(s.row.code) : null), fit: size ? fitOf(s, size) : null })),
      facets,
      meta: {
        nextCursor: start + limit < rows.length ? String(start + limit) : null,
        sizeSearchStyles: STYLES.filter((s) => fitRangeOf(s) !== null).length,
      },
    } satisfies Schemas["StyleListDto"]);
  }),

  // D-410: every variant as a card — options `axis:value` (one axis's values are alternatives, axes
  // all apply; a variant without the axis reads as `none`), disjunctive option facets.
  http.get("*/v1/store/styles/variants", ({ request }) => {
    const url = new URL(request.url);
    const p = (k: string) => url.searchParams.get(k)?.trim() || undefined;
    const q = p("q");
    const style = p("style");
    const bases = filterStyles(
      { category: p("category"), family: p("family"), materialClass: p("materialClass"), useCase: p("useCase") },
      undefined,
    ).filter(
      (s) => (!style || s.row.code === style) && (!q || matches(s, q) || q.toUpperCase().startsWith(s.row.code)),
    );
    const pricePath = p("pricePath");
    const all = bases.flatMap((s) =>
      s.variants
        .filter((v) => !pricePath || v.pricePath === pricePath)
        .filter((v) => !q || matches(s, q) || v.code.includes(q.toUpperCase()))
        .map((v) => ({ s, v })),
    );
    const wanted = new Map<string, Set<string>>();
    for (const o of url.searchParams.getAll("option").flatMap((x) => x.split(","))) {
      const [axis, value] = o.split(":");
      if (axis && value) wanted.set(axis, (wanted.get(axis) ?? new Set()).add(value));
    }
    const valuesOf = (options: Record<string, unknown>, axis: string) => {
      const value = options[axis];
      const list = (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(String);
      return list.length ? list : ["none"];
    };
    const passes = (options: Record<string, unknown>, except?: string) =>
      [...wanted].every(([axis, values]) => axis === except || valuesOf(options, axis).some((v) => values.has(v)));
    const matched = all.filter(({ v }) => passes(v.options));
    const axes = new Set([...all.flatMap(({ v }) => Object.keys(v.options)), ...wanted.keys()]);
    const option = new Map<string, number>();
    for (const { v } of all)
      for (const axis of axes) {
        if (!passes(v.options, axis)) continue;
        for (const value of new Set(valuesOf(v.options, axis)))
          option.set(`${axis}:${value}`, (option.get(`${axis}:${value}`) ?? 0) + 1);
      }
    const counted = (values: string[]) => {
      const n = new Map<string, number>();
      for (const value of values) n.set(value, (n.get(value) ?? 0) + 1);
      return [...n].map(([value, c]) => ({ value, count: c })).sort((a, b) => b.count - a.count);
    };
    const sort = p("sort") ?? "popular";
    if (sort === "name") matched.sort((a, b) => SORTS.name(a.s, b.s) || a.v.code.localeCompare(b.v.code));
    else if (sort === "instant_first")
      matched.sort((a, b) => Number(b.v.pricePath === "instant") - Number(a.v.pricePath === "instant"));
    else matched.sort((a, b) => SORTS.popular(a.s, b.s));
    const limit = Math.min(100, Math.max(1, Number(p("limit")) || 24));
    const start = Number(p("cursor") ?? 0) || 0;
    return HttpResponse.json({
      data: matched.slice(start, start + limit).map(({ s, v }) => ({
        code: v.code,
        baseCode: s.row.code,
        nameTh: s.row.name_th,
        nameEn: s.row.name_en,
        category: s.row.category,
        family: s.row.family,
        materialClass: s.row.material_class,
        options: v.options,
        pricePath: v.pricePath,
        thumbnailUrl: null,
        photo: null,
      })),
      facets: {
        option: [...option].sort((a, b) => a[0].localeCompare(b[0])).map(([value, n]) => ({ value, count: n })),
        category: counted(matched.map(({ s }) => s.row.category)),
        materialClass: counted(matched.map(({ s }) => s.row.material_class)),
      },
      meta: {
        nextCursor: start + limit < matched.length ? String(start + limit) : null,
        total: matched.length,
        libraryTotal: STYLES.reduce((n, s) => n + s.variants.length, 0),
        libraryStyles: STYLES.length,
      },
    } satisfies Schemas["StyleVariantListDto"]);
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

/*
 * `store.dielines.download` (U2.F2, D-271): the variant's dieline at the customer's sizes, in its
 * style's range for the material class, as a small fake file behind a data URL (the mock draws no
 * dieline); 20 a day per customer, with what is left. The quantities are fake.
 */
const downloadsToday = new Map<string, number>();
const DAILY = 20;
const FAKE_FILE: Record<Schemas["DielineDownloadFormat"], { mime: string; body: string }> = {
  svg: {
    mime: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect x="1" y="1" width="98" height="58" fill="none" stroke="#e00"/></svg>',
  },
  pdf: { mime: "application/pdf", body: "%PDF-1.4\n% mock dieline\n%%EOF\n" },
  dxf: { mime: "image/vnd.dxf", body: "0\nSECTION\n0\nENDSEC\n0\nEOF\n" },
  ai: { mime: "application/illustrator", body: "%PDF-1.4\n% mock dieline (Illustrator)\n%%EOF\n" },
};

storeStyleHandlers.push(
  http.post("*/v1/store/dielines/downloads", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    const body = (await request.json().catch(() => null)) as Schemas["DownloadDielineDto"] | null;
    if (!body || !["pdf", "dxf", "svg", "ai"].includes(body.format))
      return problem(422, "validation.failed", "ข้อมูลไม่ครบ", [
        { path: "format", code: "enum", message: "pdf|dxf|svg|ai" },
      ]);
    const style = [...byCode.values()].find((s) => body.variantCode.startsWith(s.row.code));
    if (!style) return problem(404, "styles.variant_not_found", "ไม่พบแบบกล่องนี้");
    const range = detail(style, null).sizeRanges.find((r) => r.materialClass === body.materialClass);
    if (!range) return problem(422, "dielines.material_class_not_offered", "แบบนี้ไม่มีวัสดุกลุ่มนี้");
    const within = (v: number, min: number | null, max: number | null) =>
      (min === null || v >= min) && (max === null || v <= max);
    if (
      !within(body.lengthMm, range.minLMm, range.maxLMm) ||
      !within(body.widthMm, range.minWMm, range.maxWMm) ||
      (range.maxHMm !== null && !within(body.heightMm, range.minHMm, range.maxHMm))
    )
      return problem(422, "dielines.size_out_of_range", "ขนาดนี้อยู่นอกช่วงที่แบบนี้ทำได้", [
        { path: "lengthMm", code: "range", message: "out of the style's range" },
      ]);
    const used = downloadsToday.get(customer.id) ?? 0;
    if (used >= DAILY) return problem(429, "dielines.rate_limited", "วันนี้ดาวน์โหลดครบจำนวนแล้ว ลองใหม่พรุ่งนี้");
    downloadsToday.set(customer.id, used + 1);
    const file = FAKE_FILE[body.format];
    const sizes = { lengthMm: body.lengthMm, widthMm: body.widthMm, heightMm: body.heightMm };
    return HttpResponse.json(
      {
        id: `0192f3a0-7c1e-7d2a-9b1f-${String(0xd1e0 + used).padStart(12, "0")}`,
        variantCode: body.variantCode,
        materialClass: body.materialClass,
        measurementBasis: body.measurementBasis ?? "internal",
        format: body.format,
        entered: sizes,
        drawn: sizes,
        quantities: {
          blankWidthMm: body.lengthMm * 2 + body.widthMm * 2 + 15,
          blankHeightMm: body.heightMm + body.widthMm * 2,
          cutMm: 1830,
          creaseMm: 960,
          perforationMm: 0,
          halfCutMm: 0,
          glueOutlineMm: 300,
          blankAreaMm2: (body.lengthMm * 2 + body.widthMm * 2 + 15) * (body.heightMm + body.widthMm * 2),
          cutoutAreaMm2: 0,
          pieces: 1,
        },
        fileName: `${body.variantCode}-${body.lengthMm}x${body.widthMm}x${body.heightMm}.${body.format}`,
        mimeType: file.mime,
        sizeBytes: file.body.length,
        url: `data:${file.mime};base64,${Buffer.from(file.body).toString("base64")}`,
        expiresAt: bangkokIso(5),
        createdAt: bangkokIso(),
        cached: false,
        engineVersion: "mock",
        remainingToday: DAILY - used - 1,
        violations: [],
      } satisfies Schemas["DielineDownloadDto"],
      { status: 201 },
    );
  }),
);
