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

import { bangkokIso, problem } from "../support";
import { addToCart, pinDesign } from "./cart";
import { typeCodeOf } from "./catalog";
import { customerOf } from "./customers";
import { designRowFor, versionBoxOf, versionOf, type StudioBox } from "./designs";
import { buildQuote, configuratorOf, inputsOf, productOfId, quotesOf, stepOf, toSavedQuote, uncoded } from "./quotes";

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
    const input: Snapshot["input"] = {
      productTypeCode,
      configuration,
      deliveryPostcode: body.deliveryPostcode ?? null,
    };
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
  // Fake soft-proof profiles (the seed has none until Prepress supplies them, D-279).
  softProof: {
    label: { th: "ภาพจำลองเพื่อดูตัวอย่าง ไม่ใช่ปรู๊ฟสัญญา", en: "Preview, not a contract proof" },
    profiles: [
      {
        materialClass: "paperboard",
        label: "กระดาษแข็งขาว (จำลอง)",
        transform: { saturate: 0.9, multiply: "#f2efe8", multiplyOpacity: 0.4 },
      },
      {
        materialClass: "corrugated",
        label: "กระดาษคราฟต์ (จำลอง)",
        transform: { saturate: 0.75, brightness: 0.93, multiply: "#c9a57a", multiplyOpacity: 0.55 },
      },
    ],
  },
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
  {
    code: "PK-EL-STAR",
    kind: "shape",
    nameTh: "ดาวป้าย",
    nameEn: "Badge star",
    path: "M50 4 L61 37 L96 37 L68 58 L79 92 L50 71 L21 92 L32 58 L4 37 L39 37 Z",
  },
  {
    code: "PK-EL-RIBBON",
    kind: "shape",
    nameTh: "ริบบิ้น",
    nameEn: "Ribbon",
    path: "M0 30 L100 30 L88 50 L100 70 L0 70 L12 50 Z",
  },
  {
    code: "PK-EL-TAG",
    kind: "shape",
    nameTh: "ป้ายห้อย",
    nameEn: "Tag",
    path: "M20 10 L95 10 L95 90 L20 90 L2 50 Z M22 44 A6 6 0 1 0 22 56 A6 6 0 1 0 22 44 Z",
  },
  {
    code: "PK-EL-THISWAYUP",
    kind: "mark",
    nameTh: "ตั้งด้านนี้ขึ้น",
    nameEn: "This way up",
    path: "M15 90 L45 90 L45 40 L58 40 L30 8 L2 40 L15 40 Z M55 90 L85 90 L85 40 L98 40 L70 8 L42 40 L55 40 Z",
  },
  {
    code: "PK-EL-KEEPDRY",
    kind: "mark",
    nameTh: "ห้ามเปียกน้ำ",
    nameEn: "Keep dry",
    path: "M50 8 C20 8 4 30 4 48 L96 48 C96 30 80 8 50 8 Z M47 48 L47 82 C47 92 33 92 33 82 L39 82 C39 86 41 86 41 82 L41 48 Z",
  },
  {
    code: "PK-EL-FRAGILE",
    kind: "mark",
    nameTh: "ระวังแตก",
    nameEn: "Fragile",
    path: "M25 6 L75 6 L72 40 C70 52 58 58 54 58 L54 86 L70 90 L30 90 L46 86 L46 58 C42 58 30 52 28 40 Z",
  },
  {
    code: "PK-EL-RECYCLE",
    kind: "mark",
    nameTh: "รีไซเคิลได้",
    nameEn: "Recyclable",
    path: "M50 6 L66 34 L56 34 L74 66 L86 66 L70 94 L30 94 L40 76 L66 76 L50 48 L42 62 L26 34 Z",
  },
  {
    code: "PK-EL-FOOD",
    kind: "icon",
    nameTh: "สัมผัสอาหารได้",
    nameEn: "Food contact",
    path: "M20 6 L26 6 L26 40 L32 40 L32 6 L38 6 L38 44 C38 50 34 52 32 52 L32 94 L26 94 L26 52 C24 52 20 50 20 44 Z M60 6 L80 6 L76 50 L72 50 L72 94 L66 94 L66 50 L62 50 Z",
  },
  {
    code: "PK-EL-CERT",
    kind: "mark",
    nameTh: "เครื่องหมายรับรอง (ตัวอย่าง)",
    nameEn: "Certification mark (sample)",
    path: "M50 4 A46 46 0 1 0 50 96 A46 46 0 1 0 50 4 Z M50 16 A34 34 0 1 1 50 84 A34 34 0 1 1 50 16 Z M30 50 L44 64 L72 36 L66 30 L44 52 L36 44 Z",
  },
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
      ELEMENTS.filter((e) => !kind || e.kind === kind).map((e) => ({
        ...e,
        usable: !e.requiresRight || mine.has(e.id),
      })),
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

