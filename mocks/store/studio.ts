/**
 * Packio 3D Studio (U4.B*, contract v0.41.0): the studio's own operations over the customer's
 * designs (`./designs.ts` keeps the rows and each version's box, D-275).
 *
 * - `store.studio.quote` (D-277): prices the version's spec through the same fake engine as
 *   `store.quotes.calculate`, answers a `specHash` of the canonical input and, against
 *   `previousSpecHash`, the reasons and per-quantity unit prices that changed. A spec that
 *   disagrees with its box is `409 studio.spec_mismatch`, one never saved `409 studio.spec_missing`;
 *   a type quoted on request answers `mode: rfq` with no calculation.
 */

import { http, HttpResponse } from "msw";

import { canonicalJson } from "@/features/designer/lib/json-patch";
import studioRules from "../../contract/studio-rules.json";
import { TEMPLATE_LIBRARY } from "@/features/designer/templates/library";
import type { Schemas } from "@/lib/api/types";

import { problem } from "../support";
import { typeCodeOf } from "./catalog";
import { designRowFor, versionBoxOf, type StudioBox } from "./designs";
import { configuratorOf, inputsOf, productOfId, stepOf } from "./quotes";

type Reason = Schemas["PriceChangeReason"];

interface Snapshot {
  input: { productTypeCode: string; configuration: Record<string, unknown>; deliveryPostcode: string | null };
  steps: Schemas["QuoteStepDto"][];
}

/** specHash → what it priced (the API's `studio_quote_snapshots`). */
const snapshots = new Map<string, Snapshot>();

/** A 64-hex stand-in for sha256 (FNV-1a, four lanes): equal canonical input, equal hash. */
function fakeSha256(text: string): string {
  let out = "";
  for (let lane = 0; lane < 4; lane++) {
    let hash = 0x811c9dc5 ^ lane;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    out += hash.toString(16).padStart(8, "0").repeat(2);
  }
  return out;
}

const SIZE_KEYS = [
  ["l", "lengthMm"],
  ["w", "widthMm"],
  ["d", "heightMm"],
] as const;

/** The box's sizes, basis, material and pattern filled into the spec; a disagreement is a problem. */
function configurationOf(box: StudioBox, quantities: number[]) {
  const spec = { ...(box.spec ?? {}) };
  const problems: string[] = [];
  const agree = (key: string, specValue: unknown, boxValue: unknown) => {
    if (specValue !== undefined && boxValue !== undefined && specValue !== boxValue) problems.push(key);
  };
  agree("patternId", spec.patternId, box.patternId);
  agree("materialId", spec.materialId, box.materialId);
  for (const [key, boxKey] of SIZE_KEYS) agree(key, spec[key], box[boxKey]);
  agree("basis", spec.basis, box.measurementBasis);
  return { configuration: { ...spec, quantities: [...quantities].sort((a, b) => a - b) }, problems };
}

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

/** packio-api's `changeReasons`, as far as the mock's configurations go. */
function reasonsBetween(previous: Snapshot["input"], next: Snapshot["input"]): Reason[] {
  const a = previous.configuration;
  const b = next.configuration;
  const reasons = new Set<Reason>();
  const mark = (keys: string[], reason: Reason) => {
    if (keys.some((key) => !same(a[key], b[key]))) reasons.add(reason);
  };
  if (previous.productTypeCode !== next.productTypeCode) reasons.add("style_changed");
  mark(["patternId", "styleVariantCode", "catalogProductId"], "style_changed");
  mark(["l", "w", "d", "basis"], "size_changed");
  mark(["materialId"], "material_changed");
  mark(["quantities"], "quantity_changed");
  const parts = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);
  const pa = parts(a.parts);
  const pb = parts(b.parts);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? {};
    const y = pb[i] ?? {};
    if (["printFront", "printBack"].some((k) => !same(x[k], y[k]))) reasons.add("print_changed");
    if (["finish1FrontId", "finish1BackId", "finish2"].some((k) => !same(x[k], y[k]))) reasons.add("finishes_changed");
  }
  if (["printFront", "printBack", "printColourId"].some((k) => !same(a[k], b[k]))) reasons.add("print_changed");
  if (previous.deliveryPostcode !== next.deliveryPostcode) reasons.add("delivery_changed");
  const order: Reason[] = [
    "style_changed",
    "size_changed",
    "material_changed",
    "print_changed",
    "finishes_changed",
    "quantity_changed",
    "delivery_changed",
    "options_changed",
    "prices_changed",
  ];
  return order.filter((reason) => reasons.has(reason));
}

