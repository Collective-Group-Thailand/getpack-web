/**
 * The CS sales desk on the published contract (U-F0.3): the folding and corrugate calculators
 * (`admin.csFolding.*`, `admin.csCorrugate.*`), saved quotations (`admin.quotes.*`), discount memos
 * on the customer's cart (`admin.discountMemos.*`), the customer's cart as CS fills it
 * (`admin.cart.*`) and CS checkout (`admin.checkout.*`).
 *
 * The calculators read the catalogue mock's own rows and price with the storefront mock's engine
 * (`../store/quotes.ts` `boxStepsOf`), so the same spec costs the same on both sides — obviously fake
 * figures standing in for packio-api's ported calculators. The other five calculators are not
 * published; nothing here answers for them. Memos go through the approvals mock like everything
 * else, so a memo raised here appears in a Director's inbox.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, type StaffPersona } from "../personas";
import { boxStepsOf } from "../store/quotes";
import {
  bangkokIso,
  matchesQuery,
  mockId,
  paginate,
  precondition,
  problem,
  sortBy,
  versionTag,
  withEtag,
} from "../support";
import { lineSummaryOf, PRODUCT_TYPES } from "./catalog";
import { catalogueRows } from "./catalogue";
import { customers, orders } from "./commerce";
import { toGroupDto } from "./orders";
import { approvals, files, openApproval, settings } from "./platform";

type Quote = Schemas["AdminSavedQuoteDto"];
type Memo = Schemas["DiscountMemoDto"];
type Cart = Schemas["CartDto"];
type Calculator = "folding" | "corrugate";

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const notFound = (what: string) => problem(404, "http.not_found", `ไม่พบ${what}นี้`);
const invalid = (path: string, message: string) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path, code: "invalid", message }]);

const pageOf = (url: URL) => ({
  page: Number(url.searchParams.get("page") ?? 1),
  perPage: Number(url.searchParams.get("perPage") ?? 25),
});

function allowed(request: Request, permission: string): StaffPersona | null {
  const who = staffPersonaOf(request);
  return who && can(who, permission) ? who : null;
}

const live = <T extends Record<string, unknown>>(rows: T[]) => rows.filter((row) => row.status !== "archived");
const str = (value: unknown) => String(value ?? "");

/* ---------------------------------------------------------------------------- input data */

function named(row: Record<string, unknown>): Schemas["CodeNameRefDto"] {
  return { id: str(row.id), code: str(row.code), nameTh: str(row.nameTh), nameEn: str(row.nameEn ?? row.nameTh) };
}

/** A pattern's size rules from the catalogue row's `constraints`; none (null, false) where it sets none. */
function sizeRulesOf(row: Record<string, unknown>): Schemas["StoreSizeRulesDto"] {
  const limits = (row.constraints as Record<string, number | undefined> | undefined) ?? {};
  return {
    minLMm: limits.minL ?? null,
    maxLMm: limits.maxL ?? null,
    minWMm: limits.minW ?? null,
    maxWMm: limits.maxW ?? null,
    minHMm: limits.minH ?? null,
    maxHMm: limits.maxH ?? null,
    lengthMustExceedWidth: false,
    lengthMustExceedHeight: false,
    widthMustExceedHeight: false,
  };
}

function subPatternsOf(patternId: unknown) {
  return live(catalogueRows("subPatterns"))
    .filter((row) => row.patternId === patternId)
    .map((row) => ({ id: str(row.id), name: str(row.name), seq: Number(row.seq ?? 1) }));
}

function inkColours(): Schemas["InputInkColourDto"][] {
  return live(catalogueRows("inkColours")).map((row) => ({
    id: str(row.id),
    code: str(row.code),
    name: str(row.name),
    colourKind: str(row.colourKind ?? "process"),
  }));
}

function assemblies(): Schemas["InputAssemblyDto"][] {
  return live(catalogueRows("assemblies")).map((row) => ({
    ...named(row),
    requiresAmount: Boolean(row.requiresAmount),
    requiresLength: Boolean(row.requiresLength),
    requiresWidth: Boolean(row.requiresWidth),
  }));
}