/* ------------------------------------------------------------------ checks (D-278) */

type Finding = Schemas["CheckFindingDto"];

/**
 * packio-api's `evaluateDocument` (studio/print-rules.ts) as the mock runs it: the rules evaluated on
 * the document, with their thresholds, in the same units and rounding. Kept as a port so the web's
 * checks can be held to the same ids for the same document (`checks-parity.test.ts`).
 */
export function evaluateDocumentLikeTheApi(
  document: { content?: { elements?: unknown; pattern?: unknown } },
  rules: Schemas["PrintRuleDto"][],
  ctx: { undeclared: Set<string> },
): Omit<Finding, "acknowledged">[] {
  const content = document.content;
  const elements = (Array.isArray(content?.elements) ? content.elements : []) as Record<string, unknown>[];
  const out: Omit<Finding, "acknowledged">[] = [];
  const PT = 72 / 25.4;
  const num = (v: unknown): number | null => (v === undefined || v === null || v === "" ? null : Number(v));
  const on = (id: string) =>
    rules.find((r) => r.id === id && r.evaluatedOn.includes("document") && r.thresholds !== null);
  const scale = (el: Record<string, unknown>, k: string) => Math.abs(num(el[k]) ?? 1) || 1;
  const id = (el: Record<string, unknown>) => (typeof el.id === "string" ? el.id : "");
  const round = (n: number) => Math.round(n * 100) / 100;

  const image = on("image_resolution");
  if (image) {
    const warn = num(image.thresholds!.warnBelowPpi);
    const block = num(image.thresholds!.blockBelowPpi);
    for (const el of elements.filter((e) => e.type === "image")) {
      const pxW = num(el.naturalWidth);
      const pxH = num(el.naturalHeight);
      const crop = (el.crop as { width?: number; height?: number } | undefined) ?? {};
      const mmW = (num(el.width) ?? 0) * scale(el, "scaleX");
      const mmH = (num(el.height) ?? 0) * scale(el, "scaleY");
      if (!pxW || !pxH || mmW <= 0 || mmH <= 0) continue;
      const ppi = Math.floor(
        Math.min((pxW * (crop.width ?? 1)) / (mmW / 25.4), (pxH * (crop.height ?? 1)) / (mmH / 25.4)),
      );
      const severity = block !== null && ppi < block ? "block" : warn !== null && ppi < warn ? image.severity : null;
      if (severity) out.push({ ruleId: image.id, severity, elementId: id(el), details: { ppi } });
    }
  }
  const text = on("min_text_size");
  const minPt = text ? num(text.thresholds!.minPt) : null;
  if (text && minPt !== null)
    for (const el of elements.filter((e) => e.type === "text")) {
      const pt = (num(el.fontSize) ?? 0) * scale(el, "scaleY") * PT;
      if (pt > 0 && pt < minPt)
        out.push({ ruleId: text.id, severity: text.severity, elementId: id(el), details: { pt: round(pt) } });
    }
  const hairline = on("hairline");
  const minStroke = hairline ? num(hairline.thresholds!.minStrokePt) : null;
  if (hairline && minStroke !== null)
    for (const el of elements.filter((e) => ["rect", "circle", "shape"].includes(String(e.type)))) {
      const stroke = typeof el.stroke === "string" && el.stroke !== "" && el.stroke !== "transparent";
      const pt = (num(el.strokeWidth) ?? 0) * Math.max(scale(el, "scaleX"), scale(el, "scaleY")) * PT;
      if (stroke && pt > 0 && pt < minStroke)
        out.push({ ruleId: hairline.id, severity: hairline.severity, elementId: id(el), details: { pt: round(pt) } });
    }
  const barcode = on("barcode_invalid");
  if (barcode)
    for (const el of elements.filter((e) => e.type === "code")) {
      const kind = el.kind === "ean13" ? "ean13" : el.kind === "qr" ? "qr" : null;
      if (!kind) continue;
      const value = typeof el.value === "string" ? el.value : "";
      const problems: string[] = [];
      if (kind === "ean13") {
        if (!/^[0-9]+$/.test(value)) problems.push("digits_only");
        else if (value.length !== 13) problems.push("wrong_length");
        else if (gs1Check(value.slice(0, -1)) !== Number(value.at(-1))) problems.push("check_digit");
      } else {
        const bytes = new TextEncoder().encode(value).length;
        if (bytes === 0) problems.push("empty");
        if (bytes > QR_BYTES[(typeof el.level === "string" ? el.level : "M") as "M"])
          problems.push("too_long_for_level");
      }
      const widthMm = (num(el.width) ?? 0) * scale(el, "scaleX");
      const minWidth = kind === "ean13" ? Math.round(37.29 * 0.8 * 100) / 100 : null;
      if (minWidth !== null && widthMm > 0 && widthMm < minWidth) problems.push("too_small");
      if (problems.length > 0)
        out.push({ ruleId: barcode.id, severity: barcode.severity, elementId: id(el), details: { problems } });
    }
  const rights = on("element_right_missing");
  if (rights && ctx.undeclared.size)
    for (const el of elements)
      if (typeof el.studioElementId === "string" && ctx.undeclared.has(el.studioElementId))
        out.push({
          ruleId: rights.id,
          severity: rights.severity,
          elementId: id(el),
          details: { studioElementId: el.studioElementId },
        });
  const spots = on("spot_colour_count");
  const maxColours = spots ? num(spots.thresholds!.maxColours) : null;
  if (spots && maxColours !== null) {
    const colours = new Set<string>();
    const add = (c: unknown) => {
      if (typeof c === "string" && c !== "" && c !== "transparent") colours.add(c.toLowerCase());
    };
    for (const el of elements) for (const k of ["fill", "stroke", "background"]) add(el[k]);
    const pattern = content?.pattern as { kind?: string; color?: string; background?: string } | undefined;
    if (pattern && pattern.kind !== "none") {
      add(pattern.color);
      add(pattern.background);
    }
    if (colours.size > maxColours)
      out.push({
        ruleId: spots.id,
        severity: spots.severity,
        elementId: "",
        details: { colours: colours.size, max: maxColours },
      });
  }
  return out;
}

