/**
 * The configurator v2's API (U2.F1), mocked over the quotations of `./quotes.ts`:
 *
 *   `store.advisory.*` (U2.2)        the Structure Advisor — a simplified McKee estimate over the
 *                                    corrugated mock's flutes, priced by the mock engine
 *   `store.quotes.getLevers|applyLever|sendToCs|decline` (U2.3)
 *   `store.configurations.*` (U2.1)  drafts with completeness, share links, the shared read
 *   `store.me.updatePreferences`     the display unit (D-183)
 *
 * Every number is the mock's own fake arithmetic — never a strength, a price or a rule anyone
 * may read as real. The shapes are the published DTOs.
 */

import { http, HttpResponse, type HttpHandler } from "msw";

import type { Schemas } from "@/lib/api/types";

import { catalogueRows } from "../admin/catalogue";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { live } from "./catalog";
import { customerMe, customerOf, displayUnits, editorModes, type MockCustomer } from "./customers";
import {
  buildQuote,
  findQuote,
  gapOf,
  inputsOf,
  productOfId,
  quoteFacts,
  quotesOf,
  setAdvisoryLookup,
  stepOf,
  toSavedQuote,
  uncoded,
} from "./quotes";
import { fileRoutedRfq } from "./rfq";
import { caliperOf } from "./specs";

const DAY = 24 * 60;
const english = (request: Request) => request.headers.get("accept-language")?.startsWith("en") ?? false;
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = (what = "ไม่พบรายการนี้") => problem(404, "http.not_found", what);
const TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const newToken = () => Array.from({ length: 43 }, () => TOKEN_ALPHABET[Math.floor(Math.random() * 64)]).join("");
const json = async <T>(request: Request) => ((await request.json().catch(() => null)) ?? {}) as T;

/* ------------------------------------------------------------------------- the advisor */

/** The mock's rule set (D-237): what `store.advisory.getMethod` publishes, obviously illustrative. */
const RULES = {
  mckeeConstant: 5.87,
  uncertaintyPct: 15,
  thinMarginPct: 10,
  humidity: { dry: 1, normal: 0.85, humid: 0.7, very_humid: 0.55 },
  storage: { up_to_10_days: 0.9, up_to_30_days: 0.8, up_to_90_days: 0.7, over_90_days: 0.6 },
  fragility: { low: 1, medium: 0.9, high: 0.8 },
  transport: { pickup: 1, parcel_domestic: 0.85, pallet_domestic: 0.9, sea_export: 0.75 },
  palletPattern: { column: 1, interlocked: 0.6 },
  palletOverhang: { no: 1, yes: 0.75 },
} as const;
const RULE_SET_VERSION = { versionNo: 1, effectiveFrom: "2026-10-03T00:00:00+07:00" };
/** Illustrative edge-crush values per flute (kN/m) — mock only. */
const FLUTE_ECT: Record<string, number> = { E: 3.5, B: 5, C: 6, BC: 9 };

interface Recommendation {
  dto: Schemas["AdvisoryRecommendationDto"];
  owner: string;
}
const recommendations = new Map<string, Recommendation>();
let recommendationSeq = 0;

const ownerKey = (customer: MockCustomer | null, anonymousId: string | undefined) =>
  customer ? `customer:${customer.id}` : `anonymous:${anonymousId ?? ""}`;

setAdvisoryLookup((recommendationId) => {
  const choice = recommendations.get(recommendationId)?.dto.choice;
  return choice ? { boardId: choice.boardId, ref: { recommendationId, choiceId: choice.id } } : null;
});

const round = (value: number, digits = 0) => Number(value.toFixed(digits));

