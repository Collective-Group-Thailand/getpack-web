/**
 * The RFQ desk, mocked at getpack-api's published paths (`admin.rfqs.*`, contract v0.6.0) with
 * `StaffRfqDto` — list, detail with its ETag, thread, start-review, assign / unassign,
 * request-info, decline, candidate factories, consultations and reminders, the quotation draft,
 * its replacement under If-Match, discard, send and the acceptance CS records — and the
 * unmet-demand reasons (D-102).
 *
 * State moves the way B2.5 describes: `submitted → in_review → need_info → quoted → accepted |
 * declined | expired`. A factory's answer arrives as a buy price per quantity; the fixture keeps
 * a suggested sell price derived from it with a flat mark-up standing in for the sell-margin
 * table (the published RFQ does not carry it), and computes line amounts in whole satang —
 * standing in for the backend, the only place money is computed. Cost and margin leave per D-141,
 * decided per actor on the way out, and `nextActions` follow getpack-api's rule table
 * (`src/modules/rfq/rfq-actions.ts` at v0.6.0) filtered by the reader's permissions.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import {
  bangkokIso,
  matchesQuery,
  mockId,
  paginate,
  precondition,
  problem,
  QUOTE_V2_EMPTY,
  RFQ_V2_EMPTY,
  sortBy,
  versionTag,
} from "../support";
import { lineSummaryOf, productTypeRef } from "./catalog";
import { baht, customers, FACTORY } from "./commerce";
import { indexForSearch, registerQueue } from "./console";
import { PARTICIPATION, stores } from "./partners";
import { files as uploadedFiles, settings } from "./platform";
import type { ConsultationRow, QuoteLineRow, QuoteRow, RfqActionRow, RfqMessageRow, RfqRow } from "./rfq-model";
import { quotations } from "./sales";
import { QUOTE_STATUS, RFQ_QUOTE_STATUS, RFQ_STATUS } from "@/domain/status";
import { statusLabels } from "../status-labels";

type Rfq = RfqRow;
type Consultation = ConsultationRow;
type Quote = QuoteRow;
type QuoteLine = QuoteLineRow;
type Message = RfqMessageRow;

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

/** On-time shipping % of each factory's latest monthly scorecard (D-155), as the API rounds it. */
const ON_TIME: Record<string, string> = {
  [FACTORIES[0]!.id]: "96.50",
  [FACTORIES[1]!.id]: "91.00",
  [FACTORIES[2]!.id]: "88.25",
  [FACTORIES[3]!.id]: "93.75",
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

/** The seeded `unmet_demand_reasons` (D-102), as `admin.rfqs.listUnmetDemandReasons` lists them. */
export const UNMET_REASONS: Schemas["UnmetDemandReasonDto"][] = [
  { code: "capability_missing", nameTh: "ไม่มีโรงงานที่ผลิตได้", nameEn: "No factory can make it" },
  { code: "capacity_full", nameTh: "กำลังการผลิตเต็มในช่วงที่ต้องการ", nameEn: "Capacity is full for the dates" },
  { code: "price_not_competitive", nameTh: "ราคาสู้ไม่ได้", nameEn: "Price not competitive" },
  { code: "spec_not_feasible", nameTh: "สเปกผลิตไม่ได้ในทางเทคนิค", nameEn: "Spec not feasible" },
  { code: "customer_no_response", nameTh: "ลูกค้าไม่ตอบกลับ", nameEn: "Customer did not respond" },
  { code: "expired", nameTh: "หมดอายุ", nameEn: "Expired" },
];
const reasonRow = (code: string) => {
  const reason = UNMET_REASONS.find((candidate) => candidate.code === code);
  return reason ? { code: reason.code, name: reason.nameTh } : null;
};

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
  input: {
    quantity: number;
    unitPrice: string;
    leadTimeDays: number;
    consultationId?: string | null;
    buyUnitPrice?: string | null;
    shippingNetAmount?: string | null;
  },
  rfq: Rfq,
): QuoteLine {
  // Pieces + shipping before VAT (`StaffRfqQuoteLineDto.netAmount`).
  const shipping = Math.round(Number(input.shippingNetAmount ?? "0") * 100);
  const net = Math.round(Number(input.unitPrice) * input.quantity * 100) + shipping;
  const vat = Math.round(net * 0.07);
  const source = rfq.consultations.find((item) => item.id === input.consultationId);
  const tier = source?.response?.tiers.find((item) => item.quantity === input.quantity);
  const buy = input.buyUnitPrice ?? tier?.buyUnitPrice;
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
    ...(buy ? { buyUnitPrice: Number(buy).toFixed(6) } : {}),
    ...(margin !== null ? { marginPct: margin.toFixed(4) } : {}),
    belowMarginFloor: margin !== null && margin < numberSetting("pricing.margin_floor_pct", 10),
    shippingNetAmount: baht(shipping),
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
    declineReason: seed.declined ? reasonRow(seed.declined) : null,
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
  if (accepted) rfq.acceptedQuotation = toQuotation(rfq, accepted, [rfq.quantities[0]!], CS);

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
            createdAt: rfq.firstResponseAt!,
          },
        ]
      : []),
  ]);

  return refresh(rfq);
}

/**
 * Acceptance → a quotation (`quotes.source = rfq`) with one option per accepted quantity, which
 * CS create-order orders from — the customer's own path and the one CS records (`accept`).
 */
