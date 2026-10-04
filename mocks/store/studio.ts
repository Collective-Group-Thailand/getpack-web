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