function recommend(
  request: Request,
  body: Schemas["StoreRecommendDto"],
): Schemas["AdvisoryRecommendationDto"] | Response {
  if (body.productTypeCode !== "corrugated")
    return problem(422, "advisory.not_supported", "คำแนะนำโครงสร้างใช้ได้กับกล่องลูกฟูกเท่านั้น");
  const raw = body.configuration as Record<string, unknown>;
  const inputs = inputsOf(body.productTypeCode, raw);
  if (inputs instanceof Response) return inputs;
  const { load } = body;
  const factors: Schemas["AdvisoryFactorDto"][] = [
    { factor: "humidity", band: load.humidity, value: RULES.humidity[load.humidity] },
    { factor: "storage", band: load.storage, value: RULES.storage[load.storage] },
    { factor: "fragility", band: load.fragility, value: RULES.fragility[load.fragility] },
    { factor: "transport", band: load.transportMode, value: RULES.transport[load.transportMode] },
    ...(load.pallet
      ? [
          {
            factor: "palletPattern" as const,
            band: load.pallet.pattern,
            value: RULES.palletPattern[load.pallet.pattern],
          },
          {
            factor: "palletOverhang" as const,
            band: load.pallet.overhang ? "yes" : "no",
            value: RULES.palletOverhang[load.pallet.overhang ? "yes" : "no"],
          },
        ]
      : []),
  ];
  const combined = factors.reduce((product, factor) => product * factor.value, 1);
  const perimeterMm = 2 * (inputs.l + inputs.w);
  const tareKg = round(((2 * (inputs.l * inputs.w + inputs.w * inputs.d + inputs.l * inputs.d)) / 1e6) * 0.55, 3);
  const boxWeightKg = round((load.unitsPerBox * load.productWeightG) / 1000 + tareKg, 3);
  const loadN = round((load.stackLayers - 1) * boxWeightKg * 9.80665, 1);
  const requiredBctN = round(loadN / combined, 1);
  const quantity = inputs.quantities[0] ?? 1000;
  const flutes = live(catalogueRows("fluteTypes"));
  const options = flutes.map((flute): Schemas["AdvisoryOptionDto"] => {
    const ect = FLUTE_ECT[String(flute.code)] ?? 4;
    const caliper = caliperOf(String(flute.id)) ?? 3;
    const estimate = RULES.mckeeConstant * ect * Math.sqrt(caliper * perimeterMm);
    const band = (estimate * RULES.uncertaintyPct) / 100;
    const priced = inputsOf(body.productTypeCode, { ...raw, materialId: flute.id, quantities: [quantity] });
    const step = priced instanceof Response ? null : stepOf(priced, quantity, body.deliveryPostcode);
    const low = round(estimate - band, 1);
    const passes = low >= requiredBctN;
    const marginPct = requiredBctN > 0 ? round(((low - requiredBctN) / requiredBctN) * 100, 1) : null;
    return {
      board: {
        id: String(flute.id),
        code: String(flute.code),
        fluteCode: String(flute.code),
        layers: Number(flute.layers ?? 3),
        nameTh: String(flute.name),
        nameEn: `${String(flute.code)} flute board`,
      },
      bct: { low, estimate: round(estimate, 1), high: round(estimate + band, 1) },
      caliperMm: caliper,
      ectKnPerM: ect,
      grammageGsm: 300 + ect * 40,
      requiredEctKnPerM: round(requiredBctN / (RULES.mckeeConstant * Math.sqrt(caliper * perimeterMm)), 2),
      passes,
      marginPct,
      instant: Boolean(step?.instant),
      unitPrice: step?.instant ? step.unitPrice : null,
      grossAmount: step?.instant ? step.grossAmount : null,
      leadTimeDays: step?.instant ? (step.leadTimeDays ?? null) : null,
      currency: "THB",
      roles: [],
      warnings: passes
        ? marginPct !== null && marginPct < RULES.thinMarginPct
          ? ["thin_margin"]
          : []
        : ["below_requirement"],
    };
  });
  const passing = options.filter((option) => option.passes && option.instant);
  const price = (option: Schemas["AdvisoryOptionDto"]) => Number(option.unitPrice ?? Infinity);
  const byPrice = [...passing].sort((a, b) => price(a) - price(b) || b.bct.low - a.bct.low);
  const recommended = byPrice[0] ?? null;
  const strongest = [...passing].sort((a, b) => b.bct.low - a.bct.low)[0] ?? null;
  const fastest = [...passing].sort((a, b) => (a.leadTimeDays ?? 99) - (b.leadTimeDays ?? 99))[0] ?? null;
  const closest = recommended ? null : ([...options].sort((a, b) => b.bct.low - a.bct.low)[0] ?? null);
  const role = (option: Schemas["AdvisoryOptionDto"] | null, name: Schemas["AdvisoryOptionRole"]) => {
    if (option && !option.roles.includes(name)) option.roles.push(name);
  };
  role(recommended, "recommended");
  role(byPrice[0] ?? null, "cheapest");
  role(strongest, "strongest");
  role(fastest, "fastest");
  role(closest, "closest");
  const alternatives = [byPrice[0], strongest, fastest]
    .filter((option): option is Schemas["AdvisoryOptionDto"] => Boolean(option) && option !== recommended)
    .filter((option, index, all) => all.indexOf(option) === index)
    .map((option) => ({
      boardId: option.board.id,
      roles: option.roles.filter((name) => name !== "recommended"),
      unitPriceDelta:
        recommended?.unitPrice && option.unitPrice
          ? (Number(option.unitPrice) - Number(recommended.unitPrice)).toFixed(2)
          : null,
      leadTimeDeltaDays:
        recommended?.leadTimeDays != null && option.leadTimeDays != null
          ? option.leadTimeDays - recommended.leadTimeDays
          : null,
    }));
  recommendationSeq += 1;
  const dto: Schemas["AdvisoryRecommendationDto"] = {
    id: mockId("adv", recommendationSeq),
    outcome: recommended ? "recommended" : "no_board_meets_load",
    recommendedBoardId: recommended?.board.id ?? null,
    closestBoardId: closest?.board.id ?? null,
    noticeCode: "advisory.indicative",
    requirement: {
      layers: load.stackLayers,
      boxWeightKg,
      tareKg,
      loadN,
      perimeterMm,
      combinedFactor: round(combined, 4),
      factors,
      requiredBctN,
    },
    reasons: factors.map((factor) => ({
      code: "factor",
      factor: factor.factor,
      band: factor.band,
      value: factor.value,
    })),
    options,
    alternatives,
    warnings: recommended ? recommended.warnings : ["no_board_meets_load"],
    choice: null,
    ruleSetVersion: RULE_SET_VERSION,
    engineVersion: "1.0.0",
    createdAt: bangkokIso(),
  };
  recommendations.set(dto.id, { dto, owner: ownerKey(customerOf(request), body.anonymousId) });
  return dto;
}