function toQuotation(rfq: Rfq, quote: Quote, quantities: readonly number[], by: StaffPersona) {
  const accepted = quote.lines.filter((item) => quantities.includes(item.quantity));
  const lines = accepted.length > 0 ? accepted : quote.lines;
  const id = mockId("quo", 700 + quotations.length);
  const quoteCode = `QT-2569-${String(700 + quotations.length).padStart(5, "0")}`;
  // The published saved quotation (`AdminSavedQuoteDto`, U-F0.3) with the accepted lines as its options.
  quotations.unshift({
    ...QUOTE_V2_EMPTY,
    id,
    quoteCode,
    productTypeCode: rfq.productType.code,
    source: "rfq",
    status: "saved",
    ...statusLabels("status", QUOTE_STATUS, "saved"),
    channel: "cs",
    customer: { id: rfq.customer.id, displayName: rfq.customer.displayName },
    customerCode: rfq.customer.customerCode,
    createdBy: refOf(by),
    note: null,
    rfq: { id: rfq.id, rfqCode: rfq.rfqCode },
    summary: lineSummaryOf(rfq.productType.code),
    configuration: null,
    deliveryPostcode: null,
    currency: "THB",
    options: lines.map((line, at) => ({
      id: mockId("qop", 7000 + quotations.length * 10 + at),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      productAmount: line.grossAmount,
      designFeeAmount: "0.00",
      structureDesignFeeAmount: "0.00",
      // RFQ quotes split no plates or die blocks out.
      toolingAmount: null,
      toolingWaiver: null,
      toleranceDimensionalMm: null,
      toleranceColourDeltaE: null,
      targetGap: null,
      shippingAmount: null,
      shippingPending: true,
      shippingPendingReason: "no_postcode",
      netAmount: line.netAmount,
      vatAmount: line.vatAmount,
      grossAmount: line.grossAmount,
      leadTimeDays: line.leadTimeDays,
      earliestShipDate: day(line.leadTimeDays * DAY),
      earliestDeliveryDate: null,
      toleranceShortagePct: "5.0000",
      toleranceOveragePct: "5.0000",
      internal: null,
    })),
    priceLocked: true,
    pdfStatus: "none",
    sharedAt: null,
    validUntil: `${quote.validUntil}T23:59:59+07:00`,
    createdAt: bangkokIso(),
  });
  return { id, quoteCode, versionNo: quote.versionNo, quantity: lines[0]!.quantity };
}

/* ------------------------------------------------------------------------- next actions */

const OPEN: readonly Rfq["status"][] = ["submitted", "in_review", "need_info", "quoted"];
const CLOSED: readonly Rfq["status"][] = ["accepted", "declined", "expired"];

/** A version's validity as published: the end of its `validUntil` day in Bangkok. */
const validityOf = (quote: Pick<Quote, "validUntil">) => `${quote.validUntil}T23:59:59+07:00`;

const isOpen = (rfq: Rfq) => OPEN.includes(rfq.status);
const draftOf = (rfq: Rfq) => rfq.quotes.find((quote) => quote.status === "draft");
const acceptable = (rfq: Rfq) =>
  rfq.status === "quoted" &&
  rfq.quotes.some((quote) => quote.status === "sent" && Date.parse(validityOf(quote)) > Date.now());

/**
 * getpack-api's `ADMIN_RFQ_ACTIONS` (`src/modules/rfq/rfq-actions.ts` at v0.6.0), in its order.
 * Every rule needs `rfqs.manage`; `when` returns a string to offer the action disabled with it.
 */
const ADMIN_RFQ_RULES: { key: string; irreversible?: boolean; when: (rfq: Rfq) => boolean | string }[] = [
  { key: "rfq.assign", when: isOpen },
  { key: "rfq.start_review", when: (rfq) => rfq.status === "submitted" },
  { key: "rfq.request_info", when: (rfq) => isOpen(rfq) && rfq.status !== "quoted" },
  { key: "rfq.request_factory_cost", when: isOpen },
  { key: "rfq.compose_quote", when: (rfq) => isOpen(rfq) && !draftOf(rfq) },
  {
    key: "rfq.send_quote",
    when: (rfq) => isOpen(rfq) && draftOf(rfq) !== undefined && (draftOf(rfq)!.lines.length > 0 || "rfq.quote_empty"),
  },
  { key: "rfq.record_acceptance", irreversible: true, when: acceptable },
  { key: "rfq.decline", irreversible: true, when: isOpen },
];

function actionsOf(rfq: Rfq): RfqActionRow[] {
  return ADMIN_RFQ_RULES.flatMap((rule) => {
    const verdict = rule.when(rfq);
    if (verdict === false) return [];
    return [
      {
        key: rule.key,
        irreversible: rule.irreversible ?? false,
        disabledReason: typeof verdict === "string" ? verdict : null,
      },
    ];
  });
}

/** The derived columns and the rule table's verdict — what the API recomputes on every read. */
function refresh(rfq: Rfq): Rfq {
  const open = ["submitted", "in_review", "need_info", "quoted"].includes(rfq.status);
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
  rfq.nextActions = actionsOf(rfq);
  return rfq;
}

export const rfqs: Rfq[] = SEEDS.map(build);

/* --------------------------------------------------------------------------------- ETag */

/** `rfqs.row_version`: bumped by every change, so `If-Match` on the draft PUT can refuse a stale edit. */
const versions = new Map<string, number>();
const touch = (rfq: Rfq) => versions.set(rfq.id, (versions.get(rfq.id) ?? 1) + 1);
const etagOf = (rfq: Rfq) => versionTag(rfq.id, versions.get(rfq.id) ?? 1);

/* ---------------------------------------------------------------------- the published StaffRfqDto */

/** When the request was closed: its acceptance or decline, as the log has it. */
function closedAtOf(rfq: Rfq): string | null {
  if (!CLOSED.includes(rfq.status)) return null;
  const closing = [...rfq.events]
    .reverse()
    .find((event) => event.kind === "rfq.accepted" || event.kind === "rfq.declined");
  return closing?.at ?? rfq.quotes.find((quote) => quote.acceptedAt)?.acceptedAt ?? rfq.submittedAt;
}