function foldingInputData(): Schemas["FoldingInputDataDto"] {
  return {
    patterns: live(catalogueRows("patterns")).map((row) => ({
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      geometryFormula: str(row.geometryFormula ?? row.dielineKey ?? "rsc"),
      rules: sizeRulesOf(row),
      subPatterns: subPatternsOf(row.id),
    })),
    materials: live(catalogueRows("materials"))
      .filter((row) => row.kind !== "corrugated_board")
      .map((row) => ({ ...named(row), gsm: row.gsm === null || row.gsm === undefined ? null : Number(row.gsm) })),
    inkColours: inkColours(),
    finishes: live(catalogueRows("finishes")).map((row) => ({
      ...named(row),
      finishKind: str(row.finishKind),
      slot: "finish1",
      requiresAmount: Boolean(row.requiresAmount),
      requiresLength: Boolean(row.requiresLength),
      requiresWidth: Boolean(row.requiresWidth),
    })),
    diecutTypes: live(catalogueRows("diecutTypes")).map(named),
    assemblies: assemblies(),
    difficultyLevels: live(catalogueRows("difficultyLevels")).map(named),
    ...calculatorPolicy("folding"),
  };
}

/**
 * What both calculators' input data add: CS's own discount limit (`discounts.cs_limit_pct`,
 * D-052), and the calculator's catalogue products, each with its standard sizes and quantity
 * presets (v0.5.0) — the catalogue mock's own rows, as the storefront configurator reads them.
 */
function calculatorPolicy(
  calculator: "folding" | "corrugate",
): Pick<Schemas["FoldingInputDataDto"], "catalogProducts" | "discountPolicy"> {
  const types = new Set(
    live(catalogueRows("productTypes"))
      .filter((row) => row.calculatorKey === calculator)
      .map((row) => str(row.id)),
  );
  const catalogProducts = live(catalogueRows("catalogProducts"))
    .filter((row) => row.status !== "draft" && types.has(str(row.productTypeId)))
    .map((product) => ({
      id: str(product.id),
      slug: str(product.slug),
      nameTh: str(product.nameTh),
      nameEn: str(product.nameEn ?? product.nameTh),
      quantity: { presets: [500, 1000, 2000, 3000, 5000, 10000], min: 100, max: 500_000, default: 1000, maxTiers: 5 },
      standardSizes: live(catalogueRows("standardSizes"))
        .filter((size) => size.catalogProductId === product.id)
        .map((size) => ({
          id: str(size.id),
          code: str(size.code),
          name: str(size.name),
          lengthMm: Number(size.lengthMm),
          widthMm: Number(size.widthMm),
          heightMm: Number(size.heightMm),
        })),
    }));
  return { catalogProducts, discountPolicy: { directLimitPct: String(csLimit()) } };
}

function corrugateInputData(): Schemas["CorrugateInputDataDto"] {
  const flutes = live(catalogueRows("fluteTypes"));
  const fluteOf = (id: unknown) => flutes.find((row) => row.id === id) ?? flutes[0]!;
  return {
    patterns: live(catalogueRows("patterns")).map((row) => ({
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      corrugateFormula: (row.corrugateFormula as Schemas["CorrugateFormula"] | null) ?? "rsc",
      fluteTypeIds: flutes.map((flute) => str(flute.id)),
      rules: sizeRulesOf(row),
      subPatterns: subPatternsOf(row.id).map((sub) => ({ ...sub, corrugateFormula: null })),
    })),
    boards: live(catalogueRows("materials"))
      .filter((row) => row.kind === "corrugated_board" || row.fluteTypeId)
      .map((row) => {
        const flute = fluteOf(row.fluteTypeId);
        return {
          ...named(row),
          gsm: row.gsm === null || row.gsm === undefined ? null : Number(row.gsm),
          coatable: Boolean(row.coatable),
          strength: (row.strength as string | null) ?? null,
          insideColour: (row.insideColour as string | null) ?? null,
          outsideColour: (row.outsideColour as string | null) ?? null,
          flute: { id: str(flute.id), code: str(flute.code), name: str(flute.name), layers: Number(flute.layers ?? 3) },
        };
      }),
    coatings: live(catalogueRows("finishes")).map((row) => ({ ...named(row), finishKind: str(row.finishKind) })),
    inkColours: inkColours(),
    assemblies: assemblies(),
    difficultyLevels: live(catalogueRows("difficultyLevels")).map(named),
    printAreas: ["top", "side", "top_side", "all_round"],
    ...calculatorPolicy("corrugate"),
  };
}

/* ---------------------------------------------------------------------------- calculators */

type Configuration = Schemas["FoldingConfigurationDto"] | Schemas["CsCorrugateConfigurationDto"];