/* ----------------------------------------------------------------------------- levers */

interface LeverSet {
  dto: Schemas["QuoteLeversDto"];
  configurations: Map<string, Record<string, unknown>>;
}
const leverSets = new Map<string, LeverSet>();
let leverSeq = 0;

function leversOf(quoteId: string): Schemas["QuoteLeversDto"] | Response {
  const known = leverSets.get(quoteId);
  if (known) return known.dto;
  const quote = findQuote(quoteId);
  const target = quoteFacts.get(quoteId)?.target ?? null;
  if (!quote || !target) return problem(422, "quotes.no_target", "ใบเสนอราคานี้ไม่มีราคาเป้าหมาย");
  const raw = quote.configuration as Record<string, unknown>;
  const base = inputsOf(quote.productType.code, raw);
  if (base instanceof Response) return base;
  const configurator = base.configurator;
  const empty = (status: Schemas["QuoteLeverSetStatus"]) => {
    const dto = { quoteId, targetPricePerUnit: target, status, computedAt: bangkokIso(), levers: [] };
    leverSets.set(quoteId, { dto, configurations: new Map() });
    return dto;
  };
  if (gapOf(quote.unitPrice, target).meetsTarget) return empty("meets_target");
  const quantity = quote.quantity;
  const part = (Array.isArray(raw.parts) ? raw.parts[0] : raw) as Record<string, unknown>;
  const withPart = (patch: Record<string, unknown>) =>
    Array.isArray(raw.parts) ? { ...raw, parts: [{ ...part, ...patch }] } : { ...raw, ...patch };
  const presets = configurator.quantity.presets.filter((preset) => preset > quantity).slice(0, 2);
  const materials = configurator.groups.find((group) => group.kind === "material")?.options ?? [];
  const candidates: {
    kind: Schemas["QuoteLeverKind"];
    reason: Schemas["QuoteLeverReason"];
    changes: Record<string, unknown>;
    configuration: Record<string, unknown>;
  }[] = [
    ...(presets.length > 0
      ? [
          {
            kind: "quantity" as const,
            reason: "quantity_increased" as const,
            changes: { quantities: { from: [quantity], to: presets } },
            configuration: { ...raw, quantities: presets },
          },
        ]
      : []),
    ...materials
      .filter((material) => material.id !== raw.materialId)
      .slice(0, 2)
      .map((material) => ({
        kind: "material" as const,
        reason: "material_changed" as const,
        changes: { materialId: { from: raw.materialId, to: material.id } },
        configuration: { ...raw, materialId: material.id },
      })),
    ...(Array.isArray(part.printBack) && part.printBack.length > 0
      ? [
          {
            kind: "back_print" as const,
            reason: "back_print_removed" as const,
            changes: { printBack: { from: part.printBack, to: [] } },
            configuration: withPart({ printBack: [] }),
          },
        ]
      : []),
    ...(Array.isArray(part.finish2) && part.finish2.length > 0
      ? [
          {
            kind: "special_finish" as const,
            reason: "special_finish_removed" as const,
            changes: { finish2: { from: part.finish2, to: [] } },
            configuration: withPart({ finish2: [] }),
          },
        ]
      : []),
    ...(part.finish1FrontId || part.coatingFrontId
      ? [
          {
            kind: "coating" as const,
            reason: "coating_removed" as const,
            changes: { coating: { from: part.finish1FrontId ?? part.coatingFrontId, to: null } },
            configuration: withPart({
              finish1FrontId: undefined,
              finish1BackId: undefined,
              coatingFrontId: undefined,
              coatingBackId: undefined,
            }),
          },
        ]
      : []),
    ...(Array.isArray(part.assemblies) && part.assemblies.length > 0
      ? [
          {
            kind: "assembly" as const,
            reason: "assembly_removed" as const,
            changes: { assemblies: { from: part.assemblies, to: [] } },
            configuration: withPart({ assemblies: [] }),
          },
        ]
      : []),
  ];
  const configurations = new Map<string, Record<string, unknown>>();
  const levers = candidates
    .flatMap((candidate) => {
      const inputs = inputsOf(quote.productType.code, candidate.configuration);
      if (inputs instanceof Response) return [];
      const quantities = (candidate.configuration.quantities as number[] | undefined) ?? [quantity];
      const steps = quantities
        .map((each) => stepOf(inputs, each, quote.deliveryPostcode ?? undefined))
        .filter((step) => step.instant && step.unitPrice);
      if (steps.length === 0) return [];
      const best = Math.min(...steps.map((step) => Number(step.unitPrice)));
      if (best >= Number(quote.unitPrice)) return [];
      leverSeq += 1;
      const id = mockId("lev", leverSeq);
      configurations.set(id, candidate.configuration);
      return [
        {
          id,
          kind: candidate.kind,
          rank: 0,
          reasonCodes: [candidate.reason],
          changes: candidate.changes,
          configuration: candidate.configuration,
          bestSavingPct: (((Number(quote.unitPrice) - best) / Number(quote.unitPrice)) * 100).toFixed(4),
          steps: steps.map((step) => ({
            quantity: step.quantity,
            unitPrice: step.unitPrice!,
            grossAmount: step.grossAmount!,
            leadTimeDays: step.leadTimeDays,
            ...gapOf(step.unitPrice!, target),
          })),
          takenQuoteId: null,
          validUntil: quote.validUntil,
        } satisfies Schemas["QuoteLeverDto"],
      ];
    })
    .sort((a, b) => Number(b.bestSavingPct) - Number(a.bestSavingPct))
    .slice(0, 5)
    .map((lever, index) => ({ ...lever, rank: index + 1 }));
  const dto: Schemas["QuoteLeversDto"] = {
    quoteId,
    targetPricePerUnit: target,
    status: "computed",
    computedAt: bangkokIso(),
    levers,
  };
  leverSets.set(quoteId, { dto, configurations });
  return dto;
}

