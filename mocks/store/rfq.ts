/**
 * Requests for quotation from the storefront, mocked (CONTRACT-REQUEST store.rfq-forms,
 * store.rfqs).
 *
 * The customer's RFQs are the **same rows** the RFQ desk works on (`../admin/rfq.ts`): what a
 * customer submits here lands in the desk's "new" queue, the quote CS sends there shows here,
 * and accepting it here is what the desk's "record acceptance" does — so the whole loop can be
 * walked across the two zones. The returning customer owns the first fake customer's RFQs.
 */

import type { z } from "zod";

import type { rfqDetail } from "@/lib/api/requests/admin-rfq";
import type { storeRfq, storeRfqForm } from "@/lib/api/requests/store-rfq";

import { PRODUCT_TYPES } from "../admin/catalog";
import { customers as fakeCustomers } from "../admin/commerce";
import { addCustomerRfq, customerAcceptQuote, rfqMessages, rfqs } from "../admin/rfq";
import { mockRequest } from "../route";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { customerOf, type MockCustomer } from "./customers";
import { nextQuoteId, quotesOf, QUOTE_VALIDITY_DAYS, type StoreQuote } from "./quotes";

type AdminRfq = z.output<typeof rfqDetail>;
type Form = z.output<typeof storeRfqForm>;
type Field = Form["fields"][number];

const english = (request: Request) => request.headers.get("accept-language")?.startsWith("en") ?? false;
const DAY = 24 * 60;

/* ------------------------------------------------------------------------------------- forms */

const text = (key: string, labelTh: string, labelEn: string, extra: Partial<Field> = {}): Field => ({
  key,
  type: "text",
  labelTh,
  labelEn,
  helpTh: null,
  helpEn: null,
  unit: null,
  required: false,
  min: null,
  max: null,
  options: [],
  ...extra,
});
const choice = (
  key: string,
  labelTh: string,
  labelEn: string,
  values: [string, string, string][],
  extra: Partial<Field> = {},
) =>
  text(key, labelTh, labelEn, {
    type: "select",
    options: values.map(([value, th, en]) => ({ value, labelTh: th, labelEn: en })),
    ...extra,
  });

/** Typed fields for each RFQ category — what the API renders from `rfqSpecSchema` (B2.5). */
const FIELDS: Record<string, Field[]> = {
  rigid_box: [
    choice(
      "closure",
      "รูปแบบการปิด",
      "Closure",
      [
        ["lid", "ฝาครอบ", "Lift-off lid"],
        ["magnetic", "ฝาแม่เหล็ก", "Magnetic flap"],
        ["drawer", "ลิ้นชัก", "Drawer"],
        ["book", "ทรงหนังสือ", "Book style"],
      ],
      { required: true },
    ),
    choice("boardThickness", "ความหนาจั่วปัง", "Board thickness", [
      ["1.5", "1.5 มม.", "1.5 mm"],
      ["2", "2 มม.", "2 mm"],
      ["2.5", "2.5 มม.", "2.5 mm"],
    ]),
    text("wrapPaper", "กระดาษหุ้ม", "Wrapping paper", {
      helpTh: "เช่น อาร์ตเปเปอร์พิมพ์ 4 สี หรือกระดาษสีพิเศษ",
      helpEn: "e.g. printed art paper or a speciality paper",
    }),
    { ...text("insert", "ถาดรองด้านใน", "Insert"), type: "boolean" },
  ],
  paper_bag: [
    choice(
      "paper",
      "กระดาษ",
      "Paper",
      [
        ["kraft", "คราฟท์น้ำตาล", "Brown kraft"],
        ["white-kraft", "คราฟท์ขาว", "White kraft"],
        ["art", "อาร์ตการ์ด", "Art card"],
      ],
      { required: true },
    ),
    choice("handle", "หูหิ้ว", "Handle", [
      ["twisted", "เชือกกระดาษบิด", "Twisted paper"],
      ["flat", "หูแบน", "Flat paper"],
      ["ribbon", "ริบบิ้น", "Ribbon"],
    ]),
    { ...text("gusset", "ความกว้างข้าง", "Gusset"), type: "number", unit: "mm", min: 30, max: 300 },
  ],
  food_packaging: [
    text("material", "วัสดุ", "Material", { required: true }),
    { ...text("foodContact", "สัมผัสอาหารโดยตรง", "Direct food contact"), type: "boolean" },
    text("coating", "การเคลือบกันซึม", "Grease or water barrier"),
  ],
  tube: [
    {
      ...text("diameter", "เส้นผ่านศูนย์กลาง", "Diameter"),
      type: "number",
      unit: "mm",
      required: true,
      min: 20,
      max: 200,
    },
    choice("lid", "ฝา", "Lid", [
      ["paper", "ฝากระดาษ", "Paper lid"],
      ["metal", "ฝาโลหะ", "Metal lid"],
    ]),
  ],
  custom_tape: [
    {
      ...text("tapeWidth", "หน้ากว้างเทป", "Tape width"),
      type: "number",
      unit: "mm",
      required: true,
      min: 12,
      max: 100,
    },
    { ...text("rollLength", "ความยาวต่อม้วน", "Length per roll"), type: "number", unit: "m", min: 10, max: 500 },
    { ...text("colours", "จำนวนสี", "Colours"), type: "number", min: 1, max: 4 },
  ],
  pop_display: [
    choice(
      "displayType",
      "รูปแบบชั้นวาง",
      "Display type",
      [
        ["floor", "ตั้งพื้น", "Floor stand"],
        ["counter", "ตั้งโต๊ะ", "Counter top"],
        ["dump-bin", "กระบะ", "Dump bin"],
      ],
      { required: true },
    ),
    { ...text("shelves", "จำนวนชั้น", "Shelves"), type: "number", min: 1, max: 8 },
    { ...text("loadKg", "น้ำหนักรับได้", "Load"), type: "number", unit: "kg", min: 1, max: 100 },
  ],
  other: [
    { ...text("description", "รายละเอียดบรรจุภัณฑ์", "Describe the packaging"), type: "textarea", required: true },
  ],
};

