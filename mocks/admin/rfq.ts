/**
 * The RFQ desk, mocked (CONTRACT-REQUEST admin.rfqs, admin.rfq-messages, admin.rfq-actions,
 * admin.rfq-consultations, admin.rfq-quotes, admin.unmet-demand-reasons).
 *
 * State moves the way B2.5 describes: `submitted → in_review → need_info → quoted → accepted |
 * declined | expired`. A factory's answer arrives as a buy price per quantity; the mock derives
 * the suggested sell price from it with a flat mark-up standing in for the sell-margin table,
 * and computes line amounts in whole satang — standing in for the backend, the only place money
 * is computed. Cost and margin leave per D-141, decided per actor in `forActor`.
 */

import type { z } from "zod";

import type {
  candidateFactory,
  consultation,
  rfqDetail,
  rfqMessage,
  rfqQuote,
  rfqQuoteLine,
} from "@/lib/api/requests/admin-rfq";
import { rfqSummary } from "@/lib/api/requests/admin-rfq";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";
import { productTypeRef } from "./catalog";
import { baht, customers, FACTORY } from "./commerce";
import { indexForSearch, registerQueue } from "./console";
import { PARTICIPATION } from "./partners";
import { settings } from "./platform";
import { quotations } from "./sales";

type Rfq = z.output<typeof rfqDetail>;
type Consultation = z.output<typeof consultation>;
type Quote = z.output<typeof rfqQuote>;
type QuoteLine = z.output<typeof rfqQuoteLine>;
type Message = z.output<typeof rfqMessage>;
type Candidate = z.output<typeof candidateFactory>;

const HOUR = 60;
const DAY = 24 * HOUR;
const day = (minutes: number) => bangkokIso(minutes).slice(0, 10);

/* ------------------------------------------------------------------------------- reference */

export const FACTORIES = [
  FACTORY,
  { id: mockId("fac", 2), code: "F002", name: "โรงงานกล่องแข็ง ตัวอย่าง (ข้อมูลจำลอง)" },
  { id: mockId("fac", 3), code: "F003", name: "โรงงานบรรจุภัณฑ์อาหาร ตัวอย่าง (ข้อมูลจำลอง)" },
  { id: mockId("fac", 4), code: "F004", name: "โรงงานสิ่งพิมพ์ ตัวอย่าง (ข้อมูลจำลอง)" },
];

const ON_TIME: Record<string, string> = {
  [FACTORIES[0]!.id]: "96.5000",
  [FACTORIES[1]!.id]: "91.0000",
  [FACTORIES[2]!.id]: "88.2500",
  [FACTORIES[3]!.id]: "93.7500",
};

const SLA_HOURS: Record<string, number> = {
  rigid_box: 8,
  paper_bag: 8,
  food_packaging: 16,
  tube: 16,
  custom_tape: 8,
  pop_display: 24,
  other: 24,
  folding_carton: 8,
};

export const UNMET_REASONS = [
  { code: "capability_missing", name: "ไม่มีโรงงานที่ผลิตได้" },
  { code: "capacity_full", name: "กำลังการผลิตเต็มในช่วงที่ต้องการ" },
  { code: "price_not_competitive", name: "ราคาสู้ไม่ได้" },
  { code: "spec_not_feasible", name: "สเปกผลิตไม่ได้ในทางเทคนิค" },
  { code: "customer_no_response", name: "ลูกค้าไม่ตอบกลับ" },
  { code: "expired", name: "หมดอายุ" },
];

const persona = (key: string) => PERSONAS.find((candidate) => candidate.key === key)!;
const refOf = (who: StaffPersona) => ({ id: who.id, displayName: who.displayName });
const CS = persona("cs");
const CS_LEAD = persona("cs_lead");

function numberSetting(key: string, fallback: number): number {
  const value = settings.find((candidate) => candidate.key === key)?.current?.value;
  return Number(typeof value === "string" || typeof value === "number" ? value : fallback);
}

/* ------------------------------------------------------------------------------------ money */

/** Stands in for the sell-margin table: suggested sell = buy × 1.30, to the satang. */
const suggestedFrom = (buy: string) => (Math.round(Number(buy) * 130) / 100).toFixed(6);

function priceLine(
  input: { quantity: number; unitPrice: string; leadTimeDays: number; consultationId?: string | null },
  rfq: Rfq,
): QuoteLine {
  const net = Math.round(Number(input.unitPrice) * input.quantity * 100);
  const vat = Math.round(net * 0.07);
  const source = rfq.consultations.find((item) => item.id === input.consultationId);
  const tier = source?.response?.tiers.find((item) => item.quantity === input.quantity);
  const buy = tier?.buyUnitPrice;
  const margin = buy ? ((Number(input.unitPrice) - Number(buy)) / Number(input.unitPrice)) * 100 : null;
  return {
    quantity: input.quantity,
    unitPrice: Number(input.unitPrice).toFixed(6),
    netAmount: baht(net),
    vatAmount: baht(vat),
    grossAmount: baht(net + vat),
    leadTimeDays: input.leadTimeDays,
    suggestedUnitPrice: tier?.suggestedUnitPrice ?? null,
    consultationId: source?.id ?? null,
    factory: source?.factory ?? null,
    ...(buy ? { buyUnitPrice: buy } : {}),
    ...(margin !== null ? { marginPct: margin.toFixed(4) } : {}),
    belowMarginFloor: margin !== null && margin < numberSetting("pricing.margin_floor_pct", 10),
  };
}

/* ------------------------------------------------------------------------------------- seed */

type Seed = {
  type: string;
  status: Rfq["status"];
  customer: number;
  quantities: number[];
  size?: [number, number, number];
  submittedHoursAgo: number;
  assignee?: StaffPersona;
  channel?: Rfq["channel"];
  routed?: boolean;
  /** Buy price per unit at the first quantity, per consulted factory; `null` = still waiting. */
  consult?: { factory: number; buy: string | null; lead?: number }[];
  quotes?: { status: Quote["status"]; validDays: number; markup?: number }[];
  declined?: string;
  spec: [string, string][];
  notes?: string;
};