/* ------------------------------------------------------------------------------- drafts */

interface DraftRow {
  dto: Schemas["ConfigurationDraftDto"];
  owner: string;
  shareToken: string | null;
}
const drafts = new Map<string, DraftRow>();
let draftSeq = 0;
const DRAFT_RETENTION_DAYS = 90;
const SHARE_LINK_DAYS = 15;

/** The fields each calculator cannot price without (the draft's completeness, D-185). */
function requiredOf(productTypeCode: string, configuration: Record<string, unknown>): string[] {
  const box = ["folding_carton", "corrugated"].includes(productTypeCode);
  const flat = ["label_sticker", "tag_sleeve", "flexible_pouch"].includes(productTypeCode);
  const fields = ["quantities"];
  if (box || flat) fields.push("basis", "l", "w", "materialId");
  if (box) fields.push("patternId", ...(configuration.basis === "product" ? [] : ["d"]));
  if (productTypeCode === "tag_sleeve") fields.push("patternId", "diecutTypeId");
  if (productTypeCode === "flexible_pouch") fields.push("patternId");
  return fields;
}

function assess(row: Pick<DraftRow["dto"], "productTypeCode" | "configuration">) {
  const required = requiredOf(row.productTypeCode, row.configuration);
  const given = (value: unknown) =>
    value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);
  const missingFields = required.filter((field) => !given(row.configuration[field]));
  const completenessPct = Math.round(((required.length - missingFields.length) / required.length) * 1000) / 10;
  return { missingFields, completenessPct, complete: missingFields.length === 0 };
}