/** A file's name, type and size: the fixture's own, or an upload the platform mock holds. */
function attached(fileId: string): Schemas["AttachedFileDto"] {
  const own = rfqs.flatMap((rfq) => rfq.files).find((file) => file.id === fileId);
  const uploaded = uploadedFiles.get(fileId);
  return {
    id: fileId,
    originalName: own?.originalName ?? uploaded?.originalName ?? "file",
    mimeType: own?.mimeType ?? uploaded?.mimeType ?? "application/octet-stream",
    sizeBytes: own?.sizeBytes ?? uploaded?.sizeBytes ?? 0,
  };
}

/** The fixture's spec words as the category form renders them (Thai only in the fixture). */
const specLinesOf = (rfq: Rfq): Schemas["SpecLineDto"][] =>
  rfq.spec.map((item, at) => ({
    key: `line_${at + 1}`,
    labelTh: item.label,
    labelEn: item.label,
    valueTh: item.value,
    valueEn: item.value,
  }));

/**
 * A row as `admin.rfqs.get` publishes it. Buy prices need `factory_buy_prices.read`, the margin
 * `margin.read` (D-141); `nextActions` keep what `rfqs.manage` allows. The suggested sell prices
 * and the events stay in the fixture (`suggestedUnitPrice` is left out by the API).
 */
export function toStaffRfqDto(row: Rfq, who: StaffPersona | undefined): Schemas["StaffRfqDto"] {
  const rfq = refresh(row);
  const cost = can(who, "factory_buy_prices.read");
  const margin = can(who, "margin.read");
  const customer = { id: rfq.customer.id, displayName: rfq.customer.displayName };
  return {
    ...RFQ_V2_EMPTY,
    id: rfq.id,
    rfqCode: rfq.rfqCode,
    status: rfq.status,
    ...statusLabels("status", RFQ_STATUS, rfq.status),
    channel: rfq.channel,
    customer,
    assignedTo: rfq.assignee,
    productTypeCode: rfq.productType.code,
    productTypeName: rfq.productType.name,
    quantities: rfq.quantities,
    lengthMm: rfq.dimensions?.lengthMm ?? null,
    widthMm: rfq.dimensions?.widthMm ?? null,
    heightMm: rfq.dimensions?.heightMm ?? null,
    targetDate: rfq.targetDate,
    deliveryPostcode: rfq.deliveryPostcode,
    notes: rfq.notes ?? "",
    // The fixture keeps the spec in words; its labels stand in for the answer keys.
    spec: Object.fromEntries(rfq.spec.map((item) => [item.label, item.value])),
    specLines: specLinesOf(rfq),
    customerCode: rfq.customer.customerCode,
    contact: { ...rfq.contact },
    files: rfq.files.map((file) => attached(file.id)),
    routedFromCalculator: rfq.routedFromCalculator,
    slaTargetHours: rfq.slaTargetHours,
    quoteDefaults: { validUntil: validityOf({ validUntil: validityFromToday() }) },
    nextActions: can(who, "rfqs.manage")
      ? rfq.nextActions.map((action) => ({
          key: action.key,
          irreversible: action.irreversible ?? false,
          disabledReason: action.disabledReason ?? null,
        }))
      : [],
    submittedAt: rfq.submittedAt,
    firstResponseAt: rfq.firstResponseAt,
    slaDueAt: rfq.slaDueAt,
    overdue: rfq.urgency === "late",
    closedAt: closedAtOf(rfq),
    declineReasonCode: rfq.declineReason?.code ?? null,
    acceptedQuoteId: rfq.acceptedQuotation?.id ?? null,
    consultations: rfq.consultations.map((item) => ({
      id: item.id,
      factoryId: item.factory.id,
      factoryCode: item.factory.code,
      status: item.status,
      dueAt: item.dueAt,
      note: item.note ?? "",
      requestedBy: item.requestedBy,
      respondedAt: item.respondedAt,
      responseNote: item.response?.notes ?? item.declineNote ?? null,
      lines:
        cost && item.response
          ? item.response.tiers
              .filter((tier) => tier.buyUnitPrice)
              .map((tier) => ({
                quantity: tier.quantity,
                buyUnitPrice: tier.buyUnitPrice!,
                leadTimeDays: item.response!.leadTimeDays,
              }))
          : null,
    })),
    quotations: rfq.quotes.map((quote) => ({
      id: quote.id,
      versionNo: quote.versionNo,
      status: quote.status,
      ...statusLabels("status", RFQ_QUOTE_STATUS, quote.status),
      // A draft has no validity yet: the API sets it when the version is sent (D-051).
      validUntil: quote.status === "draft" ? null : validityOf(quote),
      sentAt: quote.sentAt,
      note: quote.customerNote ?? "",
      lines: quote.lines.map((line) => ({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        netAmount: line.netAmount,
        vatAmount: line.vatAmount,
        grossAmount: line.grossAmount,
        leadTimeDays: line.leadTimeDays,
        shippingNetAmount: line.shippingNetAmount ?? "0.00",
        belowMarginFloor: line.belowMarginFloor,
        factoryId: line.factory?.id ?? null,
        buyUnitPrice: cost ? (line.buyUnitPrice ?? null) : null,
        marginPct: margin ? (line.marginPct ?? null) : null,
      })),
    })),
    messages: (messages.get(rfq.id) ?? []).map((message) => ({
      id: message.id,
      author: message.authorKind === "staff" ? ("getpack" as const) : ("customer" as const),
      authorUser: message.author ?? customer,
      visibility: message.visibility,
      body: message.body,
      files: (message.fileIds ?? []).map(attached),
      createdAt: message.createdAt,
    })),
  };
}

/* ----------------------------------------------------------------------------- queues, search */