const SEEDS: Seed[] = [
  {
    type: "rigid_box",
    status: "submitted",
    customer: 2,
    quantities: [500, 1000],
    size: [200, 150, 60],
    submittedHoursAgo: 2,
    spec: [
      ["ความหนาจั่วปัง", "2 มม."],
      ["กระดาษหุ้ม", "อาร์ตเปเปอร์ 157 แกรม พิมพ์ 4 สี"],
      ["รูปแบบการปิด", "ฝาครอบ"],
      ["ถาดรองด้านใน", "โฟม EVA ตามรูปสินค้า"],
    ],
    notes: "กล่องใส่เซรั่ม 3 ขวด ต้องการฟอยล์ทองที่โลโก้",
  },
  {
    type: "paper_bag",
    status: "submitted",
    customer: 4,
    quantities: [1000, 3000],
    size: [250, 100, 320],
    submittedHoursAgo: 10,
    spec: [
      ["กระดาษ", "คราฟท์น้ำตาล 120 แกรม"],
      ["หูหิ้ว", "เชือกกระดาษบิด"],
      ["ความกว้างข้าง", "100 มม."],
    ],
  },
  {
    type: "folding_carton",
    status: "submitted",
    customer: 5,
    quantities: [20000],
    size: [95, 95, 320],
    submittedHoursAgo: 1,
    routed: true,
    spec: [
      ["รูปแบบ", "กล่องฝาเสียบ (RTE)"],
      ["วัสดุ", "กล่องแป้งหลังขาว 400 แกรม"],
      ["พิเศษ", "เคลือบสัมผัสนุ่ม + ปั๊มนูน"],
    ],
    notes: "ขนาดสูงเกินกว่าที่เครื่องคำนวณรองรับ",
  },
  {
    type: "food_packaging",
    status: "in_review",
    customer: 7,
    quantities: [5000, 10000],
    size: [180, 120, 50],
    submittedHoursAgo: 6,
    assignee: CS,
    consult: [
      { factory: 3, buy: null },
      { factory: 1, buy: null },
    ],
    spec: [
      ["วัสดุ", "กระดาษฟู้ดเกรด 350 แกรม"],
      ["สัมผัสอาหารโดยตรง", "ใช่"],
      ["การเคลือบกันซึม", "PE ด้านใน"],
    ],
  },
  {
    type: "tube",
    status: "in_review",
    customer: 10,
    quantities: [1000],
    size: [70, 70, 180],
    submittedHoursAgo: 9,
    assignee: CS,
    consult: [
      { factory: 2, buy: "18.40", lead: 18 },
      { factory: 3, buy: null },
    ],
    spec: [
      ["เส้นผ่านศูนย์กลาง", "70 มม."],
      ["ฝา", "ฝาครอบกระดาษ พิมพ์โลโก้"],
    ],
  },
  {
    type: "rigid_box",
    status: "in_review",
    customer: 1,
    quantities: [300, 500, 1000],
    size: [240, 180, 80],
    submittedHoursAgo: 5,
    assignee: CS,
    consult: [
      { factory: 2, buy: "42.00", lead: 20 },
      { factory: 4, buy: "39.50", lead: 25 },
    ],
    spec: [
      ["ความหนาจั่วปัง", "2.5 มม."],
      ["กระดาษหุ้ม", "กระดาษแฟนซีสีดำ ปั๊มฟอยล์เงิน"],
      ["รูปแบบการปิด", "แม่เหล็ก"],
      ["ถาดรองด้านใน", "กระดาษจั่วปังหุ้มกำมะหยี่"],
    ],
    notes: "กล่องของขวัญปีใหม่ ต้องการส่งภายในกลางเดือนพฤศจิกายน",
  },
  {
    type: "custom_tape",
    status: "need_info",
    customer: 3,
    quantities: [200],
    submittedHoursAgo: 30,
    assignee: CS,
    spec: [
      ["หน้ากว้างเทป", "48 มม."],
      ["ความยาวต่อม้วน", "100 หลา"],
      ["จำนวนสี", "ยังไม่ระบุ"],
    ],
  },
  {
    type: "pop_display",
    status: "quoted",
    customer: 5,
    quantities: [20, 50],
    size: [400, 300, 1500],
    submittedHoursAgo: 60,
    assignee: CS,
    consult: [{ factory: 1, buy: "850.00", lead: 21 }],
    quotes: [{ status: "sent", validDays: 12 }],
    spec: [
      ["รูปแบบชั้นวาง", "ตั้งพื้น 4 ชั้น"],
      ["จำนวนชั้น", "4"],
      ["น้ำหนักรับได้", "5 กก. ต่อชั้น"],
    ],
  },
  {
    type: "paper_bag",
    status: "quoted",
    customer: 8,
    quantities: [2000, 5000],
    size: [300, 120, 400],
    submittedHoursAgo: 80,
    assignee: CS_LEAD,
    consult: [{ factory: 2, buy: "7.20", lead: 14 }],
    quotes: [
      { status: "superseded", validDays: 5, markup: 1.4 },
      { status: "sent", validDays: 13 },
    ],
    spec: [
      ["กระดาษ", "อาร์ตการ์ด 230 แกรม เคลือบด้าน"],
      ["หูหิ้ว", "เชือกริบบิ้น"],
      ["ความกว้างข้าง", "120 มม."],
    ],
  },
  {
    type: "rigid_box",
    status: "accepted",
    customer: 6,
    quantities: [1000],
    size: [150, 150, 50],
    submittedHoursAgo: 200,
    assignee: CS,
    consult: [{ factory: 2, buy: "28.00", lead: 20 }],
    quotes: [{ status: "accepted", validDays: 9 }],
    spec: [
      ["ความหนาจั่วปัง", "2 มม."],
      ["กระดาษหุ้ม", "อาร์ตเปเปอร์ 157 แกรม"],
      ["รูปแบบการปิด", "ฝาครอบ"],
    ],
  },
  {
    type: "other",
    status: "declined",
    customer: 9,
    quantities: [100],
    submittedHoursAgo: 150,
    assignee: CS,
    declined: "capability_missing",
    spec: [["รายละเอียด", "กล่องอะคริลิกใสพิมพ์ UV"]],
  },
  {
    type: "tube",
    status: "expired",
    customer: 11,
    quantities: [500],
    submittedHoursAgo: 500,
    assignee: CS_LEAD,
    consult: [{ factory: 2, buy: "16.00", lead: 18 }],
    quotes: [{ status: "expired", validDays: -3 }],
    spec: [
      ["เส้นผ่านศูนย์กลาง", "60 มม."],
      ["ฝา", "ฝาโลหะ"],
    ],
  },
  {
    type: "food_packaging",
    status: "in_review",
    customer: 0,
    quantities: [3000],
    submittedHoursAgo: 4,
    assignee: CS_LEAD,
    spec: [
      ["วัสดุ", "กระดาษคราฟท์ฟู้ดเกรด"],
      ["สัมผัสอาหารโดยตรง", "ใช่"],
      ["การเคลือบกันซึม", "ไม่ต้องการ"],
    ],
  },
  {
    type: "custom_tape",
    status: "submitted",
    customer: 11,
    quantities: [500, 1000],
    submittedHoursAgo: 3,
    channel: "line",
    spec: [
      ["หน้ากว้างเทป", "48 มม."],
      ["ความยาวต่อม้วน", "45 หลา"],
      ["จำนวนสี", "2 สี"],
    ],
  },
  {
    type: "pop_display",
    status: "submitted",
    customer: 4,
    quantities: [10],
    submittedHoursAgo: 30,
    assignee: CS,
    spec: [
      ["รูปแบบชั้นวาง", "ตั้งโต๊ะ"],
      ["จำนวนชั้น", "2"],
      ["น้ำหนักรับได้", "2 กก."],
    ],
  },
  {
    type: "food_packaging",
    status: "quoted",
    customer: 2,
    quantities: [10000],
    submittedHoursAgo: 300,
    assignee: CS,
    consult: [{ factory: 3, buy: "3.10", lead: 15 }],
    quotes: [{ status: "sent", validDays: 1 }],
    spec: [
      ["วัสดุ", "กระดาษฟู้ดเกรด 300 แกรม"],
      ["สัมผัสอาหารโดยตรง", "ใช่"],
      ["การเคลือบกันซึม", "PE ด้านใน"],
    ],
  },
];