/** What the fake engine needs from either configuration; a `Response` when the body is refused. */
function boxOf(calculator: Calculator, config: Configuration) {
  if (!config.patternId || !config.materialId || !config.difficultyLevelId)
    return invalid(
      !config.patternId ? "patternId" : !config.materialId ? "materialId" : "difficultyLevelId",
      "required",
    );
  if (!(config.l > 0 && config.w > 0 && config.d > 0)) return invalid("l", "dimensions must be positive (mm)");
  if (!Array.isArray(config.quantities) || config.quantities.length === 0 || config.quantities.some((q) => !(q > 0)))
    return invalid("quantities", "at least one positive quantity");
  const material = catalogueRows("materials").find((row) => row.id === config.materialId);
  if (!material) return invalid("materialId", "unknown material");
  const part = config.parts[0];
  const colours = (part?.printFront?.length ?? 0) + (part?.printBack?.length ?? 0);
  const folding = part as Schemas["FoldingPartDto"] | undefined;
  const corrugate = part as Schemas["CorrugatePartDto"] | undefined;
  const extras =
    calculator === "folding"
      ? (folding?.finish1FrontId ? 1 : 0) + (folding?.finish1BackId ? 1 : 0) + (folding?.diecutTypeId ? 1 : 0)
      : (corrugate?.coatingFrontId ? 1 : 0) + (corrugate?.coatingBackId ? 1 : 0);
  return {
    l: config.l,
    w: config.w,
    d: config.d,
    colours,
    extras: extras + (part?.assemblies?.length ?? 0),
    materialFactor: material.gsm ? Number(material.gsm) / 350 : 1,
  };
}

function internalOf(who: StaffPersona, step: Schemas["QuoteStepDto"]): Schemas["QuoteInternalDto"] | null {
  if (!step.instant) return null;
  const seesCost = can(who, "factory_cost.read");
  const seesMargin = seesCost || can(who, "margin.read") || can(who, "margin.read_pct_when_discounting");
  const product = Number(step.productAmount ?? 0);
  return {
    factoryId: mockId("fac", 1),
    printTypeId: mockId("prt", 1),
    priceListVersionId: mockId("plv", 1),
    productionRun: step.quantity,
    buyPrice: seesCost ? (product * 0.72).toFixed(2) : null,
    marginPct: seesMargin ? "28.0000" : null,
    belowMarginFloor: false,
    parts: [],
    shipping: null,
  };
}

function calculate(calculator: Calculator, who: StaffPersona, config: Configuration, postcode: string | undefined) {
  const box = boxOf(calculator, config);
  if (box instanceof Response) return box;
  const design = { graphic: config.design?.graphic ?? false, structure: config.design?.structure ?? false };
  const steps = boxStepsOf(calculator, box, design, config.quantities, postcode);
  const body: Schemas["AdminQuoteCalculationDto"] = {
    calculatorVersion: `${calculator}-mock-1`,
    options: [],
    steps: steps.map((step) => ({
      ...step,
      // Plates and die blocks: corrugate flexo only; folding keeps them at 0.00 (v0.3.0).
      toolingAmount: step.instant ? (calculator === "corrugate" ? "1800.00" : "0.00") : null,
      internal: internalOf(who, step),
    })),
  };
  return body;
}

/* ---------------------------------------------------------------------------- quotations */

const DAY = 24 * 60;
const CS = "00000000-0000-4000-8000-000000005106";

function customerRef(index: number): Schemas["UserRefDto"] {
  const customer = customers[index]!;
  return { id: customer.id, displayName: customer.displayName };
}

function option(quantity: number, unit: string, lead: number): Schemas["AdminSavedQuoteOptionDto"] {
  const net = Math.round(Number(unit) * quantity * 100);
  const vat = Math.round(net * 0.07);
  return {
    id: mockId("qop", quantity),
    quantity,
    unitPrice: unit,
    productAmount: ((net + vat) / 100).toFixed(2),
    designFeeAmount: "0.00",
    structureDesignFeeAmount: "0.00",
    // The seeded quotes split no plates or die blocks out.
    toolingAmount: null,
    shippingAmount: null,
    shippingPending: true,
    shippingPendingReason: "no_postcode",
    netAmount: (net / 100).toFixed(2),
    vatAmount: (vat / 100).toFixed(2),
    grossAmount: ((net + vat) / 100).toFixed(2),
    leadTimeDays: lead,
    earliestShipDate: bangkokIso(DAY * (lead + 4)).slice(0, 10),
    earliestDeliveryDate: null,
    toleranceShortagePct: "5.0000",
    toleranceOveragePct: "5.0000",
    internal: null,
  };
}