const unitPrices = (steps: Schemas["QuoteStepDto"][]) =>
  new Map(steps.filter((s) => s.instant && s.unitPrice).map((s) => [s.quantity, s.unitPrice!] as const));

export const storeStudioHandlers = [
  http.post("*/v1/store/studio/:designId/quote", async ({ params, request }) => {
    const row = designRowFor(request, String(params.designId));
    if (row instanceof Response) return row;
    const body = (await request.json()) as Schemas["StudioQuoteRequestDto"];
    if (!Array.isArray(body.quantities) || body.quantities.length === 0 || body.quantities.length > 10)
      return problem(422, "validation.failed", "ระบุจำนวน 1–10 ระดับ", [
        { path: "quantities", code: "size", message: "1 to 10 quantities" },
      ]);
    const version = versionBoxOf(row, body.versionNo);
    if (!version) return problem(404, "http.not_found", "ไม่พบเวอร์ชันนี้");
    if (!version.box?.spec) return problem(409, "studio.spec_missing", "แบบนี้ยังไม่มีสเปกสำหรับคำนวณราคา");
    const { configuration, problems } = configurationOf(version.box, body.quantities);
    if (problems.length > 0)
      return problem(
        409,
        "studio.spec_mismatch",
        "สเปกไม่ตรงกับกล่องของแบบนี้",
        problems.map((path) => ({ path: `spec.${path}`, code: "mismatch", message: path })),
      );
    const product = productOfId(row.catalogProductId);
    const productTypeCode = product ? typeCodeOf(product) : "folding_carton";
    const input: Snapshot["input"] = { productTypeCode, configuration, deliveryPostcode: body.deliveryPostcode ?? null };
    const specHash = fakeSha256(canonicalJson(input));
    const previous = body.previousSpecHash ? (snapshots.get(body.previousSpecHash) ?? null) : null;
    const base = { specHash, versionNo: version.versionNo, previousSpecHash: previous ? body.previousSpecHash! : null };

    if (!product || !configuratorOf(product)) {
      const result: Schemas["StudioQuoteDto"] = {
        ...base,
        mode: "rfq",
        calculation: null,
        cached: false,
        reasons: previous ? reasonsBetween(previous.input, input) : [],
        changes: [],
      };
      return HttpResponse.json(result);
    }

    const cached = snapshots.get(specHash);
    const inputs = inputsOf(productTypeCode, configuration);
    if (inputs instanceof Response) return inputs;
    const steps = cached?.steps ?? inputs.quantities.map((q) => stepOf(inputs, q, body.deliveryPostcode));
    snapshots.set(specHash, { input, steps });
    const before = previous ? unitPrices(previous.steps) : new Map<number, string>();
    const result: Schemas["StudioQuoteDto"] = {
      ...base,
      mode: "instant",
      cached: !!cached,
      calculation: {
        calculationId: null,
        calculatorVersion: "mock-0.0.0",
        dimensions: inputs.dimensions,
        target: null,
        steps,
      },
      reasons: previous ? reasonsBetween(previous.input, input) : [],
      changes: [...unitPrices(steps)]
        .filter(([q, price]) => before.has(q) && before.get(q) !== price)
        .map(([quantity, unitPrice]) => ({ quantity, previousUnitPrice: before.get(quantity)!, unitPrice })),
    };
    return HttpResponse.json(result);
  }),
];

/**
 * `store.studio.getRules` (D-278): packio-api's seeded catalogue (`contract/studio-rules.json`, vendored at the
 * lock's tag) — except that the mock turns on the flexo spot-colour limit (`maxColours: 3`, the seed leaves it
 * off until Prepress sets it) and the minimum text size (6 pt), so the studio's flexo mode and the text check
 * can be exercised. Fake values, never a business decision.
 */
export const MOCK_STUDIO_RULES: Schemas["StudioRulesDto"] = {
  version: 1,
  effectiveFrom: "2026-10-03T00:00:00+07:00",
  rules: (studioRules.rules as Schemas["PrintRuleDto"][]).map((rule) =>
    rule.id === "spot_colour_count"
      ? { ...rule, thresholds: { maxColours: 3 } }
      : rule.id === "min_text_size"
        ? { ...rule, thresholds: { minPt: 6 } }
        : rule,
  ),
  softProof: { label: { th: "ภาพจำลองเพื่อดูตัวอย่าง ไม่ใช่ปรู๊ฟสัญญา", en: "Preview, not a contract proof" }, profiles: [] },
};

storeStudioHandlers.push(http.get("*/v1/store/studio/rules", () => HttpResponse.json(MOCK_STUDIO_RULES)));