/** Every type may be asked for by RFQ — an instant one when its configurator cannot price the spec (D-043). */
function formOf(code: string): Form | null {
  const type = PRODUCT_TYPES.find((candidate) => candidate.code === code);
  if (!type) return null;
  const fields = FIELDS[code] ?? [
    { ...text("description", "รายละเอียดสเปก", "Describe the spec"), type: "textarea" as const, required: true },
  ];
  return {
    productTypeCode: type.code,
    nameTh: type.nameTh,
    nameEn: type.nameEn,
    specSchemaVersion: 1,
    fields,
    dimensions: {
      asked: code !== "custom_tape",
      required: ["rigid_box", "paper_bag"].includes(code),
      height: code !== "custom_tape",
    },
    quantity: { min: 100, maxTiers: 4 },
    files: { accept: ".pdf,.ai,.psd,.png,.jpg,.jpeg,.zip", maxBytes: 50 * 1024 * 1024, maxFiles: 10 },
    slaTargetHours: ["rigid_box", "pop_display"].includes(code) ? 16 : 8,
  };
}

/* ---------------------------------------------------------------------------------- the rfqs */

/** Which fake commerce customer a store persona is (the same mapping as their orders). */
function ownerOf(customer: MockCustomer) {
  const owner = customer.persona === "returning" ? fakeCustomers[0] : undefined;
  return owner
    ? { id: owner.id, customerCode: owner.customerCode, displayName: owner.displayName, companyName: owner.companyName }
    : { id: customer.id, customerCode: "C-NEW", displayName: customer.displayName, companyName: null };
}

const mine = (customer: MockCustomer) => rfqs.filter((rfq) => rfq.customer.id === ownerOf(customer).id);

function storeView(rfq: AdminRfq): z.output<typeof storeRfq> {
  const sent = rfq.quotes.filter((quote) => quote.status !== "draft");
  const latest = sent[0] ?? null;
  const sentQuote = sent.find((quote) => quote.status === "sent");
  return {
    id: rfq.id,
    rfqCode: rfq.rfqCode,
    status: rfq.status,
    productType: rfq.productType,
    quantities: rfq.quantities,
    targetDate: rfq.targetDate,
    respondBy: rfq.firstResponseAt ? null : rfq.slaDueAt,
    latestQuote: latest ? { versionNo: latest.versionNo, status: latest.status, validUntil: latest.validUntil } : null,
    submittedAt: rfq.submittedAt,
    spec: rfq.spec,
    dimensions: rfq.dimensions,
    deliveryPostcode: rfq.deliveryPostcode,
    notes: rfq.notes,
    files: rfq.files,
    quotes: sent.map((quote) => ({
      id: quote.id,
      versionNo: quote.versionNo,
      status: quote.status,
      validUntil: quote.validUntil,
      customerNote: quote.customerNote,
      lines: quote.lines.map((line) => ({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        netAmount: line.netAmount,
        vatAmount: line.vatAmount,
        grossAmount: line.grossAmount,
        leadTimeDays: line.leadTimeDays,
      })),
      sentAt: quote.sentAt,
      acceptedAt: quote.acceptedAt,
    })),
    acceptedQuote: rfq.acceptedQuotation
      ? {
          id: rfq.acceptedQuotation.id,
          quoteCode: rfq.acceptedQuotation.quoteCode,
          quantity: rfq.acceptedQuotation.quantity,
        }
      : null,
    declineReason: rfq.declineReason?.name ?? null,
    nextActions: [
      ...(rfq.status === "quoted" && sentQuote ? [{ key: "rfq.accept_quote", irreversible: true }] : []),
      ...(rfq.status === "need_info" ? [{ key: "rfq.reply" }] : []),
      ...(rfq.acceptedQuotation ? [{ key: "quote.add_to_cart" }] : []),
    ],
  };
}

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "rfq.not_found", "ไม่พบคำขอราคานี้");