export const quotations: Quote[] = [
  {
    id: mockId("quo", 900),
    quoteCode: "QT-2569-00118",
    productTypeCode: "folding_carton",
    source: "instant",
    status: "saved",
    channel: "cs",
    customer: customerRef(1),
    customerCode: customers[1]!.customerCode,
    createdBy: { id: CS, displayName: "สมชาย ตัวอย่าง (ข้อมูลจำลอง)" },
    note: null,
    rfq: null,
    summary: lineSummaryOf("folding_carton"),
    configuration: null,
    deliveryPostcode: null,
    currency: "THB",
    options: [option(3000, "10.500000", 12)],
    priceLocked: true,
    pdfStatus: "none",
    sharedAt: null,
    validUntil: bangkokIso(DAY * 12),
    createdAt: bangkokIso(-DAY * 3),
  },
  {
    id: mockId("quo", 901),
    quoteCode: "QT-2569-00121",
    productTypeCode: "label_sticker",
    source: "instant",
    status: "expired",
    channel: "web",
    customer: customerRef(0),
    customerCode: customers[0]!.customerCode,
    createdBy: null,
    note: null,
    rfq: null,
    summary: lineSummaryOf("label_sticker"),
    configuration: null,
    deliveryPostcode: null,
    currency: "THB",
    options: [option(5000, "0.800000", 5)],
    priceLocked: false,
    pdfStatus: "none",
    sharedAt: null,
    validUntil: bangkokIso(-DAY * 2),
    createdAt: bangkokIso(-DAY * 17),
  },
];

/* --------------------------------------------------------------------- carts and memos */

/** Each customer's cart as CS fills it; a customer with none has an empty one. */
const carts = new Map<string, { cart: Cart; version: number }>();

function cartOf(customerId: string) {
  let entry = carts.get(customerId);
  if (!entry) {
    entry = {
      version: 1,
      cart: {
        id: mockId("crt", customers.findIndex((customer) => customer.id === customerId) + 1),
        customerId,
        channel: "cs",
        items: [],
        codes: [],
        productGrossAmount: "0.00",
        currency: "THB",
        updatedAt: bangkokIso(),
      },
    };
    carts.set(customerId, entry);
  }
  return entry;
}

const cartTag = (entry: { cart: Cart; version: number }) => versionTag(entry.cart.id, entry.version);

function touch(entry: { cart: Cart; version: number }) {
  entry.version += 1;
  entry.cart.updatedAt = bangkokIso();
  const total = entry.cart.items.reduce((sum, item) => sum + Math.round(Number(item.productGrossAmount) * 100), 0);
  entry.cart.productGrossAmount = (total / 100).toFixed(2);
}

/** The memos behind the two discount-memo approvals the platform mock seeds (same subject ids). */
const memos: Memo[] = [
  {
    id: mockId("subj", 1),
    scope: "order",
    status: "pending_approval",
    customer: customerRef(1),
    companyId: null,
    requestedBy: { id: CS, displayName: "สมชาย ตัวอย่าง (ข้อมูลจำลอง)" },
    orderValue: "86400.00",
    requestedPct: "8.0000",
    requestedAmount: "6912.00",
    approvedPct: null,
    resultingMarginPct: "17.5000",
    belowMarginFloor: false,
    reason: "ลูกค้าเทียบราคากับคู่แข่ง ขอส่วนลดเพื่อปิดการขาย",
    approvalId: mockId("appr", 1),
    appliedGroupCode: null,
    evidence: [
      {
        id: mockId("fil", 9101),
        originalName: "ราคาคู่แข่ง-ข้อมูลจำลอง.pdf",
        mimeType: "application/pdf",
        sizeBytes: 182_400,
      },
    ],
    validUntil: bangkokIso(DAY * 14),
    createdAt: bangkokIso(-53),
  },
  {
    id: mockId("subj", 2),
    scope: "order",
    status: "pending_approval",
    customer: customerRef(0),
    companyId: null,
    requestedBy: { id: CS, displayName: "สมชาย ตัวอย่าง (ข้อมูลจำลอง)" },
    orderValue: "24500.00",
    requestedPct: "18.0000",
    requestedAmount: "4410.00",
    approvedPct: null,
    resultingMarginPct: "8.2000",
    belowMarginFloor: true,
    reason: "ลูกค้าประจำ สั่งซ้ำทุกเดือน",
    approvalId: mockId("appr", 2),
    appliedGroupCode: null,
    evidence: [],
    validUntil: bangkokIso(DAY * 14),
    createdAt: bangkokIso(-106),
  },
];

/** D-052: what CS may give on their own (`discounts.cs_limit_pct`); the API enforces it, not the UI. */
function csLimit(): number {
  const setting = settings.find((candidate) => candidate.key === "discounts.cs_limit_pct");
  return Number(typeof setting?.current?.value === "string" ? setting.current.value : "5");
}