/* ------------------------------------------------------------------ templates and elements (U4.4) */

const templateId = (index: number) => `00000000-0000-4000-8000-74706c${String(index).padStart(6, "0")}`;

/** The studio's template set as packio-api serves it once Marketing has published it (D-216, D-282). */
const TEMPLATES: Schemas["StudioTemplateDto"][] = TEMPLATE_LIBRARY.map((t, index) => ({
  id: templateId(index + 1),
  code: t.code,
  nameTh: t.nameTh,
  nameEn: t.nameEn,
  useCases: t.useCases,
  styleFamilies: t.styleFamilies,
  layoutSchemaVersion: t.layoutSchemaVersion,
  layout: t.layout as unknown as Record<string, never>,
  status: "published",
  thumbnailFileId: null,
}));

/**
 * Packio-drawn elements in a 100 × 100 box (D-282): plain shapes, handling marks (this way up, keep
 * dry, fragile, recyclable, food contact) and one mark with legal meaning that needs the company's
 * declared right before it can be placed. Fake, original drawings — never a real certification logo.
 */
type ElementSeed = Pick<Schemas["StoreStudioElementDto"], "code" | "kind" | "nameTh" | "nameEn" | "path">;
const ELEMENT_SEEDS: ElementSeed[] = [
  { code: "PK-EL-STAR", kind: "shape", nameTh: "ดาวป้าย", nameEn: "Badge star", path: "M50 4 L61 37 L96 37 L68 58 L79 92 L50 71 L21 92 L32 58 L4 37 L39 37 Z" },
  { code: "PK-EL-RIBBON", kind: "shape", nameTh: "ริบบิ้น", nameEn: "Ribbon", path: "M0 30 L100 30 L88 50 L100 70 L0 70 L12 50 Z" },
  { code: "PK-EL-TAG", kind: "shape", nameTh: "ป้ายห้อย", nameEn: "Tag", path: "M20 10 L95 10 L95 90 L20 90 L2 50 Z M22 44 A6 6 0 1 0 22 56 A6 6 0 1 0 22 44 Z" },
  { code: "PK-EL-THISWAYUP", kind: "mark", nameTh: "ตั้งด้านนี้ขึ้น", nameEn: "This way up", path: "M15 90 L45 90 L45 40 L58 40 L30 8 L2 40 L15 40 Z M55 90 L85 90 L85 40 L98 40 L70 8 L42 40 L55 40 Z" },
  { code: "PK-EL-KEEPDRY", kind: "mark", nameTh: "ห้ามเปียกน้ำ", nameEn: "Keep dry", path: "M50 8 C20 8 4 30 4 48 L96 48 C96 30 80 8 50 8 Z M47 48 L47 82 C47 92 33 92 33 82 L39 82 C39 86 41 86 41 82 L41 48 Z" },
  { code: "PK-EL-FRAGILE", kind: "mark", nameTh: "ระวังแตก", nameEn: "Fragile", path: "M25 6 L75 6 L72 40 C70 52 58 58 54 58 L54 86 L70 90 L30 90 L46 86 L46 58 C42 58 30 52 28 40 Z" },
  { code: "PK-EL-RECYCLE", kind: "mark", nameTh: "รีไซเคิลได้", nameEn: "Recyclable", path: "M50 6 L66 34 L56 34 L74 66 L86 66 L70 94 L30 94 L40 76 L66 76 L50 48 L42 62 L26 34 Z" },
  { code: "PK-EL-FOOD", kind: "icon", nameTh: "สัมผัสอาหารได้", nameEn: "Food contact", path: "M20 6 L26 6 L26 40 L32 40 L32 6 L38 6 L38 44 C38 50 34 52 32 52 L32 94 L26 94 L26 52 C24 52 20 50 20 44 Z M60 6 L80 6 L76 50 L72 50 L72 94 L66 94 L66 50 L62 50 Z" },
  { code: "PK-EL-CERT", kind: "mark", nameTh: "เครื่องหมายรับรอง (ตัวอย่าง)", nameEn: "Certification mark (sample)", path: "M50 4 A46 46 0 1 0 50 96 A46 46 0 1 0 50 4 Z M50 16 A34 34 0 1 1 50 84 A34 34 0 1 1 50 16 Z M30 50 L44 64 L72 36 L66 30 L44 52 L36 44 Z" },
];
const ELEMENTS: Omit<Schemas["StoreStudioElementDto"], "usable">[] = ELEMENT_SEEDS.map((e) => ({
  ...e,
  id: mockStudioId(e.code),
  status: "published",
  tags: [],
  requiresRight: e.code === "PK-EL-CERT",
}));