const messages = new Map<string, Message[]>();

function build(seed: Seed, index: number): Rfq {
  const n = index + 1;
  const id = mockId("rfq", n);
  const customer = customers[seed.customer]!;
  const submitted = -seed.submittedHoursAgo * HOUR;
  const slaTargetHours = SLA_HOURS[seed.type] ?? 16;
  const open = ["submitted", "in_review"].includes(seed.status);

  const consultations: Consultation[] = (seed.consult ?? []).map((item, at) => {
    const factory = FACTORIES[item.factory - 1]!;
    return {
      id: mockId("rcn", n * 10 + at),
      factory,
      tier: PARTICIPATION[factory.id]?.[seed.type] ?? null,
      status: item.buy ? "responded" : "requested",
      note: "ขอราคาตามสเปกและไฟล์แนบ",
      requestedBy: refOf(seed.assignee ?? CS),
      requestedAt: bangkokIso(submitted + HOUR),
      dueAt: bangkokIso(submitted + HOUR + DAY),
      respondedAt: item.buy ? bangkokIso(submitted + 3 * HOUR) : null,
      response: item.buy
        ? {
            leadTimeDays: item.lead ?? 20,
            notes: "ราคารวมค่าบล็อกแล้ว",
            tiers: seed.quantities.map((quantity, step) => {
              // Larger runs are cheaper per unit, as every factory's price list is.
              const buy = (Math.round(Number(item.buy) * (1 - step * 0.08) * 100) / 100).toFixed(6);
              return { quantity, suggestedUnitPrice: suggestedFrom(buy), buyUnitPrice: buy };
            }),
          }
        : null,
      declineNote: null,
    };
  });

  const rfq: Rfq = {
    id,
    rfqCode: `RFQ-2569-${String(n).padStart(5, "0")}`,
    channel: seed.channel ?? (seed.routed ? "cs" : "web"),
    status: seed.status,
    productType: productTypeRef(seed.type),
    customer: {
      id: customer.id,
      customerCode: customer.customerCode,
      displayName: customer.displayName,
      companyName: customer.companyName,
    },
    quantities: seed.quantities,
    dimensions: seed.size ? { lengthMm: seed.size[0], widthMm: seed.size[1], heightMm: seed.size[2] } : null,
    targetDate: day(submitted + 21 * DAY),
    province: customer.addresses[0]?.province ?? null,
    assignee: seed.assignee ? refOf(seed.assignee) : null,
    slaTargetHours,
    slaDueAt: bangkokIso(submitted + slaTargetHours * HOUR),
    firstResponseAt: open ? null : bangkokIso(submitted + Math.round(slaTargetHours * 0.6) * HOUR),
    urgency: "normal",
    consultationCounts: { requested: 0, responded: 0 },
    latestQuote: null,
    routedFromCalculator: Boolean(seed.routed),
    submittedAt: bangkokIso(submitted),
    contact: { phone: customer.phone, email: customer.email },
    spec: seed.spec.map(([label, value]) => ({ label, value })),
    specSchemaVersion: 1,
    notes: seed.notes ?? null,
    deliveryPostcode: customer.addresses[0]?.postcode ?? "10110",
    files: [
      {
        id: mockId("rfl", n),
        originalName: `${seed.type}-brief.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 182_000 + n * 1_311,
        thumbnailUrl: null,
        url: `data:text/plain;charset=utf-8,${encodeURIComponent(`ไฟล์ประกอบคำขอราคา (ข้อมูลจำลอง) ${n}`)}`,
      },
    ],
    routedFrom: seed.routed
      ? { reason: "ไม่มีโรงงานที่ราคาครอบคลุมสเปกนี้ในเครื่องคำนวณ (D-043)", calculator: "folding" }
      : null,
    declineReason: seed.declined ? (UNMET_REASONS.find((reason) => reason.code === seed.declined) ?? null) : null,
    declineNote: seed.declined ? "ยังไม่มีพาร์ตเนอร์ที่รับงานอะคริลิก" : null,
    acceptedQuotation: null,
    consultations,
    quotes: [],
    quoteDefaults: { validUntil: day(numberSetting("quotes.validity_days", 15) * DAY) },
    events: [],
    nextActions: [],
  };
  (seed.quotes ?? []).forEach((plan, at) => {
    const source = consultations.find((item) => item.response);
    const lines = seed.quantities.map((quantity) => {
      const tier = source?.response?.tiers.find((item) => item.quantity === quantity);
      const unit = tier
        ? (Number(tier.suggestedUnitPrice) * (plan.markup ? plan.markup / 1.3 : 1)).toFixed(2)
        : "10.00";
      return priceLine(
        { quantity, unitPrice: unit, leadTimeDays: source?.response?.leadTimeDays ?? 20, consultationId: source?.id },
        rfq,
      );
    });
    rfq.quotes.unshift({
      id: mockId("rqt", n * 10 + at),
      versionNo: at + 1,
      status: plan.status,
      validUntil: day(plan.validDays * DAY),
      customerNote: "ราคานี้รวมค่าขนส่งภายในกรุงเทพฯ และปริมณฑล",
      lines,
      currency: "THB",
      createdBy: refOf(seed.assignee ?? CS),
      createdAt: bangkokIso(submitted + (4 + at) * HOUR),
      sentAt: bangkokIso(submitted + (4 + at) * HOUR + 10),
      acceptedAt: plan.status === "accepted" ? bangkokIso(submitted + 30 * HOUR) : null,
    });
  });

  const accepted = rfq.quotes.find((quote) => quote.status === "accepted");
  if (accepted) rfq.acceptedQuotation = toQuotation(rfq, accepted, rfq.quantities[0]!, CS);

  rfq.events = [
    { id: `${id}:submitted`, at: rfq.submittedAt, kind: "rfq.submitted", title: "ลูกค้าส่งคำขอราคา", actor: null },
    ...(rfq.assignee
      ? [
          {
            id: `${id}:assigned`,
            at: bangkokIso(submitted + 20),
            kind: "rfq.assigned",
            title: `มอบหมายให้ ${rfq.assignee.displayName}`,
            actor: refOf(CS_LEAD),
          },
        ]
      : []),
    ...consultations.map((item) => ({
      id: `${item.id}:event`,
      at: item.respondedAt ?? item.requestedAt,
      kind: item.respondedAt ? "rfq.consultation_responded" : "rfq.consultation_requested",
      title: item.respondedAt ? `${item.factory.name} ตอบราคาแล้ว` : `ขอราคาจาก ${item.factory.name}`,
      actor: item.respondedAt ? null : item.requestedBy,
    })),
    ...rfq.quotes
      .filter((quote) => quote.sentAt)
      .map((quote) => ({
        id: `${quote.id}:sent`,
        at: quote.sentAt!,
        kind: "rfq.quote_sent",
        title: `ส่งใบเสนอราคาฉบับที่ ${quote.versionNo} ให้ลูกค้า`,
        actor: quote.createdBy,
      })),
  ];

  messages.set(id, [
    {
      id: mockId("rms", n * 10),
      authorKind: "customer",
      author: { id: customer.id, displayName: customer.displayName },
      visibility: "customer",
      body: seed.notes ?? "รบกวนเสนอราคาตามสเปกที่แนบครับ",
      files: [],
      createdAt: rfq.submittedAt,
    },
    ...(seed.status === "need_info"
      ? [
          {
            id: mockId("rms", n * 10 + 1),
            authorKind: "staff" as const,
            author: refOf(CS),
            visibility: "customer" as const,
            body: "รบกวนแจ้งจำนวนสีที่ต้องการพิมพ์ และส่งไฟล์โลโก้แบบเวกเตอร์ครับ",
            files: [],
            createdAt: rfq.firstResponseAt!,
          },
        ]
      : []),
  ]);

  return refresh(rfq);
}

/** Customer acceptance → a quotation (`quotes.source = rfq`), which CS create-order orders from. */
function toQuotation(rfq: Rfq, quote: Quote, quantity: number, by: StaffPersona) {
  const line = quote.lines.find((item) => item.quantity === quantity) ?? quote.lines[0]!;
  const id = mockId("quo", 700 + quotations.length);
  const quoteCode = `QT-2569-${String(700 + quotations.length).padStart(5, "0")}`;
  quotations.unshift({
    id,
    quoteCode,
    source: "rfq",
    rfq: { id: rfq.id, rfqCode: rfq.rfqCode },
    customer: rfq.customer,
    productType: rfq.productType,
    quantities: [line.quantity],
    grossAmount: line.grossAmount,
    currency: "THB",
    status: "saved",
    channel: "cs",
    validUntil: `${quote.validUntil}T23:59:59+07:00`,
    createdBy: refOf(by),
    createdAt: bangkokIso(),
    specs: rfq.spec,
    options: [
      {
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        netAmount: line.netAmount,
        discountAmount: "0.00",
        vatAmount: line.vatAmount,
        grossAmount: line.grossAmount,
        leadTimeDays: line.leadTimeDays,
        earliestShipDate: day(line.leadTimeDays * DAY),
      },
    ],
    discount: null,
    pdf: null,
    nextActions: [{ key: "quote.export_pdf" }, { key: "quote.create_order" }],
  });
  return { id, quoteCode, versionNo: quote.versionNo, quantity: line.quantity };
}

/** The derived columns and the actions offered — what the API recomputes on every change. */
function refresh(rfq: Rfq): Rfq {
  const open = ["submitted", "in_review", "need_info"].includes(rfq.status);
  const due = rfq.slaDueAt ? Date.parse(rfq.slaDueAt) : null;
  rfq.urgency =
    !open || rfq.firstResponseAt || due === null
      ? "normal"
      : due < Date.now()
        ? "late"
        : due - Date.now() < 2 * 60 * 60_000
          ? "due_soon"
          : "normal";
  rfq.consultationCounts = {
    requested: rfq.consultations.filter((item) => item.status === "requested").length,
    responded: rfq.consultations.filter((item) => item.status === "responded").length,
  };
  const latest = rfq.quotes.find((quote) => quote.status !== "draft") ?? rfq.quotes[0] ?? null;
  rfq.latestQuote = latest
    ? { id: latest.id, versionNo: latest.versionNo, status: latest.status, validUntil: latest.validUntil }
    : null;

  const draft = rfq.quotes.find((quote) => quote.status === "draft");
  const sent = rfq.quotes.find((quote) => quote.status === "sent");
  const actions: Rfq["nextActions"] = [];
  switch (rfq.status) {
    case "submitted":
      actions.push({ key: "rfq.start_review" }, { key: "rfq.assign" }, { key: "rfq.request_info" });
      break;
    case "in_review":
    case "need_info":
      if (draft) {
        actions.push({
          key: "rfq.send_quote",
          irreversible: true,
          disabledReason: draft.lines.some((line) => line.belowMarginFloor)
            ? "มีรายการต่ำกว่า margin floor — ต้องได้รับอนุมัติจาก C-Level ก่อนส่ง (D-052)"
            : null,
        });
      }
      actions.push(
        { key: "rfq.request_factory_cost" },
        { key: draft ? "rfq.edit_quote" : "rfq.compose_quote" },
        { key: "rfq.request_info" },
        { key: "rfq.assign" },
      );
      break;
    case "quoted":
      if (sent) actions.push({ key: "rfq.record_acceptance", irreversible: true });
      if (draft)
        actions.push({
          key: "rfq.send_quote",
          irreversible: true,
          disabledReason: draft.lines.some((line) => line.belowMarginFloor)
            ? "มีรายการต่ำกว่า margin floor — ต้องได้รับอนุมัติจาก C-Level ก่อนส่ง (D-052)"
            : null,
        });
      actions.push({ key: draft ? "rfq.edit_quote" : "rfq.compose_quote" }, { key: "rfq.assign" });
      break;
    case "accepted":
      if (rfq.acceptedQuotation) actions.push({ key: "rfq.create_order" });
      break;
    default:
      break;
  }
  if (open || rfq.status === "quoted") actions.push({ key: "rfq.decline", irreversible: true });
  rfq.nextActions = actions;
  return rfq;
}

export const rfqs: Rfq[] = SEEDS.map(build);

/* ---------------------------------------------------------------------------- per actor, D-141 */

function forActor(rfq: Rfq, who: StaffPersona | undefined): Rfq {
  const cost = can(who, "factory_cost.read");
  const margin = can(who, "margin.read");
  const whenDiscounting = can(who, "margin.read_pct_when_discounting");
  const manage = can(who, "rfqs.manage");
  return {
    ...rfq,
    consultations: rfq.consultations.map((item) => ({
      ...item,
      response: item.response
        ? {
            ...item.response,
            tiers: item.response.tiers.map(({ buyUnitPrice, ...tier }) => (cost ? { ...tier, buyUnitPrice } : tier)),
          }
        : null,
    })),
    quotes: rfq.quotes.map((quote) => ({
      ...quote,
      lines: quote.lines.map(({ buyUnitPrice, marginPct, factory, ...line }) => {
        const discounted = line.suggestedUnitPrice !== null && Number(line.unitPrice) < Number(line.suggestedUnitPrice);
        return {
          ...line,
          ...(cost ? { factory, buyUnitPrice } : {}),
          ...(marginPct !== undefined && (margin || (whenDiscounting && discounted)) ? { marginPct } : {}),
        };
      }),
    })),
    nextActions: manage ? rfq.nextActions : [],
  };
}

/** A list row carries the summary columns only. */
const summaryOf = (rfq: Rfq) => rfqSummary.parse(rfq);

/* ----------------------------------------------------------------------------- queues, search */

const QUEUES: Record<string, (rfq: Rfq, who: StaffPersona | undefined) => boolean> = {
  new: (rfq) => rfq.status === "submitted" && !rfq.assignee,
  mine: (rfq, who) => rfq.assignee?.id === who?.id && ["submitted", "in_review", "need_info"].includes(rfq.status),
  need_info: (rfq) => rfq.status === "need_info",
  awaiting_factory: (rfq) =>
    ["in_review", "need_info"].includes(rfq.status) && rfq.consultations.some((item) => item.status === "requested"),
  quoted: (rfq) => rfq.status === "quoted",
  overdue: (rfq) => refresh(rfq).urgency === "late",
};

for (const queue of ["new", "mine", "awaiting_factory", "overdue"] as const) {
  registerQueue("rfqs.read", (who) => {
    const rows = rfqs.filter((rfq) => QUEUES[queue]!(rfq, who));
    const due = rows
      .filter((rfq) => !rfq.firstResponseAt)
      .map((rfq) => rfq.slaDueAt)
      .filter((at): at is string => Boolean(at))
      .sort();
    return {
      key: `rfq.${queue}`,
      path: `/admin/rfq?queue=${queue}`,
      count: rows.length,
      overdueCount: due.filter((at) => Date.parse(at) < Date.now()).length,
      nextDueAt: due.find((at) => Date.parse(at) >= Date.now()) ?? null,
    };
  });
}

indexForSearch(
  ...rfqs.map((rfq) => ({
    type: "rfq" as const,
    id: rfq.id,
    code: rfq.rfqCode,
    title: `${rfq.rfqCode} · ${rfq.customer.displayName}`,
    subtitle: rfq.productType.name,
    permission: "rfqs.read",
    keywords: rfq.contact.phone ?? "",
  })),
);

/* --------------------------------------------------------------------------------- handlers */

const find = (rfqId: string | undefined) => rfqs.find((rfq) => rfq.id === rfqId);
const notFound = () => problem(404, "rfq.not_found", "ไม่พบคำขอราคานี้");
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const conflict = (detail: string) => problem(409, "rfq.invalid_state", detail);

function log(rfq: Rfq, kind: string, title: string, who: StaffPersona | null) {
  rfq.events.push({
    id: `${rfq.id}:${kind}:${Date.now()}`,
    at: bangkokIso(),
    kind,
    title,
    actor: who ? refOf(who) : null,
  });
}

function offered(rfq: Rfq, key: string) {
  return rfq.nextActions.some((action) => action.key === key && !action.disabledReason);
}

/** The RFQ and the actor for an action the RFQ currently offers — or the problem to answer with. */
function manage(
  request: Request,
  rfqId: string | undefined,
  action: string,
): Response | { rfq: Rfq; who: StaffPersona } {
  const who = staffPersonaOf(request);
  if (!who || !can(who, "rfqs.manage")) return forbidden();
  const rfq = find(rfqId);
  if (!rfq) return notFound();
  if (!offered(rfq, action)) return conflict("ทำรายการนี้กับคำขอราคาในสถานะนี้ไม่ได้");
  return { rfq, who };
}

function respond(rfq: Rfq, who: StaffPersona | undefined) {
  return forActor(refresh(rfq), who);
}

/** The draft's lines priced by the "API", or the 422 it answers with. */
function draftLines(
  rfq: Rfq,
  body: {
    validUntil: string;
    lines: { quantity: number; unitPrice: string; leadTimeDays: number; consultationId?: string }[];
  },
): Response | QuoteLine[] {
  if (body.validUntil < day(0))
    return problem(422, "validation.failed", "วันหมดอายุต้องไม่อยู่ในอดีต", [
      { path: "validUntil", code: "min", message: "ต้องไม่อยู่ในอดีต" },
    ]);
  if (new Set(body.lines.map((line) => line.quantity)).size !== body.lines.length)
    return problem(422, "validation.failed", "จำนวนซ้ำกัน", [
      { path: "lines", code: "unique", message: "จำนวนต้องไม่ซ้ำกัน" },
    ]);
  return body.lines.map((line) => priceLine(line, rfq));
}

/* ------------------------------------------------------------ the customer's side (mocks/store) */

/** The thread, shared with the storefront's view of the same RFQ. */
export const rfqMessages = messages;

/** A request a customer submitted on the storefront joins the desk's queues. */
export function addCustomerRfq(rfq: Rfq): Rfq {
  rfqs.unshift(refresh(rfq));
  log(rfq, "rfq.submitted", "ลูกค้าส่งคำขอราคาทางเว็บไซต์", null);
  return rfq;
}

/**
 * The customer accepts one quantity of a sent quote on the storefront — what `record-acceptance`
 * does for CS, without a staff actor. Answers the quotation it creates, or the problem.
 */
export function customerAcceptQuote(
  rfq: Rfq,
  quoteId: string,
  quantity: number,
): Response | { id: string; quoteCode: string; quantity: number; line: QuoteLine } {
  const quote = rfq.quotes.find((candidate) => candidate.id === quoteId);
  if (!quote || quote.status !== "sent" || rfq.status !== "quoted")
    return conflict("ตอบรับได้เฉพาะใบเสนอราคาฉบับล่าสุดที่ส่งให้แล้ว");
  if (quote.validUntil < day(0)) return problem(409, "rfq.quote_expired", "ใบเสนอราคาฉบับนี้หมดอายุแล้ว");
  const line = quote.lines.find((item) => item.quantity === quantity);
  if (!line)
    return problem(422, "validation.failed", "จำนวนนี้ไม่มีในใบเสนอราคา", [
      { path: "quantity", code: "enum", message: "เลือกจำนวนจากใบเสนอราคา" },
    ]);
  quote.status = "accepted";
  quote.acceptedAt = bangkokIso();
  rfq.status = "accepted";
  rfq.acceptedQuotation = toQuotation(rfq, quote, quantity, CS);
  log(rfq, "rfq.accepted", `ลูกค้าตอบรับฉบับที่ ${quote.versionNo} ทางเว็บไซต์`, null);
  refresh(rfq);
  return { ...rfq.acceptedQuotation, line };
}

export const rfqHandlers = [
  mockRequest("GET /v1/admin/rfqs", ({ query, request }) => {
    const who = staffPersonaOf(request);
    if (!can(who, "rfqs.read")) return forbidden();
    const rows = rfqs
      .map(refresh)
      .filter((rfq) => !query.queue || QUEUES[query.queue]!(rfq, who))
      .filter((rfq) => !query.status || rfq.status === query.status)
      .filter((rfq) => !query.productType || rfq.productType.code === query.productType)
      .filter((rfq) => !query.assigneeId || rfq.assignee?.id === query.assigneeId)
      .filter((rfq) => !query.channel || rfq.channel === query.channel)
      .filter((rfq) => !query.submittedFrom || rfq.submittedAt.slice(0, 10) >= query.submittedFrom)
      .filter((rfq) => !query.submittedTo || rfq.submittedAt.slice(0, 10) <= query.submittedTo)
      .filter((rfq) =>
        matchesQuery(query.q, rfq.rfqCode, rfq.customer.displayName, rfq.customer.companyName, rfq.contact.phone),
      )
      .map(summaryOf);
    // Queues work oldest-deadline first; everything else newest first unless asked otherwise.
    const sorted = query.sort
      ? sortBy(rows, query.sort, query.order)
      : query.queue && query.queue !== "quoted"
        ? sortBy(rows, "slaDueAt", "asc")
        : sortBy(rows, "submittedAt", "desc");
    return paginate(sorted, query);
  }),
  mockRequest("GET /v1/admin/rfqs/{rfqId}", ({ params, request }) => {
    const who = staffPersonaOf(request);
    if (!can(who, "rfqs.read")) return forbidden();
    const rfq = find(params.rfqId);
    return rfq ? respond(rfq, who) : notFound();
  }),
  mockRequest("GET /v1/admin/rfqs/{rfqId}/messages", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "rfqs.read")) return forbidden();
    const rfq = find(params.rfqId);
    return rfq ? { data: messages.get(rfq.id) ?? [] } : notFound();
  }),
  mockRequest("POST /v1/admin/rfqs/{rfqId}/messages", ({ params, body, request }) => {
    const who = staffPersonaOf(request);
    if (!can(who, "rfqs.manage")) return forbidden();
    const rfq = find(params.rfqId);
    if (!rfq) return notFound();
    const message: Message = {
      id: mockId("rms", 5000 + (messages.get(rfq.id)?.length ?? 0) + Math.floor(Math.random() * 1000)),
      authorKind: "staff",
      author: refOf(who!),
      visibility: body.visibility,
      body: body.body,
      files: [],
      createdAt: bangkokIso(),
    };
    messages.set(rfq.id, [...(messages.get(rfq.id) ?? []), message]);
    if (body.visibility === "customer" && !rfq.firstResponseAt) rfq.firstResponseAt = message.createdAt;
    return message;
  }),
  mockRequest("POST /v1/admin/rfqs/{rfqId}/actions/assign", ({ params, body, request }) => {
    const found = manage(request, params.rfqId, "rfq.assign");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    const assignee = body.assigneeId ? PERSONAS.find((candidate) => candidate.id === body.assigneeId) : null;
    if (body.assigneeId && !assignee) return problem(422, "validation.failed", "ไม่พบพนักงานที่เลือก");
    if (assignee && !can(assignee, "rfqs.manage"))
      return problem(422, "rfq.assignee_not_eligible", "พนักงานคนนี้ไม่มีสิทธิ์รับผิดชอบคำขอราคา");
    rfq.assignee = assignee ? refOf(assignee) : null;
    log(rfq, "rfq.assigned", assignee ? `มอบหมายให้ ${assignee.displayName}` : "ยกเลิกการมอบหมาย", who);
    return respond(rfq, who);
  }),
  mockRequest("POST /v1/admin/rfqs/{rfqId}/actions/start-review", ({ params, request }) => {
    const found = manage(request, params.rfqId, "rfq.start_review");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    rfq.status = "in_review";
    rfq.assignee ??= refOf(who);
    log(rfq, "rfq.review_started", "เริ่มพิจารณาคำขอราคา", who);
    return respond(rfq, who);
  }),
  mockRequest("POST /v1/admin/rfqs/{rfqId}/actions/request-info", ({ params, body, request }) => {
    const found = manage(request, params.rfqId, "rfq.request_info");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    rfq.status = "need_info";
    rfq.firstResponseAt ??= bangkokIso();
    messages.set(rfq.id, [
      ...(messages.get(rfq.id) ?? []),
      {
        id: mockId("rms", 7000 + Math.floor(Math.random() * 1000)),
        authorKind: "staff",
        author: refOf(who),
        visibility: "customer",
        body: body.message,
        files: [],
        createdAt: bangkokIso(),
      },
    ]);
    log(rfq, "rfq.info_requested", "ขอข้อมูลเพิ่มเติมจากลูกค้า", who);
    return respond(rfq, who);
  }),
  mockRequest("POST /v1/admin/rfqs/{rfqId}/actions/decline", ({ params, body, request }) => {
    const found = manage(request, params.rfqId, "rfq.decline");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    const reason = UNMET_REASONS.find((candidate) => candidate.code === body.reasonCode);
    if (!reason)
      return problem(422, "validation.failed", "เหตุผลไม่ถูกต้อง", [
        { path: "reasonCode", code: "enum", message: "ไม่รู้จักเหตุผลนี้" },
      ]);
    rfq.status = "declined";
    rfq.declineReason = reason;
    rfq.declineNote = body.note ?? null;
    rfq.firstResponseAt ??= bangkokIso();
    for (const quote of rfq.quotes)
      if (quote.status === "sent" || quote.status === "draft") quote.status = "superseded";
    log(rfq, "rfq.declined", `ปฏิเสธคำขอราคา: ${reason.name} (บันทึกเป็นความต้องการที่ไม่ได้รับการตอบสนอง)`, who);
    return respond(rfq, who);
  }),
  mockRequest("GET /v1/admin/unmet-demand-reasons", () => ({ data: UNMET_REASONS })),
  mockRequest("GET /v1/admin/rfqs/{rfqId}/candidate-factories", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "rfqs.manage")) return forbidden();
    const rfq = find(params.rfqId);
    if (!rfq) return notFound();
    const data: Candidate[] = FACTORIES.map((factory) => {
      const tier = PARTICIPATION[factory.id]?.[rfq.productType.code] ?? null;
      return {
        factory,
        tier,
        capable: tier !== null,
        reason: tier === null ? "ไม่มีความสามารถผลิตประเภทนี้ในระบบ" : null,
        alreadyConsulted: rfq.consultations.some(
          (item) => item.factory.id === factory.id && ["requested", "responded"].includes(item.status),
        ),
        onTimeRatePct: ON_TIME[factory.id] ?? null,
      };
    }).sort((a, b) => Number(b.capable) - Number(a.capable));
    return { data };
  }),
  mockRequest("POST /v1/admin/rfqs/{rfqId}/consultations", ({ params, body, request }) => {
    const found = manage(request, params.rfqId, "rfq.request_factory_cost");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    if (Date.parse(body.dueAt) <= Date.now())
      return problem(422, "validation.failed", "กำหนดตอบต้องเป็นเวลาในอนาคต", [
        { path: "dueAt", code: "min", message: "ต้องเป็นเวลาในอนาคต" },
      ]);
    const created: Consultation[] = [];
    for (const factoryId of body.factoryIds) {
      const factory = FACTORIES.find((candidate) => candidate.id === factoryId);
      const tier = factory ? (PARTICIPATION[factory.id]?.[rfq.productType.code] ?? null) : null;
      if (!factory || tier === null)
        return problem(422, "rfq.factory_not_capable", "โรงงานที่เลือกผลิตประเภทนี้ไม่ได้", [
          { path: "factoryIds", code: "capability", message: factory?.name ?? factoryId },
        ]);
      if (rfq.consultations.some((item) => item.factory.id === factoryId && item.status === "requested"))
        return problem(409, "rfq.consultation_open", `ขอราคาจาก ${factory.name} ไว้แล้ว`);
      created.push({
        id: mockId("rcn", 9000 + rfq.consultations.length + created.length + Math.floor(Math.random() * 500)),
        factory,
        tier,
        status: "requested",
        note: body.note ?? null,
        requestedBy: refOf(who),
        requestedAt: bangkokIso(),
        dueAt: body.dueAt,
        respondedAt: null,
        response: null,
        declineNote: null,
      });
    }
    rfq.consultations.push(...created);
    if (rfq.status === "submitted") rfq.status = "in_review";
    for (const item of created) log(rfq, "rfq.consultation_requested", `ขอราคาจาก ${item.factory.name}`, who);
    return { data: created };
  }),
  mockRequest("POST /v1/admin/rfqs/{rfqId}/consultations/{consultationId}/actions/remind", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "rfqs.manage")) return forbidden();
    const rfq = find(params.rfqId);
    const item = rfq?.consultations.find((candidate) => candidate.id === params.consultationId);
    if (!rfq || !item) return notFound();
    if (item.status !== "requested") return conflict("โรงงานตอบแล้ว ไม่ต้องเตือน");
    return new Response(null, { status: 204 });
  }),
  mockRequest("POST /v1/admin/rfqs/{rfqId}/quotes", ({ params, body, request }) => {
    const found = manage(request, params.rfqId, "rfq.compose_quote");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    const lines = draftLines(rfq, body);
    if (lines instanceof Response) return lines;
    const quote: Quote = {
      id: mockId("rqt", 9000 + rfq.quotes.length + Math.floor(Math.random() * 500)),
      versionNo: rfq.quotes.length + 1,
      status: "draft",
      validUntil: body.validUntil,
      customerNote: body.customerNote ?? null,
      lines,
      currency: "THB",
      createdBy: refOf(who),
      createdAt: bangkokIso(),
      sentAt: null,
      acceptedAt: null,
    };
    rfq.quotes.unshift(quote);
    refresh(rfq);
    return forActor(rfq, who).quotes[0]!;
  }),
  mockRequest("PUT /v1/admin/rfqs/{rfqId}/quotes/{quoteId}", ({ params, body, request }) => {
    const found = manage(request, params.rfqId, "rfq.edit_quote");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    const quote = rfq.quotes.find((candidate) => candidate.id === params.quoteId);
    if (!quote) return notFound();
    if (quote.status !== "draft") return conflict("แก้ได้เฉพาะฉบับร่าง");
    const lines = draftLines(rfq, body);
    if (lines instanceof Response) return lines;
    Object.assign(quote, { validUntil: body.validUntil, customerNote: body.customerNote ?? null, lines });
    refresh(rfq);
    return forActor(rfq, who).quotes.find((candidate) => candidate.id === quote.id)!;
  }),
  mockRequest("DELETE /v1/admin/rfqs/{rfqId}/quotes/{quoteId}", ({ params, request }) => {
    const found = manage(request, params.rfqId, "rfq.edit_quote");
    if (found instanceof Response) return found;
    const { rfq } = found;
    const at = rfq.quotes.findIndex((candidate) => candidate.id === params.quoteId && candidate.status === "draft");
    if (at < 0) return notFound();
    rfq.quotes.splice(at, 1);
    refresh(rfq);
    return new Response(null, { status: 204 });
  }),
  mockRequest("POST /v1/admin/rfqs/{rfqId}/quotes/{quoteId}/actions/send", ({ params, request }) => {
    const found = manage(request, params.rfqId, "rfq.send_quote");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    const quote = rfq.quotes.find((candidate) => candidate.id === params.quoteId);
    if (!quote || quote.status !== "draft") return conflict("ส่งได้เฉพาะฉบับร่าง");
    for (const other of rfq.quotes) if (other.status === "sent") other.status = "superseded";
    quote.status = "sent";
    quote.sentAt = bangkokIso();
    rfq.status = "quoted";
    rfq.firstResponseAt ??= quote.sentAt;
    log(rfq, "rfq.quote_sent", `ส่งใบเสนอราคาฉบับที่ ${quote.versionNo} ให้ลูกค้า`, who);
    return respond(rfq, who);
  }),
  mockRequest("POST /v1/admin/rfqs/{rfqId}/quotes/{quoteId}/actions/record-acceptance", ({ params, body, request }) => {
    const found = manage(request, params.rfqId, "rfq.record_acceptance");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    const quote = rfq.quotes.find((candidate) => candidate.id === params.quoteId);
    if (!quote || quote.status !== "sent") return conflict("บันทึกการตอบรับได้เฉพาะฉบับที่ส่งให้ลูกค้าแล้ว");
    if (quote.validUntil < day(0)) return problem(409, "rfq.quote_expired", "ใบเสนอราคาฉบับนี้หมดอายุแล้ว");
    if (!quote.lines.some((line) => line.quantity === body.quantity))
      return problem(422, "validation.failed", "จำนวนนี้ไม่มีในใบเสนอราคา", [
        { path: "quantity", code: "enum", message: "เลือกจำนวนจากใบเสนอราคา" },
      ]);
    quote.status = "accepted";
    quote.acceptedAt = bangkokIso();
    rfq.status = "accepted";
    rfq.acceptedQuotation = toQuotation(rfq, quote, body.quantity, who);
    log(rfq, "rfq.accepted", `ลูกค้าตอบรับฉบับที่ ${quote.versionNo} (บันทึกโดย CS: ${body.note})`, who);
    return respond(rfq, who);
  }),
];