let submitted = 0;

export const storeRfqHandlers = [
  // CONTRACT-REQUEST store.rfq-forms
  mockRequest(
    "GET /v1/store/rfq-forms/{productTypeCode}",
    ({ params }) => formOf(params.productTypeCode) ?? notFound(),
  ),

  // CONTRACT-REQUEST store.rfqs
  mockRequest("POST /v1/store/rfqs", ({ body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const form = formOf(body.productTypeCode);
    if (!form) return problem(422, "validation.failed", "ไม่พบประเภทสินค้านี้");
    const missing = form.fields.find(
      (field) => field.required && (body.spec[field.key] === undefined || body.spec[field.key] === ""),
    );
    if (missing)
      return problem(422, "validation.failed", "กรุณากรอกข้อมูลที่จำเป็น", [
        { path: `spec.${missing.key}`, code: "required", message: "required" },
      ]);
    const en = english(request);
    const labelOf = (key: string) => {
      const field = form.fields.find((candidate) => candidate.key === key);
      return field ? (en ? field.labelEn : field.labelTh) : key;
    };
    const valueOf = (key: string, value: unknown) => {
      const field = form.fields.find((candidate) => candidate.key === key);
      const values = [value].flat().map((item) => {
        const hit = field?.options.find((candidate) => candidate.value === String(item));
        if (hit) return en ? hit.labelEn : hit.labelTh;
        if (typeof item === "boolean") return item ? (en ? "Yes" : "ใช่") : en ? "No" : "ไม่";
        return `${String(item)}${field?.unit ? ` ${field.unit}` : ""}`;
      });
      return values.join(", ");
    };
    submitted += 1;
    const n = 900 + submitted;
    const owner = ownerOf(customer);
    const now = bangkokIso();
    const rfq: AdminRfq = {
      id: mockId("rfq", n),
      rfqCode: `RFQ-2569-${String(n).padStart(5, "0")}`,
      channel: "web",
      status: "submitted",
      productType: { code: form.productTypeCode, name: form.nameTh },
      customer: owner,
      quantities: [...body.quantities].sort((a, b) => a - b),
      dimensions: body.dimensions
        ? {
            lengthMm: body.dimensions.lengthMm,
            widthMm: body.dimensions.widthMm,
            heightMm: body.dimensions.heightMm ?? null,
          }
        : null,
      targetDate: body.targetDate ?? null,
      province: null,
      assignee: null,
      slaTargetHours: form.slaTargetHours,
      slaDueAt: bangkokIso(form.slaTargetHours * 60),
      firstResponseAt: null,
      urgency: "normal",
      consultationCounts: { requested: 0, responded: 0 },
      latestQuote: null,
      routedFromCalculator: Boolean(body.routedFrom),
      submittedAt: now,
      contact: { phone: customer.phone, email: customer.email },
      spec: Object.entries(body.spec).map(([key, value]) => ({ label: labelOf(key), value: valueOf(key, value) })),
      specSchemaVersion: body.specSchemaVersion,
      notes: body.notes ?? null,
      deliveryPostcode: body.deliveryPostcode,
      files: body.fileIds.map((id, index) => ({
        id,
        originalName: `file-${index + 1}`,
        mimeType: "application/octet-stream",
        sizeBytes: 0,
        thumbnailUrl: null,
        url: null,
      })),
      routedFrom: body.routedFrom ? { reason: body.routedFrom.reason, calculator: null } : null,
      declineReason: null,
      declineNote: null,
      acceptedQuotation: null,
      consultations: [],
      quotes: [],
      quoteDefaults: { validUntil: bangkokIso(QUOTE_VALIDITY_DAYS * DAY).slice(0, 10) },
      events: [],
      nextActions: [],
    };
    return storeView(addCustomerRfq(rfq));
  }),

  mockRequest("GET /v1/store/rfqs", ({ query, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const list = mine(customer)
      .filter((rfq) => !query.status || rfq.status === query.status)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map(storeView)
      .map(({ id, rfqCode, status, productType, quantities, targetDate, respondBy, latestQuote, submittedAt }) => ({
        id,
        rfqCode,
        status,
        productType,
        quantities,
        targetDate,
        respondBy,
        latestQuote,
        submittedAt,
      }));
    return paginate(list, query);
  }),

  mockRequest("GET /v1/store/rfqs/{rfqId}", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const rfq = mine(customer).find((candidate) => candidate.id === params.rfqId);
    return rfq ? storeView(rfq) : notFound();
  }),

  mockRequest("GET /v1/store/rfqs/{rfqId}/messages", ({ params, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const rfq = mine(customer).find((candidate) => candidate.id === params.rfqId);
    if (!rfq) return notFound();
    return {
      data: (rfqMessages.get(rfq.id) ?? [])
        .filter((message) => message.visibility === "customer")
        .map((message) => ({
          id: message.id,
          authorKind: message.authorKind,
          authorName: message.authorKind === "staff" ? "ทีม Packio" : customer.displayName,
          body: message.body,
          files: message.files,
          createdAt: message.createdAt,
        })),
    };
  }),

  mockRequest("POST /v1/store/rfqs/{rfqId}/messages", ({ params, body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const rfq = mine(customer).find((candidate) => candidate.id === params.rfqId);
    if (!rfq) return notFound();
    const message = {
      id: mockId("rms", 8000 + (rfqMessages.get(rfq.id)?.length ?? 0) + Math.floor(Math.random() * 900)),
      authorKind: "customer" as const,
      author: null,
      visibility: "customer" as const,
      body: body.body,
      files: [],
      createdAt: bangkokIso(),
    };
    rfqMessages.set(rfq.id, [...(rfqMessages.get(rfq.id) ?? []), message]);
    // Answering a request for information puts the RFQ back in front of CS (B2.5).
    if (rfq.status === "need_info") rfq.status = "in_review";
    return {
      id: message.id,
      authorKind: "customer",
      authorName: customer.displayName,
      body: message.body,
      files: [],
      createdAt: message.createdAt,
    };
  }),

  mockRequest("POST /v1/store/rfqs/{rfqId}/quotes/{quoteId}/actions/accept", ({ params, body, request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const rfq = mine(customer).find((candidate) => candidate.id === params.rfqId);
    if (!rfq) return notFound();
    const accepted = customerAcceptQuote(rfq, params.quoteId, body.quantity);
    if (accepted instanceof Response) return accepted;
    const { line } = accepted;
    const net = line.netAmount;
    const en = english(request);
    const quote: StoreQuote = {
      ...nextQuoteId(),
      status: "saved",
      productType: rfq.productType,
      product: { slug: rfq.productType.code, name: rfq.productType.name, imageUrl: null },
      specs: rfq.spec,
      quantity: line.quantity,
      unit: en ? "pcs" : "ชิ้น",
      lines: [
        {
          lineType: "product",
          description: `${rfq.productType.name} ${line.quantity.toLocaleString("th-TH")} ชิ้น (${rfq.rfqCode})`,
          quantity: `${line.quantity}.000`,
          unit: "ชิ้น",
          unitPrice: line.unitPrice,
          netAmount: net,
          vatAmount: line.vatAmount,
          grossAmount: line.grossAmount,
          oneOff: false,
          waivedReason: null,
        },
      ],
      unitPrice: line.unitPrice,
      netAmount: net,
      discountAmount: "0.00",
      shippingAmount: "0.00",
      vatAmount: line.vatAmount,
      grossAmount: line.grossAmount,
      currency: "THB",
      promotion: null,
      designOption: "own_file",
      mockupOption: "none",
      leadTimeDays: line.leadTimeDays,
      earliestShipDate: bangkokIso(Math.round(line.leadTimeDays * 1.4) * DAY).slice(0, 10),
      estimatedDeliveryDate: null,
      deliveryPostcode: rfq.deliveryPostcode,
      tolerance: { shortagePct: "5.0000", overagePct: "5.0000" },
      validUntil: `${rfq.quotes.find((item) => item.id === params.quoteId)!.validUntil}T23:59:59+07:00`,
      configuration: { rfqId: rfq.id },
      source: "rfq",
      nextActions: [{ key: "quote.add_to_cart" }, { key: "quote.export_pdf" }],
      createdAt: bangkokIso(),
    };
    // The admin desk's quotation and the customer's are the same record in the API.
    quote.id = accepted.id;
    quote.quoteCode = accepted.quoteCode;
    quotesOf(customer.persona).unshift(quote);
    return { rfq: storeView(rfq), quote };
  }),
];