/** The desk's queues as the published filters express them (`status`, `assignedToId`, `overdue`). */
const QUEUES: Record<string, (rfq: Rfq, who: StaffPersona | undefined) => boolean> = {
  new: (rfq) => rfq.status === "submitted",
  mine: (rfq, who) => rfq.assignee?.id === who?.id,
  overdue: (rfq) => refresh(rfq).urgency === "late",
  awaiting_factory: (rfq) => rfq.consultations.some((item) => item.status === "requested"),
};

// getpack-api's one RFQ dashboard queue: submitted RFQs still waiting for a first response.
for (const queue of ["new"] as const) {
  registerQueue("rfqs.read", (who) => {
    const rows = rfqs.filter((rfq) => QUEUES[queue]!(rfq, who));
    const due = rows
      .filter((rfq) => !rfq.firstResponseAt)
      .map((rfq) => rfq.slaDueAt)
      .filter((at): at is string => Boolean(at))
      .sort();
    return {
      key: "rfqs.awaiting_first_response",
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

const find = (rfqId: unknown) => rfqs.find((rfq) => rfq.id === rfqId);
const findByQuote = (quoteId: unknown) => rfqs.find((rfq) => rfq.quotes.some((quote) => quote.id === quoteId));
const findByConsultation = (consultationId: unknown) =>
  rfqs.find((rfq) => rfq.consultations.some((item) => item.id === consultationId));
const httpNotFound = () => problem(404, "http.not_found", "ไม่พบคำขอราคานี้");
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");

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
  return refresh(rfq).nextActions.some((action) => action.key === key && !action.disabledReason);
}

/**
 * The RFQ and the actor for an operation (`rfqs.manage`), answering with the codes it documents:
 * `rfq.closed` on a closed request, `rfq.invalid_transition` for anything the rules do not offer.
 */
function managePublished(
  request: Request,
  rfq: Rfq | undefined,
  action: string,
): Response | { rfq: Rfq; who: StaffPersona } {
  const who = staffPersonaOf(request);
  if (!who || !can(who, "rfqs.manage")) return forbidden();
  if (!rfq) return httpNotFound();
  if (CLOSED.includes(rfq.status)) return problem(409, "rfq.closed", "คำขอราคานี้ปิดแล้ว");
  if (!offered(rfq, action)) return problem(409, "rfq.invalid_transition", "ทำรายการนี้กับคำขอราคาในสถานะนี้ไม่ได้");
  return { rfq, who };
}

/** The RFQ after a change, with its new ETag. */
const published = (rfq: Rfq, who: StaffPersona | undefined, status = 200) =>
  HttpResponse.json(toStaffRfqDto(rfq, who), { status, headers: { ETag: etagOf(rfq) } });

/** A change that moves the RFQ on: a new row version, then the published RFQ. */
function changed(rfq: Rfq, who: StaffPersona, status = 200) {
  touch(rfq);
  return published(rfq, who, status);
}

async function bodyOf<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}

/** An operation that declares `Idempotency-Key` refuses a key that is not a UUID. */
function badKey(request: Request, required = false): Response | null {
  const key = request.headers.get("idempotency-key");
  if (!key)
    return required ? problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้") : null;
  return /^[0-9a-f-]{36}$/i.test(key) ? null : problem(400, "idempotency.key_invalid", "Idempotency-Key ไม่ถูกต้อง");
}

/** Answers already given, by Idempotency-Key: a replay gets the first answer back. */
const replays = new Map<string, { status: number; body: unknown }>();
async function once(request: Request, run: () => Promise<Response> | Response): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  const seen = key ? replays.get(`${new URL(request.url).pathname}:${key}`) : undefined;
  if (seen)
    return HttpResponse.json(seen.body as never, { status: seen.status, headers: { "Idempotent-Replayed": "true" } });
  const response = await run();
  if (key && response.ok && response.status !== 204) {
    replays.set(`${new URL(request.url).pathname}:${key}`, {
      status: response.status,
      body: await response.clone().json(),
    });
  }
  return response;
}

/** The draft's lines priced by the "API", or the 422 it answers with. */
function draftLines(rfq: Rfq, lines: Schemas["RfqQuoteLineInputDto"][]): Response | QuoteLine[] {
  if (lines.length === 0)
    return problem(422, "validation.failed", "ต้องมีอย่างน้อยหนึ่งรายการ", [
      { path: "lines", code: "min", message: "ต้องมีอย่างน้อยหนึ่งรายการ" },
    ]);
  if (new Set(lines.map((line) => line.quantity)).size !== lines.length)
    return problem(422, "validation.failed", "จำนวนซ้ำกัน", [
      { path: "lines", code: "unique", message: "one line per quantity" },
    ]);
  const unknown = lines.findIndex((line) => line.factoryId && !FACTORIES.some((item) => item.id === line.factoryId));
  if (unknown >= 0)
    return problem(422, "validation.failed", "ไม่พบโรงงานนี้", [
      { path: `lines[${unknown}].factoryId`, code: "exists", message: "unknown factory" },
    ]);
  return lines.map((line) =>
    priceLine(
      {
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        leadTimeDays: line.leadTimeDays,
        consultationId:
          rfq.consultations.find((item) => item.factory.id === line.factoryId && item.status === "responded")?.id ??
          null,
        buyUnitPrice: line.buyUnitPrice ?? null,
        shippingNetAmount: line.shippingNetAmount ?? null,
      },
      rfq,
    ),
  );
}

/** The validity a version gets when it is sent: `quotes.validity_days` from today (D-051). */
function validityFromToday() {
  return day(numberSetting("quotes.validity_days", 15) * DAY);
}

/**
 * The factories that could quote the request (D-043): an active capability for its category at an
 * active or trial factory, the tier in force, whether every requested quantity fits the
 * capability's range (the partners mock's own rows), and the on-time rate. No prices.
 */
function candidatesOf(rfq: Rfq): Schemas["CandidateFactoryDto"][] {
  return FACTORIES.flatMap((factory) => {
    const tier = PARTICIPATION[factory.id]?.[rfq.productType.code];
    const store = stores.get(factory.id);
    const capabilities = (store?.capabilities ?? []).filter(
      (item) => item.productTypeCode === rfq.productType.code && item.status === "active",
    );
    if (!tier || !store || capabilities.length === 0) return [];
    const fits = capabilities.some((item) =>
      rfq.quantities.every(
        (quantity) =>
          (item.minOrderQty === null || quantity >= item.minOrderQty) &&
          (item.maxOrderQty === null || quantity <= item.maxOrderQty),
      ),
    );
    const below = capabilities.every(
      (item) => item.minOrderQty !== null && rfq.quantities.some((quantity) => quantity < item.minOrderQty!),
    );
    return [
      {
        factoryId: factory.id,
        code: factory.code,
        name: factory.name,
        status: store.factory.status === "trial" ? "trial" : "active",
        tier,
        capable: fits,
        reason: fits ? null : below ? "quantity_below_minimum" : "quantity_above_maximum",
        alreadyConsulted: rfq.consultations.some((item) => item.factory.id === factory.id),
        onTimeShippingPct: ON_TIME[factory.id] ?? null,
      } satisfies Schemas["CandidateFactoryDto"],
    ];
  });
}

/** Reminders sent, by consultation: once an hour at most (getpack-api's anti-spam bound). */
const reminded = new Map<string, number>();

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
    return problem(409, "rfq.quote_not_open", "ตอบรับได้เฉพาะใบเสนอราคาฉบับล่าสุดที่ส่งให้แล้ว");
  if (Date.parse(validityOf(quote)) <= Date.now())
    return problem(409, "rfq.quote_not_open", "ใบเสนอราคาฉบับนี้หมดอายุแล้ว");
  const line = quote.lines.find((item) => item.quantity === quantity);
  if (!line)
    return problem(422, "validation.failed", "จำนวนนี้ไม่มีในใบเสนอราคา", [
      { path: "quantities", code: "invalid", message: "no quoted quantity matches" },
    ]);
  quote.status = "accepted";
  quote.acceptedAt = bangkokIso();
  rfq.status = "accepted";
  rfq.acceptedQuotation = toQuotation(rfq, quote, [quantity], CS);
  log(rfq, "rfq.accepted", `ลูกค้าตอบรับฉบับที่ ${quote.versionNo} ทางเว็บไซต์`, null);
  touch(rfq);
  refresh(rfq);
  return { ...rfq.acceptedQuotation, line };
}