function mockStudioId(code: string): string {
  let hash = 0;
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `00000000-0000-4000-8000-656c${hash.toString(16).padStart(8, "0")}`;
}

/** Rights declared per customer (D-282: who, when, the statement). */
const declared = new Map<string, Set<string>>();

storeStudioHandlers.push(
  http.get("*/v1/store/studio/templates", ({ request }) => {
    const query = new URL(request.url).searchParams;
    const useCase = query.get("useCase");
    const family = query.get("styleFamily");
    return HttpResponse.json(
      TEMPLATES.filter(
        (t) => (!useCase || t.useCases.includes(useCase as never)) && (!family || t.styleFamilies.includes(family)),
      ),
    );
  }),
  http.get("*/v1/store/studio/templates/:templateId", ({ params }) => {
    const found = TEMPLATES.find((t) => t.id === params.templateId);
    return found ? HttpResponse.json(found) : problem(404, "http.not_found", "ไม่พบแม่แบบนี้");
  }),
  http.get("*/v1/store/studio/elements", ({ request }) => {
    const kind = new URL(request.url).searchParams.get("kind");
    const mine = declared.get(request.headers.get("authorization") ?? "") ?? new Set<string>();
    return HttpResponse.json(
      ELEMENTS.filter((e) => !kind || e.kind === kind).map((e) => ({ ...e, usable: !e.requiresRight || mine.has(e.id) })),
    );
  }),
  http.post("*/v1/store/studio/elements/:elementId/right-declarations", async ({ params, request }) => {
    const element = ELEMENTS.find((e) => e.id === params.elementId);
    if (!element) return problem(404, "http.not_found", "ไม่พบองค์ประกอบนี้");
    const body = (await request.json()) as Schemas["DeclareRightDto"];
    if (!body.statement?.trim()) return problem(422, "validation.failed", "กรุณาระบุคำรับรองสิทธิ์");
    const key = request.headers.get("authorization") ?? "";
    declared.set(key, new Set([...(declared.get(key) ?? []), element.id]));
    const result: Schemas["RightDeclarationDto"] = {
      id: mockStudioId(`${element.code}-${key}`),
      elementId: element.id,
      companyId: body.companyId ?? null,
      statement: body.statement,
      declaredAt: new Date().toISOString(),
    };
    return HttpResponse.json(result, { status: 201 });
  }),
);

/* ------------------------------------------------------------------ barcode validation (D-283) */

const GS1_LENGTH: Partial<Record<Schemas["BarcodeSymbology"], number>> = { ean13: 13, ean8: 8, upca: 12 };
const GS1_NOMINAL_MM: Partial<Record<Schemas["BarcodeSymbology"], number>> = { ean13: 37.29, upca: 37.29, ean8: 26.73 };
const QR_BYTES: Record<Schemas["QrErrorCorrection"], number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };

function gs1Check(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

/** packio-api's `validateBarcode` (studio/barcodes.ts), as the mock answers it. */
storeStudioHandlers.push(
  http.post("*/v1/store/studio/barcodes/actions/validate", async ({ request }) => {
    const body = (await request.json()) as Schemas["ValidateBarcodeDto"];
    const { symbology, value } = body;
    const problems: string[] = [];
    let normalised: string | null = value;
    const length = GS1_LENGTH[symbology];
    if (length !== undefined) {
      if (!/^[0-9]+$/.test(value)) problems.push("digits_only");
      else if (value.length === length - 1) normalised = value + String(gs1Check(value));
      else if (value.length !== length) problems.push("wrong_length");
      else if (gs1Check(value.slice(0, -1)) !== Number(value.at(-1))) problems.push("check_digit");
    } else if (symbology === "code128") {
      if (value.length === 0) problems.push("empty");
      if ([...value].some((ch) => ch.charCodeAt(0) > 127)) problems.push("not_ascii");
    } else {
      const bytes = new TextEncoder().encode(value).length;
      if (bytes === 0) problems.push("empty");
      if (bytes > QR_BYTES[body.level ?? "M"]) problems.push("too_long_for_level");
    }
    const nominal = GS1_NOMINAL_MM[symbology];
    const result: Schemas["BarcodeCheckDto"] = {
      valid: problems.length === 0,
      problems,
      normalised: problems.length ? null : normalised,
      minWidthMm: nominal === undefined ? null : Math.round(nominal * 0.8 * 100) / 100,
    };
    return HttpResponse.json(result);
  }),
);
