/**
 * Physical samples (U2.F3, D-253–D-257) for the three zones, from one store:
 * - `store.samples.*`: the customer's samples — asked for from a saved quotation, the sample
 *   quotation to buy, the factory's evidence, the decision (approve / ask for changes / reject) and,
 *   once approved, the bulk order at today's prices with the credit window;
 * - `admin.samples.*`: the queue, quoting a requested sample, the evidence, cancelling, a sample
 *   attached to an order;
 * - `partner.samples.*`: the factory's sample jobs (no customer, no price) and their evidence.
 *
 * The mock does not run payment, the factory job or delivery: seeded samples stand in each state
 * the screens need (requested, quoted, paid, delivered with evidence), and the e2e walks each surface.
 * Amounts are the fake ones CS types in; nothing is computed from them.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { customers as fakeCustomers, orders } from "../admin/commerce";
import { staffPersonaOf, partnerPersonaOf } from "../auth";
import { can } from "../personas";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { addToCart } from "./cart";
import { customerByPersona, customerOf, type CustomerPersona, type MockCustomer } from "./customers";
import { ownerIdOf } from "./owner";
import { findQuote, nextQuoteId, optionIdOf, quotesOf, type StoreQuote } from "./quotes";
import { canPartner } from "../partner/personas";

type Sample = Schemas["SampleDto"];

interface Row {
  sample: Sample;
  persona: CustomerPersona;
  factoryId: string;
  jobNo: string | null;
  buyNetAmount: string | null;
  cancelReason: string | null;
  decisionIp: string | null;
  decisionUserAgent: string | null;
}

const F001 = "00000000-0000-4000-8000-0000000000f1";
const CREDIT_WINDOW_DAYS = 30;
const DAY = 24 * 60;

/** Evidence photos: fake pictures of a box, served as data URLs by the files mock below. */
const photos = new Map<string, string>();
const PHOTO_SVG = (label: string) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#efe7da"/><rect x="90" y="50" width="140" height="150" fill="#c9a57a" stroke="#6b4f2a" stroke-width="3"/><text x="160" y="225" font-size="14" text-anchor="middle" fill="#3a2a14">${label}</text></svg>`,
  ).toString("base64")}`;
function photo(seq: number, label: string): Schemas["SamplePhotoDto"] {
  const id = mockId("smp-photo", seq);
  photos.set(id, PHOTO_SVG(label));
  return { id, sha256: seq.toString(16).padStart(64, "a") };
}

const NO_EVIDENCE: Schemas["SampleEvidenceViewDto"] = {
  basis: null,
  lengthMm: null,
  widthMm: null,
  depthMm: null,
  materialUsed: null,
  photos: [],
  recordedAt: null,
};

const CONFIGURATION = {
  patternId: null,
  l: 120,
  w: 80,
  d: 60,
  basis: "internal",
  material: "อาร์ตการ์ด 350 แกรม (ตัวอย่าง)",
};

let seq = 1;
function sampleOf(over: Partial<Sample> & Pick<Sample, "status" | "kind">): Sample {
  const n = seq++;
  return {
    id: mockId("smp", n),
    approvedProofId: null,
    configuration: CONFIGURATION,
    createdAt: bangkokIso(-12 * DAY),
    credit: null,
    customerNote: null,
    decision: null,
    deliveredAt: null,
    deliveryPostcode: "10110",
    evidence: NO_EVIDENCE,
    leadTimeDays: 5,
    mockupOption: "with_print",
    orderCode: null,
    orderId: null,
    previousSampleId: null,
    productTypeCode: "folding_carton",
    quantity: 1,
    quotation: null,
    sellGrossAmount: null,
    sellNetAmount: null,
    shippedAt: null,
    statusChangedAt: bangkokIso(-1 * DAY),
    validUntil: null,
    ...over,
  } as Sample;
}

const rows: Row[] = [];
const add = (persona: CustomerPersona, sample: Sample, extra: Partial<Row> = {}) =>
  rows.push({
    sample,
    persona,
    factoryId: F001,
    jobNo: null,
    buyNetAmount: null,
    cancelReason: null,
    decisionIp: null,
    decisionUserAgent: null,
    ...extra,
  });

// The founder's samples (a customer the other suites leave alone): one delivered with the factory's
// evidence, one quoted to buy, one asked for and waiting for CS.
add(
  "founder",
  sampleOf({
    kind: "standalone",
    status: "delivered",
    sellGrossAmount: "850.00",
    sellNetAmount: "794.39",
    shippedAt: bangkokIso(-3 * DAY),
    deliveredAt: bangkokIso(-1 * DAY),
    evidence: {
      basis: "internal",
      lengthMm: "120.5",
      widthMm: "80.0",
      depthMm: "59.5",
      materialUsed: "อาร์ตการ์ด 350 แกรม",
      photos: [photo(1, "ด้านหน้า"), photo(2, "ด้านข้าง")],
      recordedAt: bangkokIso(-4 * DAY),
    },
  }),
  { jobNo: "SJ-0001", buyNetAmount: "420.00" },
);
add(
  "founder",
  sampleOf({
    kind: "standalone",
    status: "quoted",
    sellGrossAmount: "850.00",
    sellNetAmount: "794.39",
    validUntil: bangkokIso(10 * DAY),
  }),
);
// A paid sample the factory has to make and record (the partner zone's job).
add(
  "founder",
  sampleOf({ kind: "attached", status: "in_production", orderCode: "PK-2569-S00001", sellGrossAmount: "640.00" }),
  {
    jobNo: "SJ-0002",
    buyNetAmount: "300.00",
  },
);

/** A quotation the customer buys the sample through (cart → checkout), copied from one of theirs. */
function sampleQuotation(
  customer: MockCustomer,
  base: StoreQuote | undefined,
): Schemas["SampleQuotationRefDto"] | null {
  const source = base ?? quotesOf(customer.persona)[0];
  if (!source) return null;
  const { id, quoteCode } = nextQuoteId();
  const copy: StoreQuote = { ...structuredClone(source), id, quoteCode, quantity: 1, status: "saved" };
  quotesOf(customer.persona).unshift(copy);
  return { quoteId: copy.id, optionId: optionIdOf(copy), status: "saved" };
}

// The seeded quoted sample gets its quotation once the founder has one to copy (lazily, on read).
function ensureQuotation(row: Row) {
  if (row.sample.status === "quoted" && !row.sample.quotation) {
    row.sample.quotation = sampleQuotation(customerByPersona(row.persona), undefined);
  }
}

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบตัวอย่างนี้");
const invalidStatus = () => problem(409, "samples.invalid_status", "ตัวอย่างนี้อยู่ในสถานะที่ทำรายการนี้ไม่ได้");
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");

function mine(request: Request, sampleId: unknown): { customer: MockCustomer; row: Row } | Response {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const row = rows.find((r) => r.sample.id === sampleId && r.persona === customer.persona);
  return row ? { customer, row } : notFound();
}

const touch = (row: Row, status: Sample["status"]) => {
  row.sample.status = status;
  row.sample.statusChangedAt = bangkokIso();
};

function toAdmin(row: Row, withBuy: boolean): Schemas["AdminSampleDto"] {
  const customer = customerByPersona(row.persona);
  return {
    ...row.sample,
    buyNetAmount: withBuy ? row.buyNetAmount : null,
    cancelReason: row.cancelReason,
    customerId: ownerIdOf(customer),
    customerName: customer.displayName,
    decisionIp: row.decisionIp,
    decisionUserAgent: row.decisionUserAgent,
    factoryId: row.factoryId,
    jobNo: row.jobNo,
  } as unknown as Schemas["AdminSampleDto"];
}

function toPartner(row: Row): Schemas["PartnerSampleDto"] {
  const { configuration, evidence, id, mockupOption, productTypeCode, quantity, status } = row.sample;
  return {
    configuration,
    evidence,
    id,
    jobNo: row.jobNo,
    mockupOption,
    productionJobId: null,
    productTypeCode,
    quantity,
    status,
  } as Schemas["PartnerSampleDto"];
}

async function bodyOf<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}

function evidenceFrom(
  body: Schemas["SampleEvidenceDto"] | null,
  seqBase: number,
): Schemas["SampleEvidenceViewDto"] | Response {
  if (!body || !body.materialUsed?.trim() || !(body.lengthMm > 0) || !(body.widthMm > 0) || !body.photoFileIds?.length)
    return problem(422, "samples.evidence_missing", "ต้องมีขนาดที่วัดได้ วัสดุที่ใช้ และรูปอย่างน้อย 1 รูป");
  return {
    basis: body.basis,
    lengthMm: body.lengthMm.toFixed(1),
    widthMm: body.widthMm.toFixed(1),
    depthMm: body.depthMm !== undefined ? body.depthMm.toFixed(1) : null,
    materialUsed: body.materialUsed.trim(),
    photos: body.photoFileIds.map((id, i) => ({ id, sha256: (seqBase + i).toString(16).padStart(64, "b") })),
    recordedAt: bangkokIso(),
  };
}

export const sampleHandlers = [
  /* ------------------------------------------------------------------ store (the customer) */
  http.get("*/v1/store/samples", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const list = rows
      .filter((r) => r.persona === customer.persona && (!status || r.sample.status === status))
      .map((r) => (ensureQuotation(r), r.sample))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(paginate(list, { page: Number(url.searchParams.get("page") ?? 1), perPage: 20 }));
  }),

  http.get("*/v1/store/samples/:sampleId", ({ params, request }) => {
    const found = mine(request, params.sampleId);
    if (found instanceof Response) return found;
    ensureQuotation(found.row);
    return HttpResponse.json(found.row.sample);
  }),

  http.post("*/v1/store/samples", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = await bodyOf<Schemas["RequestSampleDto"]>(request);
    if (!body?.mockupOption || (!body.quoteId && !body.draftId))
      return problem(422, "validation.failed", "เลือกใบเสนอราคาหรือแบบร่าง", [
        { path: "quoteId", code: "required", message: "quoteId or draftId" },
      ]);
    const quote = body.quoteId ? findQuote(body.quoteId) : undefined;
    if (body.quoteId && (!quote || !quotesOf(customer.persona).includes(quote)))
      return problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");
    const sample = sampleOf({
      kind: "standalone",
      status: "requested",
      createdAt: bangkokIso(),
      statusChangedAt: bangkokIso(),
      quantity: body.quantity ?? 1,
      mockupOption: body.mockupOption,
      customerNote: body.note?.trim() || null,
      deliveryPostcode: body.deliveryPostcode ?? null,
      leadTimeDays: null,
      productTypeCode: quote?.productType.code ?? "folding_carton",
      configuration: (quote?.configuration as Record<string, unknown> | undefined) ?? CONFIGURATION,
    });
    add(customer.persona, sample);
    return HttpResponse.json(sample, { status: 201 });
  }),

  http.post("*/v1/store/samples/:sampleId/actions/approve", async ({ params, request }) => {
    const found = mine(request, params.sampleId);
    if (found instanceof Response) return found;
    const { row } = found;
    if (row.sample.status !== "delivered") return invalidStatus();
    const body = await bodyOf<Schemas["SampleDecisionDto"]>(request);
    touch(row, "approved");
    row.sample.decision = {
      decidedAt: bangkokIso(),
      note: body?.note?.trim() || null,
      evidencePhotoSha256: row.sample.evidence.photos.flatMap((p) => (p.sha256 ? [p.sha256] : [])),
    };
    row.decisionIp = "203.0.113.10";
    row.decisionUserAgent = request.headers.get("user-agent");
    row.sample.credit = {
      availableUntil: bangkokIso(CREDIT_WINDOW_DAYS * DAY),
      bulkQuoteId: null,
      creditAmount: row.sample.sellNetAmount,
      creditOrderId: null,
    };
    return HttpResponse.json(row.sample);
  }),

  ...(["reject", "request-changes"] as const).map((action) =>
    http.post(`*/v1/store/samples/:sampleId/actions/${action}`, async ({ params, request }) => {
      const found = mine(request, params.sampleId);
      if (found instanceof Response) return found;
      const { row } = found;
      if (row.sample.status !== "delivered") return invalidStatus();
      const body = await bodyOf<Schemas["SampleDecisionDto"]>(request);
      if (!body?.note?.trim())
        return problem(422, "validation.failed", "บอกเหตุผล", [
          { path: "note", code: "required", message: "required" },
        ]);
      touch(row, action === "reject" ? "rejected" : "changes_requested");
      row.sample.decision = { decidedAt: bangkokIso(), note: body.note.trim(), evidencePhotoSha256: [] };
      return HttpResponse.json(row.sample);
    }),
  ),

  http.post("*/v1/store/samples/:sampleId/actions/order-bulk", async ({ params, request }) => {
    const found = mine(request, params.sampleId);
    if (found instanceof Response) return found;
    const { customer, row } = found;
    if (row.sample.status !== "approved") return invalidStatus();
    const body = await bodyOf<Schemas["OrderBulkDto"]>(request);
    if (!body?.quantity || body.quantity < 1)
      return problem(422, "validation.failed", "ระบุจำนวน", [{ path: "quantity", code: "min", message: ">= 1" }]);
    // At today's prices for the quantity: the mock copies the customer's latest quotation.
    const ref = sampleQuotation(customer, undefined);
    if (!ref) return problem(409, "samples.invalid_status", "ยังไม่มีใบเสนอราคาให้สั่งผลิต");
    const quote = findQuote(ref.quoteId)!;
    quote.quantity = body.quantity;
    addToCart(customer, quote);
    if (row.sample.credit) row.sample.credit.bulkQuoteId = ref.quoteId;
    const creditAvailable = !!row.sample.credit?.availableUntil && row.sample.credit.availableUntil > bangkokIso();
    return HttpResponse.json(
      { cartId: mockId("cart", 1), creditAvailable, quoteId: ref.quoteId } satisfies Schemas["OrderBulkResultDto"],
      {
        status: 201,
      },
    );
  }),

  // Evidence photos as data URLs (the fake files above); anything else falls through.
  http.get("*/v1/:surface/files/:fileId/download", ({ params }) => {
    const url = photos.get(String(params.fileId));
    if (!url) return undefined;
    return HttpResponse.json({ url, expiresAt: bangkokIso(5) });
  }),

  /* ------------------------------------------------------------------------ admin (CS) */
  http.get("*/v1/admin/samples", ({ request }) => {
    const persona = staffPersonaOf(request);
    if (!can(persona, "samples.read")) return forbidden();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const kind = url.searchParams.get("kind");
    const list = rows
      .filter((r) => (!status || r.sample.status === status) && (!kind || r.sample.kind === kind))
      .sort((a, b) => b.sample.createdAt.localeCompare(a.sample.createdAt))
      .map((r) => toAdmin(r, can(persona, "factory_buy_prices.read")));
    return HttpResponse.json(paginate(list, { page: Number(url.searchParams.get("page") ?? 1), perPage: 25 }));
  }),

  http.get("*/v1/admin/samples/:sampleId", ({ params, request }) => {
    const persona = staffPersonaOf(request);
    if (!can(persona, "samples.read")) return forbidden();
    const row = rows.find((r) => r.sample.id === params.sampleId);
    return row ? HttpResponse.json(toAdmin(row, can(persona, "factory_buy_prices.read"))) : notFound();
  }),

  http.post("*/v1/admin/samples/:sampleId/actions/quote", async ({ params, request }) => {
    const persona = staffPersonaOf(request);
    if (!can(persona, "samples.manage")) return forbidden();
    const row = rows.find((r) => r.sample.id === params.sampleId);
    if (!row) return notFound();
    if (row.sample.status !== "requested") return invalidStatus();
    const body = await bodyOf<Schemas["QuoteSampleDto"]>(request);
    if (!body?.deliveryPostcode && !row.sample.deliveryPostcode)
      return problem(422, "validation.failed", "ตัวอย่างนี้ยังไม่มีรหัสไปรษณีย์ปลายทาง", [
        { path: "deliveryPostcode", code: "required", message: "the sample has no delivery postcode" },
      ]);
    if (!body?.serviceItemId || !(body.leadTimeDays > 0) || !(body.parcelWeightG > 0))
      return problem(422, "validation.failed", "กรอกบริการ ระยะเวลา และน้ำหนักพัสดุ", [
        { path: "serviceItemId", code: "required", message: "required" },
      ]);
    const amount = body.unitAmount ?? (body.amount !== undefined ? body.amount.toFixed(2) : null);
    if (!amount)
      return problem(422, "validation.failed", "กรอกจำนวนเงิน", [
        { path: "amount", code: "required", message: "required" },
      ]);
    // The fake price CS typed in, as gross; the mock does not price VAT or freight.
    row.sample.sellGrossAmount = amount;
    row.sample.sellNetAmount = amount;
    row.sample.leadTimeDays = body.leadTimeDays;
    if (body.deliveryPostcode) row.sample.deliveryPostcode = body.deliveryPostcode;
    row.sample.validUntil = bangkokIso(15 * DAY);
    row.sample.quotation = sampleQuotation(customerByPersona(row.persona), undefined);
    touch(row, "quoted");
    return HttpResponse.json(toAdmin(row, can(persona, "factory_buy_prices.read")));
  }),

  http.post("*/v1/admin/samples/:sampleId/evidence", async ({ params, request }) => {
    const persona = staffPersonaOf(request);
    if (!can(persona, "samples.manage")) return forbidden();
    const row = rows.find((r) => r.sample.id === params.sampleId);
    if (!row) return notFound();
    if (row.sample.evidence.recordedAt)
      return problem(409, "samples.evidence_recorded", "บันทึกหลักฐานของตัวอย่างนี้แล้ว");
    if (!["paid", "in_production"].includes(row.sample.status)) return invalidStatus();
    const evidence = evidenceFrom(await bodyOf<Schemas["SampleEvidenceDto"]>(request), 100);
    if (evidence instanceof Response) return evidence;
    row.sample.evidence = evidence;
    return HttpResponse.json(toAdmin(row, can(persona, "factory_buy_prices.read")));
  }),

  http.post("*/v1/admin/samples/:sampleId/actions/cancel", async ({ params, request }) => {
    const persona = staffPersonaOf(request);
    if (!can(persona, "samples.manage")) return forbidden();
    const row = rows.find((r) => r.sample.id === params.sampleId);
    if (!row) return notFound();
    if (["approved", "rejected", "cancelled", "expired"].includes(row.sample.status)) return invalidStatus();
    const body = await bodyOf<Schemas["ReasonBodyDto"]>(request);
    if (!body?.reason?.trim())
      return problem(422, "validation.failed", "บอกเหตุผล", [
        { path: "reason", code: "required", message: "required" },
      ]);
    row.cancelReason = body.reason.trim();
    touch(row, "cancelled");
    return HttpResponse.json(toAdmin(row, can(persona, "factory_buy_prices.read")));
  }),

  http.post("*/v1/admin/orders/:orderId/samples", async ({ params, request }) => {
    const persona = staffPersonaOf(request);
    if (!can(persona, "samples.manage")) return forbidden();
    const order = orders.find((o) => o.id === params.orderId);
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    if (
      rows.some(
        (r) =>
          r.sample.orderId === order.id && !["approved", "rejected", "cancelled", "expired"].includes(r.sample.status),
      )
    )
      return problem(409, "samples.exists", "คำสั่งซื้อนี้มีตัวอย่างที่กำลังดำเนินการอยู่");
    const body = await bodyOf<Schemas["CreateAttachedSampleDto"]>(request);
    if (!body?.reason?.trim() || !body.serviceItemId)
      return problem(422, "validation.failed", "กรอกเหตุผลและบริการ", [
        { path: "reason", code: "required", message: "required" },
      ]);
    const amount = body.unitAmount ?? (body.amount !== undefined ? body.amount.toFixed(2) : "0.00");
    const owner = fakeCustomers.find((c) => c.id === order.customer.id);
    const owning = (["returning", "buyer", "artist", "receiver", "designer", "founder"] as CustomerPersona[]).find(
      (p) => ownerIdOf(customerByPersona(p)) === owner?.id,
    );
    const sample = sampleOf({
      kind: "attached",
      status: "quoted",
      orderId: order.id,
      orderCode: order.orderCode,
      mockupOption: body.mockupOption,
      quantity: body.quantity ?? 1,
      sellGrossAmount: amount,
      sellNetAmount: amount,
      previousSampleId: body.previousSampleId ?? null,
      customerNote: null,
    });
    add(owning ?? "returning", sample);
    return HttpResponse.json(toAdmin(rows.at(-1)!, can(staffPersonaOf(request), "factory_buy_prices.read")), {
      status: 201,
    });
  }),

  /* -------------------------------------------------------------------- partner (factory) */
  http.get("*/v1/partner/factories/:factoryId/samples", ({ params, request }) => {
    const who = partnerPersonaOf(request);
    if (!who) return unauthenticated();
    if (who.factoryId !== params.factoryId) return problem(404, "partners.factory_not_found", "ไม่พบโรงงานนี้");
    if (!canPartner(who, "factory_jobs.read")) return forbidden();
    const list = rows
      .filter(
        (r) =>
          r.factoryId === params.factoryId &&
          !["requested", "quoted", "cancelled", "expired"].includes(r.sample.status),
      )
      .map(toPartner);
    return HttpResponse.json(paginate(list, { page: 1, perPage: 50 }));
  }),

  http.post("*/v1/partner/factories/:factoryId/samples/:sampleId/evidence", async ({ params, request }) => {
    const who = partnerPersonaOf(request);
    if (!who) return unauthenticated();
    if (who.factoryId !== params.factoryId) return problem(404, "partners.factory_not_found", "ไม่พบโรงงานนี้");
    if (!canPartner(who, "factory_samples.record_evidence")) return forbidden();
    const row = rows.find((r) => r.sample.id === params.sampleId && r.factoryId === params.factoryId);
    if (!row) return notFound();
    if (row.sample.evidence.recordedAt)
      return problem(409, "samples.evidence_recorded", "บันทึกหลักฐานของตัวอย่างนี้แล้ว");
    if (!["paid", "in_production"].includes(row.sample.status)) return invalidStatus();
    const evidence = evidenceFrom(await bodyOf<Schemas["SampleEvidenceDto"]>(request), 200);
    if (evidence instanceof Response) return evidence;
    row.sample.evidence = evidence;
    return HttpResponse.json(toPartner(row));
  }),
];