/** Follow each memo's approval, as the backend's subscriber would. */
function syncMemos() {
  for (const memo of memos) {
    const approval = approvals.find((candidate) => candidate.id === memo.approvalId);
    if (memo.status === "pending_approval" && approval && approval.status !== "pending") {
      memo.status =
        approval.status === "approved" ? "approved" : approval.status === "rejected" ? "rejected" : "withdrawn";
      if (memo.status === "approved") memo.approvedPct = memo.requestedPct;
    }
  }
}

/** Refuses a discount the actor may not give alone, as checkout and its preview both do. */
function refusedDiscount(body: Schemas["AdminCheckoutDto"]): Response | null {
  syncMemos();
  const memo = body.discountMemoId ? memos.find((candidate) => candidate.id === body.discountMemoId) : undefined;
  if (body.discountMemoId && memo?.status !== "approved")
    return problem(409, "discount_memos.not_usable", "บันทึกขอส่วนลดยังไม่ได้รับอนุมัติ");
  if (!memo && body.csDiscountPct && Number(body.csDiscountPct) > csLimit())
    return problem(422, "discounts.cs_limit_exceeded", `ส่วนลดเกิน ${csLimit()}% ต้องขออนุมัติผ่านบันทึกขอส่วนลด`);
  return null;
}

/* -------------------------------------------------------------------------------- handlers */