/** The published RFQ surface (`admin.rfqs.*`, contract v0.6.0). */
export const rfqHandlers = [
  // admin.rfqs.list (`rfqs.read`)
  http.get("*/v1/admin/rfqs", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!can(who, "rfqs.read")) return forbidden();
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams);
    const submittedDay = (rfq: Rfq) => rfq.submittedAt.slice(0, 10);
    const rows = rfqs
      .map(refresh)
      .filter((rfq) => !query.status || rfq.status === query.status)
      .filter((rfq) => !query.assignedToId || rfq.assignee?.id === query.assignedToId)
      .filter((rfq) => query.overdue !== "true" || rfq.urgency === "late")
      .filter((rfq) => !query.productTypeCode || rfq.productType.code === query.productTypeCode)
      .filter((rfq) => !query.channel || rfq.channel === query.channel)
      .filter((rfq) => !query.submittedFrom || submittedDay(rfq) >= query.submittedFrom)
      .filter((rfq) => !query.submittedTo || submittedDay(rfq) <= query.submittedTo)
      .filter((rfq) => query.awaitingFactory !== "true" || QUEUES.awaiting_factory!(rfq, who))
      .filter((rfq) =>
        matchesQuery(query.q, rfq.rfqCode, rfq.customer.displayName, rfq.customer.companyName, rfq.contact.phone),
      )
      .map((rfq) => toStaffRfqDto(rfq, who));
    // Overdue work is oldest-deadline first; everything else newest first unless asked otherwise.
    const sorted = query.sort
      ? sortBy(rows, query.sort, query.order as "asc" | "desc" | undefined)
      : query.overdue === "true"
        ? sortBy(rows, "slaDueAt", "asc")
        : sortBy(rows, "submittedAt", "desc");
    return HttpResponse.json(
      paginate(sorted, {
        page: query.page ? Number(query.page) : undefined,
        perPage: query.perPage ? Number(query.perPage) : undefined,
      }),
    );
  }),

  // admin.rfqs.listUnmetDemandReasons (`rfqs.read`)
  http.get("*/v1/admin/unmet-demand-reasons", ({ request }) => {
    if (!can(staffPersonaOf(request), "rfqs.read")) return forbidden();
    return HttpResponse.json(UNMET_REASONS);
  }),

  // admin.rfqs.get (`rfqs.read`), with the ETag the draft PUT is matched against.
  http.get("*/v1/admin/rfqs/:rfqId", ({ params, request }) => {
    const who = staffPersonaOf(request);
    if (!can(who, "rfqs.read")) return forbidden();
    const rfq = find(params.rfqId);
    return rfq ? published(rfq, who) : httpNotFound();
  }),

  // admin.rfqs.listCandidateFactories (`rfqs.read`)
  http.get("*/v1/admin/rfqs/:rfqId/candidate-factories", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "rfqs.read")) return forbidden();
    const rfq = find(params.rfqId);
    return rfq ? HttpResponse.json(candidatesOf(rfq)) : httpNotFound();
  }),

  // admin.rfqs.postMessage (`rfqs.manage`): answers the whole RFQ; staff may attach files.
  http.post("*/v1/admin/rfqs/:rfqId/messages", async ({ params, request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "rfqs.manage")) return forbidden();
    const rfq = find(params.rfqId);
    if (!rfq) return httpNotFound();
    if (CLOSED.includes(rfq.status)) return problem(409, "rfq.closed", "คำขอราคานี้ปิดแล้ว");
    const body = await bodyOf<Schemas["StaffRfqMessageInputDto"]>(request);
    if (!body?.body?.trim()) return problem(422, "validation.failed", "กรุณาพิมพ์ข้อความ");
    if ((body.fileIds?.length ?? 0) > 10)
      return problem(422, "validation.failed", "แนบไฟล์ได้ไม่เกิน 10 ไฟล์", [
        { path: "fileIds", code: "max", message: "≤ 10" },
      ]);
    const message: Message = {
      id: mockId("rms", 5000 + (messages.get(rfq.id)?.length ?? 0) + Math.floor(Math.random() * 1000)),
      authorKind: "staff",
      author: refOf(who),
      visibility: body.visibility,
      body: body.body,
      fileIds: body.fileIds ?? [],
      createdAt: bangkokIso(),
    };
    messages.set(rfq.id, [...(messages.get(rfq.id) ?? []), message]);
    // The first customer-visible message records the first response (D-100).
    if (body.visibility === "customer" && !rfq.firstResponseAt) rfq.firstResponseAt = message.createdAt;
    return changed(rfq, who, 201);
  }),

  // admin.rfqs.startReview (`rfqs.manage`): submitted → in_review, without assigning (D-100).
  http.post("*/v1/admin/rfqs/:rfqId/actions/start-review", ({ params, request }) => {
    const found = managePublished(request, find(params.rfqId), "rfq.start_review");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    rfq.status = "in_review";
    log(rfq, "rfq.review_started", "เริ่มพิจารณาคำขอราคา", who);
    return changed(rfq, who);
  }),

  // admin.rfqs.assign (`rfqs.manage`): `null` unassigns; a submitted request moves to in_review.
  http.post("*/v1/admin/rfqs/:rfqId/actions/assign", async ({ params, request }) => {
    const found = managePublished(request, find(params.rfqId), "rfq.assign");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    const body = await bodyOf<Schemas["AssignRfqDto"]>(request);
    if (body?.userId === null) {
      rfq.assignee = null;
      log(rfq, "rfq.unassigned", "ยกเลิกผู้รับผิดชอบ", who);
      return changed(rfq, who);
    }
    const assignee = PERSONAS.find((candidate) => candidate.id === body?.userId);
    if (!assignee)
      return problem(422, "validation.failed", "ไม่พบพนักงานที่เลือก", [
        { path: "userId", code: "exists", message: "not an active staff user" },
      ]);
    rfq.assignee = refOf(assignee);
    if (rfq.status === "submitted") rfq.status = "in_review";
    log(rfq, "rfq.assigned", `มอบหมายให้ ${assignee.displayName}`, who);
    return changed(rfq, who);
  }),

  // admin.rfqs.requestInfo (`rfqs.manage`): → need_info; the message goes to the customer.
  http.post("*/v1/admin/rfqs/:rfqId/actions/request-info", async ({ params, request }) => {
    const found = managePublished(request, find(params.rfqId), "rfq.request_info");
    if (found instanceof Response) return found;
    const { rfq, who } = found;
    const body = await bodyOf<Schemas["RfqMessageInputDto"]>(request);
    if (!body?.body?.trim()) return problem(422, "validation.failed", "กรุณาพิมพ์ข้อความ");
    rfq.status = "need_info";
    rfq.firstResponseAt ??= bangkokIso();
    messages.set(rfq.id, [
      ...(messages.get(rfq.id) ?? []),
      {
        id: mockId("rms", 7000 + Math.floor(Math.random() * 1000)),
        authorKind: "staff",
        author: refOf(who),
        visibility: "customer",
        body: body.body,
        createdAt: bangkokIso(),
      },
    ]);
    log(rfq, "rfq.info_requested", "ขอข้อมูลเพิ่มเติมจากลูกค้า", who);
    return changed(rfq, who);
  }),

  // admin.rfqs.decline (`rfqs.manage`, optional Idempotency-Key): an unmet-demand reason (D-102).
  http.post("*/v1/admin/rfqs/:rfqId/actions/decline", async ({ params, request }) => {
    const refused = badKey(request);
    if (refused) return refused;
    return once(request, async () => {
      const found = managePublished(request, find(params.rfqId), "rfq.decline");
      if (found instanceof Response) return found;
      const { rfq, who } = found;
      const body = await bodyOf<Schemas["StaffDeclineRfqDto"]>(request);
      const reason = body?.reasonCode ? reasonRow(body.reasonCode) : null;
      if (!reason)
        return problem(422, "validation.failed", "เหตุผลไม่ถูกต้อง", [
          { path: "reasonCode", code: "enum", message: "ไม่รู้จักเหตุผลนี้" },
        ]);
      rfq.status = "declined";
      rfq.declineReason = reason;
      rfq.declineNote = body?.note ?? null;
      rfq.firstResponseAt ??= bangkokIso();
      for (const quote of rfq.quotes)
        if (quote.status === "sent" || quote.status === "draft") quote.status = "superseded";
      log(rfq, "rfq.declined", `ปฏิเสธคำขอราคา: ${reason.name} (บันทึกเป็นความต้องการที่ไม่ได้รับการตอบสนอง)`, who);
      return changed(rfq, who);
    });
  }),

  // admin.rfqs.requestConsultation (`rfqs.manage`, optional Idempotency-Key): one factory per call.
  http.post("*/v1/admin/rfqs/:rfqId/consultations", async ({ params, request }) => {
    const refused = badKey(request);
    if (refused) return refused;
    return once(request, async () => {
      const found = managePublished(request, find(params.rfqId), "rfq.request_factory_cost");
      if (found instanceof Response) return found;
      const { rfq, who } = found;
      const body = await bodyOf<Schemas["RequestConsultationDto"]>(request);
      if (!body?.dueAt || Date.parse(body.dueAt) <= Date.now())
        return problem(422, "validation.failed", "กำหนดตอบต้องเป็นเวลาในอนาคต", [
          { path: "dueAt", code: "min", message: "ต้องเป็นเวลาในอนาคต" },
        ]);
      const factory = FACTORIES.find((candidate) => candidate.id === body.factoryId);
      const candidate = candidatesOf(rfq).find((item) => item.factoryId === body.factoryId);
      if (!factory || !candidate)
        return problem(422, "validation.failed", "โรงงานที่เลือกผลิตประเภทนี้ไม่ได้", [
          { path: "factoryId", code: "capability", message: factory?.name ?? String(body.factoryId) },
        ]);
      if (rfq.consultations.some((item) => item.factory.id === factory.id && item.status === "requested"))
        return problem(409, "rfq.consultation_open", `ขอราคาจาก ${factory.name} ไว้แล้ว`);
      rfq.consultations.push({
        id: mockId("rcn", 9000 + rfq.consultations.length + Math.floor(Math.random() * 500)),
        factory,
        tier: candidate.tier,
        status: "requested",
        note: body.note ?? null,
        requestedBy: refOf(who),
        requestedAt: bangkokIso(),
        dueAt: body.dueAt,
        respondedAt: null,
        response: null,
        declineNote: null,
      });
      if (rfq.status === "submitted") rfq.status = "in_review";
      log(rfq, "rfq.consultation_requested", `ขอราคาจาก ${factory.name}`, who);
      return changed(rfq, who, 201);
    });
  }),

  // admin.rfqs.remindConsultation (`rfqs.manage`, optional Idempotency-Key): once an hour at most.
  http.post("*/v1/admin/rfq-consultations/:consultationId/actions/remind", ({ params, request }) => {
    const refused = badKey(request);
    if (refused) return refused;
    if (!can(staffPersonaOf(request), "rfqs.manage")) return forbidden();
    const rfq = findByConsultation(params.consultationId);
    const item = rfq?.consultations.find((candidate) => candidate.id === params.consultationId);
    if (!rfq || !item) return httpNotFound();
    if (item.status !== "requested") return problem(409, "rfq.consultation_not_open", "โรงงานตอบแล้ว ไม่ต้องเตือน");
    const key = request.headers.get("idempotency-key");
    if (key && replays.has(`remind:${key}`))
      return new HttpResponse(null, { status: 204, headers: { "Idempotent-Replayed": "true" } });
    const last = reminded.get(item.id);
    if (last && Date.now() - last < 60 * 60_000)
      return problem(409, "rfq.reminder_recent", "เพิ่งเตือนโรงงานนี้ไปเมื่อไม่ถึงชั่วโมงที่แล้ว");
    reminded.set(item.id, Date.now());
    if (key) replays.set(`remind:${key}`, { status: 204, body: null });
    return new HttpResponse(null, { status: 204 });
  }),

  // admin.rfqs.draftQuotation (`rfqs.manage`, optional Idempotency-Key): one draft at a time;
  // validity is set at send (D-051).
  http.post("*/v1/admin/rfqs/:rfqId/quotations", async ({ params, request }) => {
    const refused = badKey(request);
    if (refused) return refused;
    return once(request, async () => {
      const rfq = find(params.rfqId);
      if (rfq && draftOf(rfq) && !CLOSED.includes(rfq.status) && can(staffPersonaOf(request), "rfqs.manage"))
        return problem(409, "rfq.draft_open", "มีฉบับร่างอยู่แล้ว แก้ไขหรือทิ้งฉบับร่างนั้นก่อน");
      const found = managePublished(request, rfq, "rfq.compose_quote");
      if (found instanceof Response) return found;
      const { who } = found;
      const body = await bodyOf<Schemas["DraftRfqQuoteDto"]>(request);
      const lines = draftLines(found.rfq, body?.lines ?? []);
      if (lines instanceof Response) return lines;
      found.rfq.quotes.unshift({
        id: mockId("rqt", 9000 + found.rfq.quotes.length + Math.floor(Math.random() * 500)),
        versionNo: found.rfq.quotes.length + 1,
        status: "draft",
        // Kept for the fixture only; the draft is published without a validity.
        validUntil: validityFromToday(),
        customerNote: body?.note?.trim() || null,
        lines,
        currency: "THB",
        createdBy: refOf(who),
        createdAt: bangkokIso(),
        sentAt: null,
        acceptedAt: null,
      });
      log(found.rfq, "rfq.quote_drafted", "จัดทำฉบับร่างใบเสนอราคา", who);
      return changed(found.rfq, who, 201);
    });
  }),

  // admin.rfqs.replaceDraftQuotation (`rfqs.manage`): the draft's lines and note, If-Match the
  // RFQ's ETag; answers the RFQ with its new ETag.
  http.put("*/v1/admin/rfq-quotations/:rfqQuoteId", async ({ params, request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "rfqs.manage")) return forbidden();
    const rfq = findByQuote(params.rfqQuoteId);
    const quote = rfq?.quotes.find((candidate) => candidate.id === params.rfqQuoteId);
    if (!rfq || !quote) return httpNotFound();
    if (quote.status !== "draft") return problem(409, "rfq.quote_not_draft", "แก้ได้เฉพาะฉบับร่าง");
    const stale = precondition(request, etagOf(rfq));
    if (stale) return stale;
    if (CLOSED.includes(rfq.status)) return problem(409, "rfq.closed", "คำขอราคานี้ปิดแล้ว");
    const body = await bodyOf<Schemas["DraftRfqQuoteDto"]>(request);
    const lines = draftLines(rfq, body?.lines ?? []);
    if (lines instanceof Response) return lines;
    Object.assign(quote, { customerNote: body?.note?.trim() || null, lines });
    log(rfq, "rfq.quote_revised", `แก้ไขฉบับร่างที่ ${quote.versionNo}`, who);
    return changed(rfq, who);
  }),

  // admin.rfqs.discardQuotation (`rfqs.manage`): drafts only.
  http.post("*/v1/admin/rfq-quotations/:rfqQuoteId/actions/discard", ({ params, request }) => {
    const rfq = findByQuote(params.rfqQuoteId);
    const who = staffPersonaOf(request);
    if (!who || !can(who, "rfqs.manage")) return forbidden();
    if (!rfq) return httpNotFound();
    const at = rfq.quotes.findIndex((candidate) => candidate.id === params.rfqQuoteId);
    if (rfq.quotes[at]?.status !== "draft") return problem(409, "rfq.quote_not_draft", "ทิ้งได้เฉพาะฉบับร่าง");
    rfq.quotes.splice(at, 1);
    return changed(rfq, who);
  }),

  // admin.rfqs.sendQuotation (`rfqs.manage`, optional Idempotency-Key): supersedes the version
  // before it; RFQ → quoted.
  http.post("*/v1/admin/rfq-quotations/:rfqQuoteId/actions/send", async ({ params, request }) => {
    const refused = badKey(request);
    if (refused) return refused;
    return once(request, () => {
      const rfq = findByQuote(params.rfqQuoteId);
      const quote = rfq?.quotes.find((candidate) => candidate.id === params.rfqQuoteId);
      if (quote && quote.status !== "draft") {
        const who = staffPersonaOf(request);
        if (!who || !can(who, "rfqs.manage")) return forbidden();
        return problem(409, "rfq.quote_not_draft", "ส่งได้เฉพาะฉบับร่าง");
      }
      if (quote && quote.lines.length === 0) return problem(422, "rfq.quote_empty", "ฉบับร่างยังไม่มีรายการ");
      const found = managePublished(request, rfq, "rfq.send_quote");
      if (found instanceof Response) return found;
      const { who } = found;
      for (const other of found.rfq.quotes) if (other.status === "sent") other.status = "superseded";
      quote!.status = "sent";
      quote!.sentAt = bangkokIso();
      quote!.validUntil = validityFromToday();
      found.rfq.status = "quoted";
      found.rfq.firstResponseAt ??= quote!.sentAt;
      log(found.rfq, "rfq.quote_sent", `ส่งใบเสนอราคาฉบับที่ ${quote!.versionNo} ให้ลูกค้า`, who);
      return changed(found.rfq, who);
    });
  }),

  // admin.rfqs.recordAcceptance (`rfqs.manage`, Idempotency-Key required): the customer's
  // acceptance by phone, LINE or e-mail, the same path as the customer's own.
  http.post("*/v1/admin/rfq-quotations/:rfqQuoteId/actions/record-acceptance", async ({ params, request }) => {
    const refused = badKey(request, true);
    if (refused) return refused;
    return once(request, async () => {
      const who = staffPersonaOf(request);
      if (!who || !can(who, "rfqs.manage")) return forbidden();
      const rfq = findByQuote(params.rfqQuoteId);
      const quote = rfq?.quotes.find((candidate) => candidate.id === params.rfqQuoteId);
      if (!rfq || !quote) return httpNotFound();
      if (rfq.status !== "quoted" || quote.status !== "sent" || Date.parse(validityOf(quote)) <= Date.now())
        return problem(409, "rfq.quote_not_open", "บันทึกการตอบรับได้เฉพาะฉบับที่ส่งให้ลูกค้าแล้วและยังไม่หมดอายุ");
      const body = await bodyOf<Schemas["RecordRfqAcceptanceDto"]>(request);
      if (!body?.via)
        return problem(422, "validation.failed", "กรุณาระบุช่องทางที่ลูกค้าตอบรับ", [
          { path: "via", code: "required", message: "required" },
        ]);
      const quantities = body.quantities?.length ? body.quantities : quote.lines.map((line) => line.quantity);
      if (!quote.lines.some((line) => quantities.includes(line.quantity)))
        return problem(422, "validation.failed", "จำนวนนี้ไม่มีในใบเสนอราคา", [
          { path: "quantities", code: "invalid", message: "no quoted quantity matches" },
        ]);
      quote.status = "accepted";
      quote.acceptedAt = bangkokIso();
      rfq.status = "accepted";
      rfq.acceptedQuotation = toQuotation(rfq, quote, quantities, who);
      log(
        rfq,
        "rfq.accepted",
        `ลูกค้าตอบรับฉบับที่ ${quote.versionNo} (บันทึกโดย CS ทาง ${body.via}${body.note ? `: ${body.note}` : ""})`,
        who,
      );
      return changed(rfq, who);
    });
  }),

  // admin.files.download for the files sent with a request; any other falls through.
  http.get("*/v1/admin/files/:fileId/download", ({ params, request }) => {
    const file = rfqs.flatMap((rfq) => rfq.files).find((item) => item.id === params.fileId);
    if (!file?.url) return undefined;
    if (!can(staffPersonaOf(request), "rfqs.read")) return undefined;
    return HttpResponse.json({ url: file.url, expiresAt: bangkokIso(5) } satisfies Schemas["DownloadUrlDto"]);
  }),
];