const inDays = (days: number) => bangkokIso(days * DAY);

function draftOf(request: Request, draftId: unknown): DraftRow | Response {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const row = drafts.get(String(draftId));
  return row && row.owner === customer.id ? row : notFound("ไม่พบร่างนี้");
}

/* ----------------------------------------------------------------------------- handlers */

export const quoteToolHandlers: HttpHandler[] = [
  http.get("*/v1/store/advisory/method", () =>
    HttpResponse.json({
      available: true,
      engineVersion: "1.0.0",
      noticeCode: "advisory.indicative",
      ruleSet: { mckeeConstant: String(RULES.mckeeConstant), uncertaintyPct: String(RULES.uncertaintyPct) },
      ruleSetVersion: RULE_SET_VERSION,
    } satisfies Schemas["AdvisoryMethodDto"]),
  ),

  http.post("*/v1/store/advisory/recommendations", async ({ request }) => {
    const body = await json<Schemas["StoreRecommendDto"]>(request);
    if (!body.load || !body.configuration)
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "load", code: "required", message: "required" },
      ]);
    const result = recommend(request, body);
    return result instanceof Response ? result : HttpResponse.json(result, { status: 201 });
  }),

  http.get("*/v1/store/advisory/recommendations/:recommendationId", ({ params, request }) => {
    const row = recommendations.get(String(params.recommendationId));
    const anonymousId = new URL(request.url).searchParams.get("anonymousId") ?? undefined;
    if (!row || row.owner !== ownerKey(customerOf(request), anonymousId)) return notFound("ไม่พบคำแนะนำนี้");
    return HttpResponse.json(row.dto);
  }),

  http.post("*/v1/store/advisory/recommendations/:recommendationId/actions/choose", async ({ params, request }) => {
    const body = await json<Schemas["ChooseBoardDto"]>(request);
    const row = recommendations.get(String(params.recommendationId));
    if (!row || row.owner !== ownerKey(customerOf(request), body.anonymousId)) return notFound("ไม่พบคำแนะนำนี้");
    const option = row.dto.options.find((candidate) => candidate.board.id === body.materialId);
    if (!option) return problem(422, "advisory.option_unknown", "บอร์ดนี้ไม่อยู่ในคำแนะนำ");
    const missing = option.warnings.filter((warning) => !(body.acknowledgedWarnings ?? []).includes(warning));
    if (missing.length > 0)
      return problem(422, "advisory.acknowledgement_required", "ต้องรับทราบคำเตือนของบอร์ดนี้ก่อน");
    row.dto = {
      ...row.dto,
      choice: {
        id: mockId("adc", recommendationSeq * 10 + 1),
        boardId: option.board.id,
        acknowledgedWarnings: option.warnings,
        chosenAt: bangkokIso(),
      },
    };
    return HttpResponse.json(row.dto);
  }),

  http.get("*/v1/store/quotes/:quoteId/levers", ({ params, request }) => {
    const customer = customerOf(request);
    const quote = customer
      ? quotesOf(customer.persona).find((candidate) => candidate.id === params.quoteId)
      : undefined;
    if (!quote) return notFound("ไม่พบใบเสนอราคานี้");
    const result = leversOf(quote.id);
    return result instanceof Response ? result : HttpResponse.json(result);
  }),

  http.post("*/v1/store/quotes/:quoteId/levers/:leverId/actions/apply", ({ params, request }) => {
    const customer = customerOf(request);
    const original = customer
      ? quotesOf(customer.persona).find((candidate) => candidate.id === params.quoteId)
      : undefined;
    const set = leverSets.get(String(params.quoteId));
    const configuration = set?.configurations.get(String(params.leverId));
    if (!customer || !original || !set || !configuration) return notFound("ไม่พบทางเลือกนี้");
    const inputs = inputsOf(original.productType.code, configuration);
    if (inputs instanceof Response) return inputs;
    const quantity = (configuration.quantities as number[] | undefined)?.[0] ?? original.quantity;
    const quote = buildQuote(
      inputs,
      { ...configuration, quantities: [quantity] },
      {
        quantity,
        ...(original.deliveryPostcode ? { deliveryPostcode: original.deliveryPostcode } : {}),
        designOption: original.designOption,
        mockupOption: "none",
      },
      english(request),
    );
    if (quote instanceof Response) return quote;
    const target = quoteFacts.get(original.id)?.target ?? null;
    quoteFacts.set(quote.id, {
      dimensions: inputs.dimensions,
      target,
      fromLever: { quoteId: original.id, leverId: String(params.leverId) },
    });
    original.status = "superseded";
    quoteFacts.set(original.id, {
      ...quoteFacts.get(original.id),
      outcome: {
        outcome: "revised",
        leverTakenId: String(params.leverId),
        lossReasonCode: null,
        occurredAt: bangkokIso(),
      },
    });
    set.dto = {
      ...set.dto,
      levers: set.dto.levers.map((lever) =>
        lever.id === params.leverId ? { ...lever, takenQuoteId: quote.id } : lever,
      ),
    };
    quotesOf(customer.persona).unshift(quote);
    uncoded.add(quote.id);
    return HttpResponse.json(toSavedQuote(quote), { status: 201 });
  }),

  http.post("*/v1/store/quotes/:quoteId/actions/send-to-cs", async ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const quote = quotesOf(customer.persona).find((candidate) => candidate.id === params.quoteId);
    if (!quote) return notFound("ไม่พบใบเสนอราคานี้");
    const body = await json<Schemas["SendQuoteToCsDto"]>(request);
    const raw = quote.configuration as Record<string, unknown>;
    const target = quoteFacts.get(quote.id)?.target;
    const rfq = fileRoutedRfq(customer, {
      productTypeCode: quote.productType.code,
      quantities: [quote.quantity],
      size:
        typeof raw.l === "number" && typeof raw.w === "number"
          ? { l: raw.l, w: raw.w, d: typeof raw.d === "number" ? raw.d : null }
          : null,
      deliveryPostcode: body.deliveryPostcode ?? quote.deliveryPostcode,
      notes: [body.notes, target ? `ราคาเป้าหมาย ${target} บาท/ชิ้น` : null].filter(Boolean).join("\n") || null,
      spec: quote.specs,
    });
    quote.status = "routed_to_rfq";
    quoteFacts.set(quote.id, {
      ...quoteFacts.get(quote.id),
      outcome: { outcome: "converted_to_rfq", leverTakenId: null, lossReasonCode: null, occurredAt: bangkokIso() },
    });
    return HttpResponse.json(
      { rfqId: rfq.id, rfqCode: rfq.rfqCode, quoteStatus: "routed_to_rfq" } satisfies Schemas["SendQuoteToCsResultDto"],
      { status: 201 },
    );
  }),

  http.post("*/v1/store/quotes/:quoteId/actions/decline", async ({ params, request }) => {
    const customer = customerOf(request);
    const quote = customer
      ? quotesOf(customer.persona).find((candidate) => candidate.id === params.quoteId)
      : undefined;
    if (!quote) return notFound("ไม่พบใบเสนอราคานี้");
    const body = await json<Schemas["DeclineQuoteDto"]>(request);
    quote.status = "declined";
    quoteFacts.set(quote.id, {
      ...quoteFacts.get(quote.id),
      outcome: {
        outcome: "lost",
        leverTakenId: null,
        lossReasonCode: body.reasonCode ?? null,
        occurredAt: bangkokIso(),
      },
    });
    return HttpResponse.json(toSavedQuote(quote));
  }),

  http.get("*/v1/store/configurations", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const list = [...drafts.values()]
      .filter((row) => row.owner === customer.id && row.dto.status === "open")
      .map((row) => row.dto)
      .sort((a, b) => b.lastChangedAt.localeCompare(a.lastChangedAt));
    return HttpResponse.json(paginate(list, { page: Number(query.page ?? 1), perPage: Number(query.perPage ?? 25) }));
  }),

  http.post("*/v1/store/configurations", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = await json<Schemas["CreateConfigurationDraftDto"]>(request);
    if (!body.productTypeCode || !body.configuration)
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "configuration", code: "required", message: "required" },
      ]);
    if (body.catalogProductId && !productOfId(body.catalogProductId)) return notFound("ไม่พบสินค้านี้");
    draftSeq += 1;
    const now = bangkokIso();
    const dto: Schemas["ConfigurationDraftDto"] = {
      id: mockId("cfd", draftSeq),
      productTypeCode: body.productTypeCode,
      catalogProductId: body.catalogProductId ?? null,
      title: body.title ?? null,
      configuration: body.configuration,
      targetPricePerUnit: body.targetPricePerUnit ?? null,
      ...assess({ productTypeCode: body.productTypeCode, configuration: body.configuration }),
      invalidFields: [],
      status: "open",
      sharedAt: null,
      shareExpiresAt: null,
      convertedQuoteId: null,
      convertedRfqId: null,
      createdAt: now,
      lastChangedAt: now,
      expiresAt: inDays(DRAFT_RETENTION_DAYS),
    };
    drafts.set(dto.id, { dto, owner: customer.id, shareToken: null });
    return HttpResponse.json(dto, { status: 201 });
  }),

  http.get("*/v1/store/configurations/:draftId", ({ params, request }) => {
    const row = draftOf(request, params.draftId);
    return row instanceof Response ? row : HttpResponse.json(row.dto);
  }),

  http.patch("*/v1/store/configurations/:draftId", async ({ params, request }) => {
    const row = draftOf(request, params.draftId);
    if (row instanceof Response) return row;
    if (row.dto.status !== "open") return problem(409, "configurations.converted", "ร่างนี้แปลงเป็นใบเสนอราคาแล้ว");
    const body = await json<Schemas["UpdateConfigurationDraftDto"]>(request);
    const configuration = body.configuration ?? row.dto.configuration;
    row.dto = {
      ...row.dto,
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.targetPricePerUnit !== undefined ? { targetPricePerUnit: body.targetPricePerUnit } : {}),
      configuration,
      ...assess({ productTypeCode: row.dto.productTypeCode, configuration }),
      lastChangedAt: bangkokIso(),
      expiresAt: inDays(DRAFT_RETENTION_DAYS),
    };
    return HttpResponse.json(row.dto);
  }),

  http.delete("*/v1/store/configurations/:draftId", ({ params, request }) => {
    const row = draftOf(request, params.draftId);
    if (row instanceof Response) return row;
    drafts.delete(row.dto.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("*/v1/store/configurations/:draftId/actions/share", ({ params, request }) => {
    const row = draftOf(request, params.draftId);
    if (row instanceof Response) return row;
    // A new link replaces the previous one (D-185).
    row.shareToken = newToken();
    row.dto = { ...row.dto, sharedAt: bangkokIso(), shareExpiresAt: inDays(SHARE_LINK_DAYS) };
    return HttpResponse.json({
      draft: row.dto,
      shareToken: row.shareToken,
      sharePath: `/v1/store/shared-configurations/${row.shareToken}`,
      expiresAt: row.dto.shareExpiresAt!,
    } satisfies Schemas["ShareConfigurationDraftResultDto"]);
  }),

  http.delete("*/v1/store/configurations/:draftId/share", ({ params, request }) => {
    const row = draftOf(request, params.draftId);
    if (row instanceof Response) return row;
    row.shareToken = null;
    row.dto = { ...row.dto, sharedAt: null, shareExpiresAt: null };
    return HttpResponse.json(row.dto);
  }),

  http.get("*/v1/store/shared-configurations/:token", ({ params }) => {
    const row = [...drafts.values()].find((candidate) => candidate.shareToken && candidate.shareToken === params.token);
    if (!row || row.dto.status !== "open" || !row.dto.shareExpiresAt || Date.parse(row.dto.shareExpiresAt) < Date.now())
      return notFound("ลิงก์นี้หมดอายุหรือไม่มีอยู่");
    const { dto } = row;
    return HttpResponse.json({
      productTypeCode: dto.productTypeCode,
      catalogProductId: dto.catalogProductId,
      title: dto.title,
      configuration: dto.configuration,
      completenessPct: dto.completenessPct,
      missingFields: dto.missingFields,
      expiresAt: dto.shareExpiresAt!,
    } satisfies Schemas["SharedConfigurationDraftDto"]);
  }),

  http.patch("*/v1/store/me/preferences", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = await json<Schemas["UpdatePreferencesDto"]>(request);
    if (body.displayUnit === undefined && body.editorMode === undefined)
      return problem(422, "validation.failed", "ส่งค่าอย่างน้อยหนึ่งค่า", [
        { path: "displayUnit", code: "required", message: "required" },
      ]);
    if (body.displayUnit !== undefined && !["mm", "cm", "in"].includes(body.displayUnit))
      return problem(422, "validation.failed", "หน่วยไม่ถูกต้อง", [
        { path: "displayUnit", code: "enum", message: "enum" },
      ]);
    if (body.editorMode !== undefined && !["easy", "pro"].includes(body.editorMode))
      return problem(422, "validation.failed", "โหมดไม่ถูกต้อง", [
        { path: "editorMode", code: "enum", message: "enum" },
      ]);
    if (body.displayUnit) displayUnits.set(customer.id, body.displayUnit);
    if (body.editorMode) editorModes.set(customer.id, body.editorMode);
    return HttpResponse.json(customerMe(customer));
  }),
];