export const salesHandlers = [
  ...(["folding", "corrugate"] as const).flatMap((calculator) => [
    http.get(`*/v1/admin/cs/${calculator}/input-data`, ({ request }) => {
      if (!allowed(request, "quotes.calculate")) return forbidden();
      return HttpResponse.json(calculator === "folding" ? foldingInputData() : corrugateInputData());
    }),
    http.post(`*/v1/admin/cs/${calculator}/calculate`, async ({ request }) => {
      const who = allowed(request, "quotes.calculate");
      if (!who) return forbidden();
      const config = (await request.json().catch(() => null)) as Configuration | null;
      if (!config) return invalid("", "body required");
      const postcode = new URL(request.url).searchParams.get("deliveryPostcode") ?? undefined;
      const result = calculate(calculator, who, config, postcode);
      return result instanceof Response ? result : HttpResponse.json(result);
    }),
  ]),

  http.get("*/v1/admin/quotes", ({ request }) => {
    if (!allowed(request, "quotes.read")) return forbidden();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const customerId = url.searchParams.get("customerId");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = quotations
      .filter((quote) => !status || quote.status === status)
      .filter((quote) => !customerId || quote.customer?.id === customerId)
      .filter((quote) => !url.searchParams.get("channel") || quote.channel === url.searchParams.get("channel"))
      .filter((quote) => matchesQuery(q, quote.quoteCode, quote.customer?.displayName));
    const sort = url.searchParams.get("sort") ?? "createdAt";
    const order = (url.searchParams.get("order") as "asc" | "desc" | null) ?? "desc";
    return HttpResponse.json(paginate(sortBy(rows, sort, order), pageOf(url)));
  }),

  http.post("*/v1/admin/quotes", async ({ request }) => {
    const who = allowed(request, "quotes.manage");
    if (!who) return forbidden();
    const body = (await request.json().catch(() => null)) as Schemas["StaffSaveQuoteDto"] | null;
    if (!body?.productTypeCode) return invalid("productTypeCode", "required");
    const calculator = PRODUCT_TYPES.find((type) => type.code === body.productTypeCode)?.calculatorKey;
    if (calculator !== "folding" && calculator !== "corrugate")
      return problem(422, "pricing.not_instant", "ประเภทสินค้านี้ขอใบเสนอราคา (RFQ) เท่านั้น");
    const customer = customers.find((candidate) => candidate.id === body.customerUserId);
    const config = body.configuration as Configuration;
    const result = calculate(calculator, who, config, body.deliveryPostcode);
    if (result instanceof Response) return result;
    const instant = result.steps.filter((step) => step.instant);
    if (instant.length === 0) return problem(422, "pricing.not_instant", "ราคานี้คำนวณทันทีไม่ได้ ส่งเป็น RFQ");
    const quote: Quote = {
      id: mockId("quo", 902 + quotations.length),
      quoteCode: `QT-2569-${String(200 + quotations.length).padStart(5, "0")}`,
      productTypeCode: body.productTypeCode,
      source: "instant",
      status: "saved",
      channel: "cs",
      customer: customer ? { id: customer.id, displayName: customer.displayName } : null,
      customerCode: customer?.customerCode ?? null,
      createdBy: { id: who.id, displayName: who.displayName },
      note: body.note?.trim() || null,
      rfq: null,
      summary: lineSummaryOf(body.productTypeCode),
      configuration: config,
      deliveryPostcode: body.deliveryPostcode ?? null,
      currency: "THB",
      options: instant.map((step, index) => ({
        id: mockId("qop", 1000 + quotations.length * 10 + index),
        quantity: step.quantity,
        unitPrice: step.unitPrice!,
        productAmount: step.productAmount!,
        designFeeAmount: step.designFeeAmount ?? "0.00",
        structureDesignFeeAmount: step.structureDesignFeeAmount ?? "0.00",
        toolingAmount: step.toolingAmount,
        shippingAmount: step.shippingAmount,
        shippingPending: step.shippingPending,
        shippingPendingReason: step.shippingPendingReason,
        netAmount: (
          (Math.round(Number(step.grossAmount) * 100) - Math.round(Number(step.vatAmount) * 100)) /
          100
        ).toFixed(2),
        vatAmount: step.vatAmount!,
        grossAmount: step.grossAmount!,
        leadTimeDays: step.leadTimeDays,
        earliestShipDate: step.earliestShipDate,
        earliestDeliveryDate: step.earliestDeliveryDate,
        toleranceShortagePct: step.toleranceShortagePct,
        toleranceOveragePct: step.toleranceOveragePct,
        internal: step.internal,
      })),
      priceLocked: true,
      pdfStatus: "none",
      sharedAt: null,
      validUntil: bangkokIso(DAY * 15),
      createdAt: bangkokIso(),
    };
    quotations.unshift(quote);
    return HttpResponse.json(quote, { status: 201 });
  }),

  http.get("*/v1/admin/quotes/:quoteId", ({ params, request }) => {
    if (!allowed(request, "quotes.read")) return forbidden();
    const quote = quotations.find((candidate) => candidate.id === params.quoteId);
    return quote ? HttpResponse.json(quote) : notFound("ใบเสนอราคา");
  }),

  // The PDF is rendered asynchronously: request it, then read it until it is ready.
  http.post("*/v1/admin/quotes/:quoteId/actions/request-pdf", ({ params, request }) => {
    if (!allowed(request, "quotes.manage")) return forbidden();
    const quote = quotations.find((candidate) => candidate.id === params.quoteId);
    if (!quote) return notFound("ใบเสนอราคา");
    quote.pdfStatus = "ready";
    return HttpResponse.json(quote, { status: 202 });
  }),

  http.get("*/v1/admin/quotes/:quoteId/pdf", ({ params, request }) => {
    if (!allowed(request, "quotes.read")) return forbidden();
    const quote = quotations.find((candidate) => candidate.id === params.quoteId);
    if (!quote) return notFound("ใบเสนอราคา");
    const text = `ใบเสนอราคา ${quote.quoteCode}\nบริษัท Collective Group (Thailand) — Packio (ข้อมูลจำลอง)`;
    const body: Schemas["QuotePdfDto"] =
      quote.pdfStatus === "ready"
        ? {
            status: "ready",
            url: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
            expiresAt: bangkokIso(5),
          }
        : { status: quote.pdfStatus, url: null, expiresAt: null };
    return HttpResponse.json(body);
  }),

  http.get("*/v1/admin/customers/:customerId/cart", ({ params, request }) => {
    if (!allowed(request, "carts.manage_on_behalf")) return forbidden();
    const entry = cartOf(params.customerId as string);
    return withEtag(entry.cart, cartTag(entry));
  }),

  http.post("*/v1/admin/customers/:customerId/cart/items", async ({ params, request }) => {
    if (!allowed(request, "carts.manage_on_behalf")) return forbidden();
    const entry = cartOf(params.customerId as string);
    const refused = precondition(request, cartTag(entry));
    if (refused) return refused;
    const body = (await request.json().catch(() => null)) as Schemas["AddCartItemDto"] | null;
    const quote = quotations.find((candidate) => candidate.id === body?.quoteId);
    const chosen = quote?.options.find((candidate) => candidate.id === body?.quoteOptionId);
    if (!body || !quote || !chosen) return notFound("ใบเสนอราคา");
    if (!["saved", "shared"].includes(quote.status))
      return problem(409, "quotes.not_live", "ใบเสนอราคานี้ใช้ไม่ได้แล้ว");
    if (entry.cart.items.some((item) => item.quoteOptionId === chosen.id))
      return problem(409, "cart.item_exists", "รายการนี้อยู่ในตะกร้าแล้ว");
    const customer = customers.find((candidate) => candidate.id === params.customerId)!;
    const destinations = (body.destinations ?? []).map((destination, index) => {
      const address = customer.addresses.find((candidate) => candidate.id === destination.addressId);
      return {
        id: mockId("cds", entry.cart.items.length * 10 + index + 1),
        addressId: destination.addressId,
        quantity: destination.quantity,
        address: {
          recipientName: address?.recipientName ?? "",
          phone: address?.phone ?? "",
          line1: address?.line1 ?? "",
          line2: address?.line2 ?? null,
          subdistrictId: null,
          subdistrictNameTh: address?.subdistrict ?? null,
          districtNameTh: address?.district ?? null,
          provinceId: mockId("prv", 1),
          provinceNameTh: address?.province ?? "",
          postcode: address?.postcode ?? "",
        },
      };
    });
    entry.cart.items.push({
      id: mockId("cti", entry.cart.items.length + 1 + Math.floor(Math.random() * 1e4)),
      quoteId: quote.id,
      quoteOptionId: chosen.id,
      quoteCode: quote.quoteCode,
      productTypeCode: quote.productTypeCode,
      summary: quote.summary,
      source: "instant",
      quantity: chosen.quantity,
      unitPrice: chosen.unitPrice,
      productGrossAmount: chosen.grossAmount,
      designFeeAmount: chosen.designFeeAmount,
      quoteShippingAmount: chosen.shippingAmount,
      designOption: body.designOption,
      designDocumentId: body.designDocumentId ?? null,
      designNote: body.designNote ?? null,
      mockupOption: body.mockupOption ?? "none",
      destinations,
      destinationsComplete: destinations.reduce((sum, item) => sum + item.quantity, 0) === chosen.quantity,
      priceLocked: true,
      priceLockedUntil: quote.validUntil,
      pendingReprice: null,
      reorderOf: null,
      reusesApprovedArtwork: false,
    });
    touch(entry);
    return withEtag(entry.cart, cartTag(entry), 201);
  }),

  http.delete("*/v1/admin/customers/:customerId/cart/items/:itemId", ({ params, request }) => {
    if (!allowed(request, "carts.manage_on_behalf")) return forbidden();
    const entry = cartOf(params.customerId as string);
    entry.cart.items = entry.cart.items.filter((item) => item.id !== params.itemId);
    touch(entry);
    return withEtag(entry.cart, cartTag(entry));
  }),

  http.get("*/v1/admin/discount-memos", ({ request }) => {
    if (!allowed(request, "discount_memos.read")) return forbidden();
    syncMemos();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const customerId = url.searchParams.get("customerId");
    const requestedBy = url.searchParams.get("requestedBy");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = memos
      .filter((memo) => !status || memo.status === status)
      .filter((memo) => !customerId || memo.customer?.id === customerId)
      .filter((memo) => !requestedBy || memo.requestedBy.id === requestedBy)
      .filter((memo) => matchesQuery(q, memo.customer?.displayName, memo.reason));
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),

  http.get("*/v1/admin/discount-memos/:memoId", ({ params, request }) => {
    if (!allowed(request, "discount_memos.read")) return forbidden();
    syncMemos();
    const memo = memos.find((candidate) => candidate.id === params.memoId);
    return memo ? HttpResponse.json(memo) : notFound("บันทึกขอส่วนลด");
  }),

  // A memo prices the customer's CS cart (the triage's mapping): no cart, no memo.
  http.post("*/v1/admin/discount-memos", async ({ request }) => {
    const who = allowed(request, "discount_memos.request");
    if (!who) return forbidden();
    const body = (await request.json().catch(() => null)) as Schemas["RaiseOrderMemoDto"] | null;
    const customer = customers.find((candidate) => candidate.id === body?.customerId);
    if (!body || !customer) return notFound("ลูกค้า");
    const entry = cartOf(customer.id);
    if (entry.cart.items.length === 0) return problem(422, "checkout.cart_empty", "ตะกร้าของลูกค้ายังว่าง");
    const requested = Number(body.requestedPct);
    if (!(requested > csLimit()))
      return problem(
        422,
        "discount_memos.within_cs_limit",
        `ส่วนลดไม่เกิน ${csLimit()}% CS ให้เองได้ ไม่ต้องขออนุมัติ`,
      );
    const orderValue = Math.round(Number(entry.cart.productGrossAmount) * 100);
    const margin = 31 - requested;
    const memo: Memo = {
      id: mockId("mem", memos.length + 1),
      scope: "order",
      status: "pending_approval",
      customer: { id: customer.id, displayName: customer.displayName },
      companyId: null,
      requestedBy: { id: who.id, displayName: who.displayName },
      orderValue: (orderValue / 100).toFixed(2),
      requestedPct: requested.toFixed(4),
      requestedAmount: (Math.round((orderValue * requested) / 100) / 100).toFixed(2),
      approvedPct: null,
      resultingMarginPct: margin.toFixed(4),
      belowMarginFloor: margin < 10,
      reason: body.reason,
      approvalId: null,
      appliedGroupCode: null,
      // The files the memo was raised with, as the uploads mock keeps them (D-052).
      evidence: (body.evidenceFileIds ?? []).flatMap((id) => {
        const file = files.get(id);
        return file
          ? [{ id: file.id, originalName: file.originalName, mimeType: file.mimeType, sizeBytes: file.sizeBytes }]
          : [];
      }),
      validUntil: bangkokIso(DAY * 15),
      createdAt: bangkokIso(),
    };
    // The memo enters the approvals engine, routed to the matching tier only (D-162).
    memo.approvalId = openApproval({
      policy: "discount_memo",
      subjectType: "discount_memo",
      subjectId: memo.id,
      requester: who,
      amount: memo.requestedAmount,
      pct: memo.requestedPct,
      payload: {
        customerName: customer.displayName,
        orderValue: memo.orderValue,
        requestedPct: memo.requestedPct,
        resultingMarginPct: memo.resultingMarginPct,
        reason: body.reason,
      },
    }).id;
    memos.unshift(memo);
    return HttpResponse.json(memo, { status: 201 });
  }),

  http.post("*/v1/admin/customers/:customerId/checkout/actions/preview", async ({ params, request }) => {
    if (!allowed(request, "carts.manage_on_behalf")) return forbidden();
    const entry = cartOf(params.customerId as string);
    if (entry.cart.items.length === 0) return problem(422, "checkout.cart_empty", "ตะกร้าของลูกค้ายังว่าง");
    const body = ((await request.json().catch(() => null)) ?? {}) as Schemas["AdminCheckoutDto"];
    const refused = refusedDiscount(body);
    if (refused) return refused;
    return undefined;
  }),

  // CS checkout: the customer's whole cart becomes one order group.
  http.post("*/v1/admin/customers/:customerId/checkout", async ({ params, request }) => {
    const who = allowed(request, "carts.manage_on_behalf");
    if (!who) return forbidden();
    if (!request.headers.get("Idempotency-Key"))
      return problem(400, "idempotency.key_required", "ต้องระบุ Idempotency-Key");
    const customer = customers.find((candidate) => candidate.id === params.customerId);
    if (!customer) return notFound("ลูกค้า");
    const entry = cartOf(customer.id);
    if (entry.cart.items.length === 0) return problem(422, "checkout.cart_empty", "ตะกร้าของลูกค้ายังว่าง");
    if (entry.cart.items.some((item) => !item.destinationsComplete))
      return problem(422, "checkout.destinations_incomplete", "ยังแบ่งจำนวนส่งไม่ครบ");
    const body = ((await request.json().catch(() => null)) ?? {}) as Schemas["AdminCheckoutDto"];
    const refused = refusedDiscount(body);
    if (refused) return refused;
    const memo = body.discountMemoId ? memos.find((candidate) => candidate.id === body.discountMemoId) : undefined;
    const groupNo = 900 + orders.length;
    const groupId = mockId("grp", groupNo);
    const groupCode = `PG-2569-${String(groupNo).padStart(5, "0")}`;
    // Real order rows, so the new order opens and shows up in รอชำระ.
    const template = orders.find((order) => order.status === "waiting_payment")!;
    entry.cart.items.forEach((item, index) => {
      orders.unshift({
        ...structuredClone(template),
        id: mockId("ord", groupNo * 10 + index),
        orderCode: `PK-2569-${String(groupNo * 10 + index).padStart(6, "0")}`,
        groupId,
        groupCode,
        channel: "cs",
        customer: {
          id: customer.id,
          customerCode: customer.customerCode,
          displayName: customer.displayName,
          companyName: customer.companyName,
        },
        quantity: item.quantity,
        grossAmount: item.productGrossAmount,
        createdAt: bangkokIso(),
        csRemarks: body.csRemarks ?? null,
        poNumber: body.poNumber ?? null,
      });
    });
    for (const item of entry.cart.items) {
      const quote = quotations.find((candidate) => candidate.id === item.quoteId);
      if (quote) quote.status = "converted";
    }
    if (memo) {
      memo.status = "applied";
      memo.appliedGroupCode = groupCode;
    }
    entry.cart.items = [];
    touch(entry);
    return HttpResponse.json(toGroupDto(groupId, who), { status: 201 });
  }),
];