/** The rules in force for a version: on, and for its print method (the mock knows no material class). */
const activeFor = (printMethod: string | null) =>
  MOCK_STUDIO_RULES.rules.filter(
    (r) =>
      r.thresholds !== null &&
      (r.printMethods === null || (printMethod !== null && r.printMethods.includes(printMethod as never))),
  );

const checkRuns = new Map<string, Schemas["CheckRunDto"]>();
const acks = new Map<string, Set<string>>();

function runFor(
  row: Parameters<typeof versionOf>[0],
  versionNo: number | undefined,
  viewer: string,
): Schemas["CheckRunDto"] | null {
  const version = versionOf(row, versionNo);
  if (!version) return null;
  const mine = declared.get(viewer) ?? new Set<string>();
  const undeclared = new Set(ELEMENTS.filter((e) => e.requiresRight && !mine.has(e.id)).map((e) => e.id));
  const key = `${(row as { design: { id: string } }).design.id}:${version.versionNo}`;
  const done = acks.get(key) ?? new Set<string>();
  const findings = evaluateDocumentLikeTheApi(version.document as never, activeFor(version.box?.printMethod ?? null), {
    undeclared,
  }).map((f) => ({ ...f, acknowledged: done.has(`${f.ruleId}:${f.elementId ?? ""}`) }));
  const counts = { block: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  const run: Schemas["CheckRunDto"] = {
    versionNo: version.versionNo,
    source: "document",
    rulesVersion: MOCK_STUDIO_RULES.version,
    evaluatedAt: new Date().toISOString(),
    findings,
    counts,
    ready: counts.block === 0 && findings.every((f) => f.severity !== "warn" || f.acknowledged),
  };
  checkRuns.set(key, run);
  return run;
}

storeStudioHandlers.push(
  http.post("*/v1/store/studio/:designId/checks", async ({ params, request }) => {
    const row = designRowFor(request, String(params.designId));
    if (row instanceof Response) return row;
    const body = (await request.json().catch(() => ({}))) as Schemas["RunChecksDto"];
    const run = runFor(row, body.versionNo, request.headers.get("authorization") ?? "");
    return run ? HttpResponse.json(run) : problem(404, "http.not_found", "ไม่พบเวอร์ชันนี้");
  }),
  http.post("*/v1/store/studio/:designId/checks/acknowledgements", async ({ params, request }) => {
    const row = designRowFor(request, String(params.designId));
    if (row instanceof Response) return row;
    const body = (await request.json()) as Schemas["AcknowledgeCheckDto"];
    const viewer = request.headers.get("authorization") ?? "";
    const version = versionOf(row, body.versionNo);
    if (!version) return problem(404, "http.not_found", "ไม่พบเวอร์ชันนี้");
    const key = `${row.design.id}:${version.versionNo}`;
    const before = checkRuns.get(key) ?? runFor(row, version.versionNo, viewer);
    if (!before) return problem(409, "studio.checks_not_run", "ยังไม่ได้ตรวจเวอร์ชันนี้");
    const finding = before.findings.find(
      (f) => f.ruleId === body.ruleId && (f.elementId ?? "") === (body.elementId ?? ""),
    );
    if (!finding)
      return problem(422, "validation.failed", "ไม่พบผลตรวจนี้", [
        { path: "ruleId", code: "not_found", message: "no such finding" },
      ]);
    if (finding.severity === "block") return problem(409, "studio.block_not_acknowledgeable", "ต้องแก้ไข ยอมรับไม่ได้");
    acks.set(key, new Set([...(acks.get(key) ?? []), `${body.ruleId}:${body.elementId ?? ""}`]));
    return HttpResponse.json(runFor(row, version.versionNo, viewer));
  }),
);

/*
 * ⑤ order from the studio (U4.6, D-276, D-277, D-280):
 * - `store.studio.saveQuote`: the version's spec saved as a quotation through the store's own quote
 *   mock, so the cart and checkout price it exactly as the studio did;
 * - `store.studio.addRender`: the studio's tiles and finish masks, kept per version;
 * - `store.studio.order`: refuses a version without renders, puts the quotation in the cart with the
 *   version pinned and answers a print job (202) that succeeds on its second poll with fake URLs.
 */
const renders = new Map<string, Schemas["DesignRenderDto"][]>();
const jobs = new Map<string, Schemas["StudioPrintJobDto"]>();
const polls = new Map<string, number>();
let renderSeq = 1;
let jobSeq = 1;
const versionKey = (designId: string, versionNo: number) => `${designId}#${versionNo}`;

storeStudioHandlers.push(
  http.post("*/v1/store/studio/:designId/quote/actions/save", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    const row = designRowFor(request, String(params.designId));
    if (row instanceof Response) return row;
    const body = (await request.json()) as Schemas["SaveStudioQuoteDto"];
    const quantity = body.quantities?.[0];
    if (!quantity)
      return problem(422, "validation.failed", "ระบุจำนวน", [
        { path: "quantities", code: "size", message: "required" },
      ]);
    const version = versionBoxOf(row, body.versionNo);
    if (!version) return problem(404, "http.not_found", "ไม่พบเวอร์ชันนี้");
    if (!version.box?.spec) return problem(409, "studio.spec_missing", "แบบนี้ยังไม่มีสเปกสำหรับคำนวณราคา");
    const { configuration } = configurationOf(version.box, [quantity]);
    const product = productOfId(row.catalogProductId);
    if (!product || !configuratorOf(product))
      return problem(409, "pricing.no_instant_price", "จำนวนนี้ไม่มีราคาทันที กรุณาขอใบเสนอราคา");
    const productTypeCode = typeCodeOf(product);
    const inputs = inputsOf(productTypeCode, configuration);
    if (inputs instanceof Response) return inputs;
    const quote = buildQuote(
      inputs,
      { ...configuration, catalogProductId: row.catalogProductId },
      {
        quantity,
        ...(body.deliveryPostcode ? { deliveryPostcode: body.deliveryPostcode } : {}),
        // The design service asks for graphic design in the spec (U4.8): the design fee is priced.
        designOption: ((configuration as Record<string, unknown>).design as { graphic?: boolean } | undefined)?.graphic
          ? "hired_design"
          : "online_designer",
        mockupOption: "none",
      },
      new URL(request.url).searchParams.get("lang") === "en",
    );
    if (quote instanceof Response) return quote;
    quotesOf(customer.persona).unshift(quote);
    uncoded.add(quote.id);
    return HttpResponse.json(toSavedQuote(quote), { status: 201 });
  }),

  http.post("*/v1/store/studio/:designId/versions/:versionNo/renders", async ({ params, request }) => {
    const row = designRowFor(request, String(params.designId));
    if (row instanceof Response) return row;
    const versionNo = Number(params.versionNo);
    if (!versionBoxOf(row, versionNo)) return problem(404, "http.not_found", "ไม่พบเวอร์ชันนี้");
    const body = (await request.json()) as Schemas["AddRenderDto"];
    const key = versionKey(String(params.designId), versionNo);
    const list = renders.get(key) ?? [];
    list.push({
      ...body,
      id: `0192f3a0-7c1e-7d2a-9b1f-${String(renderSeq++).padStart(12, "0")}`,
    } as Schemas["DesignRenderDto"]);
    renders.set(key, list);
    return HttpResponse.json(list, { status: 201 });
  }),

  http.post("*/v1/store/studio/:designId/order", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    const designId = String(params.designId);
    const row = designRowFor(request, designId);
    if (row instanceof Response) return row;
    const body = (await request.json()) as Schemas["StudioOrderDto"];
    const version = versionBoxOf(row, body.versionNo);
    if (!version) return problem(404, "http.not_found", "ไม่พบเวอร์ชันนี้");
    if (!renders.get(versionKey(designId, version.versionNo))?.some((r) => r.kind === "tile"))
      return problem(409, "studio.renders_missing", "ยังไม่ได้ส่งภาพงานพิมพ์ของเวอร์ชันนี้");
    const quote = quotesOf(customer.persona).find((q) => q.id === body.quoteId);
    if (!quote) return problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");
    const lineId = addToCart(customer, quote);
    pinDesign(customer, lineId, designId, version.versionNo);
    const id = `0192f3a0-7c1e-7d2a-9b1f-${String(0xc900 + jobSeq++).padStart(12, "0")}`;
    const job: Schemas["StudioPrintJobDto"] = {
      id,
      designId,
      versionNo: version.versionNo,
      status: "queued",
      cartItemId: lineId,
      orderId: null,
      submissionId: null,
      printFileUrl: null,
      proofFileUrl: null,
      snapshotUrl: null,
      error: null,
      createdAt: bangkokIso(),
      completedAt: null,
      statusUrl: `/v1/store/studio/jobs/${id}`,
    };
    jobs.set(id, job);
    return HttpResponse.json(job, { status: 202 });
  }),

  http.get("*/v1/store/studio/jobs/:jobId", ({ params }) => {
    const job = jobs.get(String(params.jobId));
    if (!job) return problem(404, "http.not_found", "ไม่พบงานนี้");
    const count = (polls.get(job.id) ?? 0) + 1;
    polls.set(job.id, count);
    if (count === 1) job.status = "running";
    else if (job.status !== "succeeded") {
      // Fake signed URLs: nothing behind them, the mock never assembles a print file.
      Object.assign(job, {
        status: "succeeded",
        completedAt: bangkokIso(),
        submissionId: `0192f3a0-7c1e-7d2a-9b1f-${String(0xd500 + jobSeq).padStart(12, "0")}`,
        printFileUrl: `https://files.example.test/studio/${job.id}/print.pdf`,
        proofFileUrl: `https://files.example.test/studio/${job.id}/proof.pdf`,
        snapshotUrl: `https://files.example.test/studio/${job.id}/snapshot.png`,
      });
    }
    return HttpResponse.json(job);
  }),
);

/*
 * "ให้ทีมออกแบบให้" (U4.8, D-286): the version in the cart with the design service — the studio
 * quotation of that version, the line's design option `hired_design` — answered as the cart line.
 */
storeStudioHandlers.push(
  http.post("*/v1/store/studio/:designId/design-service", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    const designId = String(params.designId);
    const row = designRowFor(request, designId);
    if (row instanceof Response) return row;
    const body = (await request.json()) as Schemas["StudioOrderDto"];
    const version = versionBoxOf(row, body.versionNo);
    if (!version) return problem(422, "designs.version_required", "ต้องระบุเวอร์ชันของงานออกแบบ");
    const quote = quotesOf(customer.persona).find((q) => q.id === body.quoteId);
    if (!quote) return problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");
    const lineId = addToCart(customer, quote);
    pinDesign(customer, lineId, designId, version.versionNo, "hired_design");
    return HttpResponse.json(
      { cartItemId: lineId, designVersionNo: version.versionNo } satisfies Schemas["StudioCartItemRefDto"],
      { status: 201 },
    );
  }),
);
