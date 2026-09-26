/**
 * The CS sales desk, mocked: calculator input data and results, quotations, discount memos
 * and CS create-order (CONTRACT-REQUEST admin.cs-calculators, admin.quotations,
 * admin.discount-memos, admin.cs-create-order).
 *
 * **The prices are illustrative, not the legacy maths.** The seven calculators are ported with
 * golden tests in packio-api B2.3; this only has to produce rows with the right shape and a
 * plausible spread so the screen can be built and tested. Discount memos go through the same
 * approvals mock as everything else, so a memo raised here appears in a Director's inbox.
 */

import type { z } from "zod";

import type { csCalculation, csInputData, discountMemo, quotationDetail } from "@/lib/api/requests/admin-sales";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";
import { productTypeOfCalculator, productTypeRef } from "./catalog";
import { baht, customers, FACTORY, orders } from "./commerce";
import { approvals, settings } from "./platform";

type InputData = z.output<typeof csInputData>;
type Calculation = z.output<typeof csCalculation>;
type Quotation = z.output<typeof quotationDetail>;
type Memo = z.output<typeof discountMemo>;

const opt = (
  code: string,
  name: string,
  meta: InputData["options"][string][number]["meta"] = {},
  group: string | null = null,
) => ({ code, name, group, meta });

const PATTERNS: InputData["patterns"] = [
  {
    code: "rsc",
    name: "กล่องฝาเสียบ (RSC)",
    subPatterns: [
      { code: "rsc_tuck", name: "ฝาเสียบบน-ล่าง" },
      { code: "rsc_lock", name: "ฝาเสียบบน ล็อกก้น" },
    ],
    constraints: {
      minLengthMm: 30,
      maxLengthMm: 400,
      minWidthMm: 20,
      maxWidthMm: 300,
      minHeightMm: 20,
      maxHeightMm: 400,
      lengthMustExceedWidth: true,
    },
    standardSizes: [
      { code: "s", label: "S 80 × 60 × 40", lengthMm: 80, widthMm: 60, heightMm: 40 },
      { code: "m", label: "M 120 × 80 × 60", lengthMm: 120, widthMm: 80, heightMm: 60 },
    ],
  },
  {
    code: "tray",
    name: "กล่องถาดพับ",
    subPatterns: [],
    constraints: {
      minLengthMm: 50,
      maxLengthMm: 450,
      minWidthMm: 40,
      maxWidthMm: 350,
      minHeightMm: 15,
      maxHeightMm: 150,
      lengthMustExceedWidth: false,
    },
    standardSizes: [],
  },
];

function inputData(type: InputData["type"], directLimitPct: string): InputData {
  const base: InputData = {
    type,
    factories: [FACTORY],
    printTypes: [
      { code: "offset", name: "ออฟเซ็ต" },
      { code: "digital", name: "ดิจิทัล" },
    ],
    patterns: ["folding", "corrugate"].includes(type) ? PATTERNS : [],
    options: {},
    quantityPresets: [500, 1000, 2000, 3000, 5000],
    discountPolicy: { directLimitPct },
  };
  switch (type) {
    case "folding":
      base.options = {
        materials: [
          opt("artcard", "อาร์ตการ์ด", { gsm: [230, 260, 300, 350] }, "กระดาษ"),
          opt("kraft", "กระดาษคราฟท์", { gsm: [250, 300] }, "กระดาษ"),
          opt("greyback", "กล่องแป้งหลังเทา", { gsm: [300, 350, 400] }, "กระดาษ"),
        ],
        finishes: [
          opt("matt_lam", "เคลือบด้าน", { needsArea: false }, "เคลือบ"),
          opt("gloss_lam", "เคลือบเงา", { needsArea: false }, "เคลือบ"),
          opt("spot_uv", "สปอตยูวี", { needsArea: true }, "พิเศษ"),
          opt("hot_foil", "ปั๊มฟอยล์", { needsArea: true }, "พิเศษ"),
          opt("emboss", "ปั๊มนูน", { needsArea: true }, "พิเศษ"),
        ],
        diecutGroups: [opt("standard", "ไดคัทมาตรฐาน"), opt("window", "เจาะหน้าต่าง")],
        assemblies: [opt("glue_side", "ปะกาวข้าง"), opt("glue_lock", "ปะกาวล็อกก้น")],
        difficultyLevels: [opt("normal", "ปกติ"), opt("hard", "ยาก")],
      };
      break;
    case "corrugate":
      base.options = {
        flutes: [opt("e", "ลอน E"), opt("b", "ลอน B"), opt("c", "ลอน C"), opt("bc", "ลอน BC (2 ชั้น)")],
        paperGrades: [opt("ka125", "KA125"), opt("ki150", "KI150"), opt("kt185", "KT185")],
      };
      break;
    case "label":
      base.options = {
        shapes: [opt("rect", "สี่เหลี่ยม"), opt("round", "วงกลม"), opt("oval", "วงรี"), opt("custom", "ไดคัทตามรูป")],
        materials: [opt("pp_white", "PP ขาว"), opt("pp_clear", "PP ใส"), opt("paper_gloss", "กระดาษเคลือบเงา")],
        finishes: [
          opt("gloss_lam", "เคลือบเงา", { needsArea: false }),
          opt("matt_lam", "เคลือบด้าน", { needsArea: false }),
        ],
      };
      break;
    case "tag_sleeve":
      base.options = {
        materials: [
          opt("artcard", "อาร์ตการ์ด", { gsm: [260, 300, 350] }),
          opt("kraft", "กระดาษคราฟท์", { gsm: [250, 300] }),
        ],
        finishes: [
          opt("matt_lam", "เคลือบด้าน", { needsArea: false }),
          opt("hot_foil", "ปั๊มฟอยล์", { needsArea: true }),
        ],
      };
      break;
    case "pouch":
      base.options = {
        pouchTypes: [
          opt("stand_up", "ซองตั้งได้"),
          opt("three_side", "ซองซีล 3 ด้าน"),
          opt("flat_bottom", "ซองก้นแบน"),
        ],
        materials: [opt("pet_pe", "PET/PE"), opt("pet_al_pe", "PET/AL/PE (กันแสง)"), opt("kraft_pe", "คราฟท์/PE")],
        microns: [
          opt("80", "80 ไมครอน", { micron: 80 }),
          opt("100", "100 ไมครอน", { micron: 100 }),
          opt("120", "120 ไมครอน", { micron: 120 }),
        ],
      };
      break;
    case "standard_product":
      base.options = {
        products: [
          opt("std_box_s", "กล่องไปรษณีย์ไซซ์ S", { unit: "ใบ" }),
          opt("std_bag_kraft", "ถุงกระดาษคราฟท์ M", { unit: "ใบ" }),
          opt("std_tape", "เทปพิมพ์โลโก้ 2 นิ้ว", { unit: "ม้วน" }),
        ],
      };
      base.quantityPresets = [50, 100, 500, 1000];
      break;
    case "service":
      base.options = {
        services: [
          opt("design", "ออกแบบลายกล่อง", { unit: "งาน" }),
          opt("structure", "ออกแบบโครงสร้าง", { unit: "งาน" }),
          opt("mockup", "ม็อกอัปตัวอย่าง", { unit: "ชิ้น" }),
          opt("plate", "ทำเพลต", { unit: "ชุด" }),
          opt("delivery", "ค่าจัดส่งเพิ่ม", { unit: "เที่ยว" }),
        ],
      };
      base.quantityPresets = [1];
      break;
  }
  return base;
}

/** Satang per piece, before quantity breaks — a plausible spread, nothing more. */
const BASE: Record<InputData["type"], number> = {
  folding: 850,
  corrugate: 1650,
  label: 90,
  tag_sleeve: 240,
  pouch: 620,
  standard_product: 1500,
  service: 250000,
};

const calculations = new Map<string, Calculation & { customerId?: string }>();

const seedCustomer = (index: number) => {
  const customer = customers[index]!;
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    displayName: customer.displayName,
    companyName: customer.companyName,
  };
};

/** Two quotations CS saved earlier, so the list and the create-order flow have something real. */
export const quotations: Quotation[] = [
  {
    id: mockId("quo", 900),
    quoteCode: "QT-2569-00118",
    source: "instant",
    rfq: null,
    customer: seedCustomer(1),
    productType: productTypeRef("folding_carton"),
    quantities: [3000],
    grossAmount: "38520.00",
    currency: "THB",
    status: "saved",
    channel: "cs",
    validUntil: bangkokIso(60 * 24 * 12),
    createdBy: { id: "00000000-0000-4000-8000-000000005106", displayName: "สมชาย ตัวอย่าง (ข้อมูลจำลอง)" },
    createdAt: bangkokIso(-60 * 24 * 3),
    specs: [
      { label: "รูปแบบ", value: "กล่องฝาเสียบ (RSC)" },
      { label: "ขนาด", value: "120 × 80 × 60 มม." },
      { label: "วัสดุ", value: "อาร์ตการ์ด 350 แกรม" },
    ],
    options: [
      {
        quantity: 3000,
        unitPrice: "10.500000",
        netAmount: "31500.00",
        discountAmount: "0.00",
        vatAmount: "2520.00",
        grossAmount: "38520.00",
        leadTimeDays: 12,
        earliestShipDate: bangkokIso(60 * 24 * 16).slice(0, 10),
      },
    ],
    discount: null,
    pdf: null,
    nextActions: [{ key: "quote.export_pdf" }, { key: "quote.create_order" }],
  },
  {
    id: mockId("quo", 901),
    quoteCode: "QT-2569-00121",
    source: "instant",
    rfq: null,
    customer: seedCustomer(0),
    productType: productTypeRef("label_sticker"),
    quantities: [5000],
    grossAmount: "4494.00",
    currency: "THB",
    status: "expired",
    channel: "web",
    validUntil: bangkokIso(-60 * 24 * 2),
    createdBy: null,
    createdAt: bangkokIso(-60 * 24 * 17),
    specs: [{ label: "ขนาด", value: "50 × 50 มม." }],
    options: [
      {
        quantity: 5000,
        unitPrice: "0.800000",
        netAmount: "4000.00",
        discountAmount: "0.00",
        vatAmount: "280.00",
        grossAmount: "4494.00",
        leadTimeDays: 5,
        earliestShipDate: bangkokIso(-60 * 24).slice(0, 10),
      },
    ],
    discount: null,
    pdf: null,
    nextActions: [],
  },
];

/** The memos behind the two discount-memo approvals the platform mock seeds. */
const memos: Memo[] = [
  {
    id: mockId("subj", 1),
    memoCode: "DM-2569-00001",
    status: "pending_approval",
    customer: seedCustomer(1),
    requestedBy: { id: "00000000-0000-4000-8000-000000005106", displayName: "สมชาย ตัวอย่าง (ข้อมูลจำลอง)" },
    orderValue: "86400.00",
    requestedPct: "8.0000",
    requestedAmount: "6912.00",
    approvedPct: null,
    resultingMarginPct: "17.5000",
    belowMarginFloor: false,
    reason: "ลูกค้าเทียบราคากับคู่แข่ง ขอส่วนลดเพื่อปิดการขาย",
    evidence: [],
    approvalRequestId: mockId("appr", 1),
    validUntil: bangkokIso(60 * 24 * 14),
    createdAt: bangkokIso(-53),
  },
  {
    id: mockId("subj", 2),
    memoCode: "DM-2569-00002",
    status: "pending_approval",
    customer: seedCustomer(0),
    requestedBy: { id: "00000000-0000-4000-8000-000000005106", displayName: "สมชาย ตัวอย่าง (ข้อมูลจำลอง)" },
    orderValue: "24500.00",
    requestedPct: "18.0000",
    requestedAmount: "4410.00",
    approvedPct: null,
    resultingMarginPct: "8.2000",
    belowMarginFloor: true,
    reason: "ลูกค้าประจำ สั่งซ้ำทุกเดือน",
    evidence: [],
    approvalRequestId: mockId("appr", 2),
    validUntil: bangkokIso(60 * 24 * 14),
    createdAt: bangkokIso(-106),
  },
];

function calculate(type: InputData["type"], quantities: number[], showMargin: boolean): Calculation {
  const results: Calculation["results"] = [];
  for (const printType of [
    { code: "offset", name: "ออฟเซ็ต" },
    { code: "digital", name: "ดิจิทัล" },
  ]) {
    for (const quantity of quantities) {
      const breakFactor = quantity >= 5000 ? 0.62 : quantity >= 2000 ? 0.74 : quantity >= 1000 ? 0.86 : 1;
      const digital = printType.code === "digital";
      const unit = Math.round(BASE[type] * breakFactor * (digital ? (quantity <= 1000 ? 0.9 : 1.35) : 1));
      const net = unit * quantity;
      const plate = digital || type === "service" ? 0 : 180000;
      const dieBlock = ["folding", "corrugate", "label"].includes(type) && !digital ? 150000 : 0;
      const shipping = 45000;
      const design = 0;
      const vat = Math.round((net + plate + dieBlock + shipping + design) * 0.07);
      const gross = net + plate + dieBlock + shipping + design + vat;
      results.push({
        id: `${printType.code}-${quantity}`,
        factory: FACTORY,
        printType,
        quantity,
        unitPrice: (unit / 100).toFixed(6),
        perPieceWithDelivery: ((net + shipping) / 100 / quantity).toFixed(6),
        netAmount: baht(net),
        plateAmount: baht(plate),
        dieBlockAmount: baht(dieBlock),
        shippingAmount: baht(shipping),
        designFeeAmount: baht(design),
        vatAmount: baht(vat),
        grossAmount: baht(gross),
        currency: "THB",
        leadTimeDays: digital ? 5 : 12,
        earliestShipDate: bangkokIso(60 * 24 * (digital ? 7 : 16)).slice(0, 10),
        toleranceShortagePct: "5",
        toleranceOveragePct: "5",
        cheapest: false,
        fastest: false,
        ...(showMargin ? { marginPct: digital ? "22.5000" : "31.0000", belowMarginFloor: false } : {}),
      });
    }
  }
  // "The API marks the best rows" — per quantity, cheapest by gross and fastest by lead time.
  for (const quantity of quantities) {
    const rows = results.filter((row) => row.quantity === quantity);
    const cheapest = rows.reduce((best, row) => (Number(row.grossAmount) < Number(best.grossAmount) ? row : best));
    const fastest = rows.reduce((best, row) => (row.leadTimeDays < best.leadTimeDays ? row : best));
    cheapest.cheapest = true;
    fastest.fastest = true;
  }
  return {
    calculationId: mockId("calc", calculations.size + 1 + Math.floor(Math.random() * 1e5)),
    type,
    validUntil: bangkokIso(60 * 24 * 15),
    specs: [],
    results,
    notes: type === "corrugate" ? ["ลอน BC ขนาดนี้พิมพ์ดิจิทัลไม่ได้ จึงไม่มีราคาแบบดิจิทัลบางรายการ"] : [],
    routeToRfq: false,
  };
}

function directLimit(): string {
  const setting = settings.find((candidate) => candidate.key === "discounts.cs_limit_pct");
  return typeof setting?.current?.value === "string" ? setting.current.value : "5";
}

export const salesHandlers = [
  mockRequest("GET /v1/admin/cs/{type}/input-data", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "cs.calculate"))
      return problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ใช้เครื่องคำนวณราคา");
    const types = ["folding", "corrugate", "label", "tag_sleeve", "pouch", "standard_product", "service"] as const;
    const type = types.find((candidate) => candidate === params.type);
    if (!type) return problem(404, "cs.unknown_calculator", "ไม่พบเครื่องคำนวณนี้");
    return inputData(type, directLimit());
  }),
  mockRequest("POST /v1/admin/cs/{type}/calculate", ({ params, body, request }) => {
    const persona = staffPersonaOf(request);
    if (!can(persona, "cs.calculate")) return problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ใช้เครื่องคำนวณราคา");
    if (body.input.calculator !== params.type) {
      return problem(422, "validation.failed", "ชนิดเครื่องคำนวณไม่ตรงกับข้อมูล", [
        { path: "input.calculator", code: "equals", message: "ไม่ตรงกับเครื่องคำนวณ" },
      ]);
    }
    const input = body.input;
    if (input.calculator === "folding" || input.calculator === "corrugate") {
      const pattern = PATTERNS.find((candidate) => candidate.code === input.pattern);
      if (pattern?.constraints.lengthMustExceedWidth && input.lengthMm < input.widthMm) {
        return problem(422, "validation.failed", "ความยาวต้องมากกว่าความกว้างสำหรับรูปแบบนี้", [
          { path: "input.lengthMm", code: "gteWidth", message: "ความยาวต้องมากกว่าความกว้าง" },
        ]);
      }
    }
    const result = calculate(
      body.input.calculator,
      body.quantities,
      can(persona, "margin.read_pct_when_discounting") || can(persona, "margin.read"),
    );
    const specs =
      body.input.calculator === "service"
        ? body.input.services.map((service) => ({ label: service.code, value: String(service.quantity) }))
        : Object.entries(body.input)
            .filter(([key]) => key !== "calculator")
            .map(([label, value]) => ({
              label,
              value: typeof value === "object" ? JSON.stringify(value) : String(value),
            }));
    const calculation = { ...result, specs, customerId: body.customerId };
    calculations.set(calculation.calculationId, calculation);
    const { customerId, ...response } = calculation;
    void customerId;
    return response;
  }),

  mockRequest("GET /v1/admin/quotations", ({ query }) => {
    const rows = quotations
      .filter((quote) => !query.status || quote.status === query.status)
      .filter((quote) => !query.customerId || quote.customer.id === query.customerId)
      .filter((quote) => matchesQuery(query.q, quote.quoteCode, quote.customer.displayName));
    return paginate(sortBy(rows, query.sort ?? "createdAt", query.order ?? "desc"), query);
  }),
  mockRequest("POST /v1/admin/quotations", ({ body, request }) => {
    const persona = staffPersonaOf(request)!;
    const calculation = calculations.get(body.calculationId);
    if (!calculation) return problem(404, "cs.calculation_expired", "ผลการคำนวณหมดอายุแล้ว กรุณาคำนวณใหม่");
    const row = calculation.results.find((candidate) => candidate.id === body.resultId);
    const customer = customers.find((candidate) => candidate.id === body.customerId);
    if (!row || !customer) return problem(404, "http.not_found", "ไม่พบรายการที่เลือก");
    const limit = Number(directLimit());
    const memo = body.discountMemoId ? memos.find((candidate) => candidate.id === body.discountMemoId) : undefined;
    if (body.discountMemoId && memo?.status !== "approved")
      return problem(409, "memo.not_approved", "บันทึกขอส่วนลดยังไม่ได้รับอนุมัติ");
    if (!memo && body.discountPct && Number(body.discountPct) > limit) {
      return problem(422, "discount.above_cs_limit", `ส่วนลดเกิน ${limit}% ต้องขออนุมัติผ่านบันทึกขอส่วนลด`, [
        { path: "discountPct", code: "max", message: `ไม่เกิน ${limit}%` },
      ]);
    }
    const pctValue = memo?.approvedPct ?? body.discountPct ?? null;
    const net = Math.round(Number(row.netAmount) * 100);
    const discount = pctValue ? Math.round((net * Number(pctValue)) / 100) : 0;
    const vat = Math.round(
      (net -
        discount +
        Number(row.shippingAmount) * 100 +
        Number(row.plateAmount) * 100 +
        Number(row.dieBlockAmount) * 100) *
        0.07,
    );
    const gross =
      net -
      discount +
      Math.round(Number(row.shippingAmount) * 100 + Number(row.plateAmount) * 100 + Number(row.dieBlockAmount) * 100) +
      vat;
    const quote: Quotation = {
      id: mockId("quo", quotations.length + 1),
      quoteCode: `QT-2569-${String(200 + quotations.length).padStart(5, "0")}`,
      source: "instant",
      rfq: null,
      customer: {
        id: customer.id,
        customerCode: customer.customerCode,
        displayName: customer.displayName,
        companyName: customer.companyName,
      },
      productType: productTypeOfCalculator(calculation.type),
      quantities: [row.quantity],
      grossAmount: baht(gross),
      currency: "THB",
      status: "saved",
      channel: "cs",
      validUntil: calculation.validUntil,
      createdBy: { id: persona.id, displayName: persona.displayName },
      createdAt: bangkokIso(),
      specs: calculation.specs,
      options: [
        {
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          netAmount: baht(net),
          discountAmount: baht(discount),
          vatAmount: baht(vat),
          grossAmount: baht(gross),
          leadTimeDays: row.leadTimeDays,
          earliestShipDate: row.earliestShipDate,
        },
      ],
      discount: pctValue ? { pct: pctValue, memo: memo ? { id: memo.id, status: memo.status } : null } : null,
      pdf: null,
      nextActions: [{ key: "quote.export_pdf" }, { key: "quote.create_order" }],
    };
    quotations.unshift(quote);
    if (memo) memo.status = "applied";
    return quote;
  }),
  mockRequest(
    "GET /v1/admin/quotations/{quoteId}",
    ({ params }) =>
      quotations.find((quote) => quote.id === params.quoteId) ?? problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้"),
  ),
  mockRequest("POST /v1/admin/quotations/{quoteId}/actions/export-pdf", ({ params }) => {
    const quote = quotations.find((candidate) => candidate.id === params.quoteId);
    if (!quote) return problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");
    const text = `ใบเสนอราคา ${quote.quoteCode}\nบริษัท Collective Group (Thailand) — Packio\nยอดรวม ${quote.grossAmount} บาท (ข้อมูลจำลอง)`;
    return { url: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`, expiresAt: bangkokIso(5) };
  }),

  mockRequest("POST /v1/admin/discount-memos", ({ body, request }) => {
    const persona = staffPersonaOf(request)!;
    const calculation = calculations.get(body.calculationId);
    const row = calculation?.results.find((candidate) => candidate.id === body.resultId);
    const customer = customers.find((candidate) => candidate.id === body.customerId);
    if (!calculation || !row || !customer)
      return problem(404, "cs.calculation_expired", "ผลการคำนวณหมดอายุแล้ว กรุณาคำนวณใหม่");
    const requested = Number(body.requestedPct);
    const role = requested > 15 ? "c_level" : requested > 10 ? "vp" : "director";
    const margin = 31 - requested;
    const memo: Memo = {
      id: mockId("mem", memos.length + 1),
      memoCode: `DM-2569-${String(10 + memos.length).padStart(5, "0")}`,
      status: "pending_approval",
      customer: {
        id: customer.id,
        customerCode: customer.customerCode,
        displayName: customer.displayName,
        companyName: customer.companyName,
      },
      requestedBy: { id: persona.id, displayName: persona.displayName },
      orderValue: row.netAmount,
      requestedPct: body.requestedPct,
      requestedAmount: baht(Math.round((Math.round(Number(row.netAmount) * 100) * requested) / 100)),
      approvedPct: null,
      resultingMarginPct: `${margin.toFixed(4)}`,
      belowMarginFloor: margin < 10,
      reason: body.reason,
      evidence: [],
      approvalRequestId: mockId("appr", 100 + memos.length),
      validUntil: calculation.validUntil,
      createdAt: bangkokIso(),
    };
    memos.unshift(memo);
    // The memo enters the generic approvals engine, routed to the matching tier only (D-162).
    approvals.unshift({
      id: memo.approvalRequestId!,
      policy: "discount_memo",
      subjectType: "discount_memo",
      subjectId: memo.id,
      status: "pending",
      requester: memo.requestedBy,
      amount: memo.requestedAmount,
      currency: "THB",
      pct: `${requested.toFixed(4)}`,
      flags: memo.belowMarginFloor ? ["below_margin_floor"] : [],
      payload: {
        customerName: customer.displayName,
        orderValue: memo.orderValue,
        requestedPct: `${requested.toFixed(4)}`,
        resultingMarginPct: memo.resultingMarginPct,
        reason: body.reason,
      },
      currentStepNo: 1,
      steps: [
        {
          stepNo: 1,
          role: memo.belowMarginFloor ? "c_level" : role,
          quorum: 1,
          status: "pending",
          dueAt: bangkokIso(60 * 8),
          completedAt: null,
        },
      ],
      actions: [],
      createdAt: bangkokIso(),
      expiresAt: memo.validUntil,
      decidedAt: null,
    });
    return memo;
  }),
  mockRequest("GET /v1/admin/discount-memos", ({ query }) => {
    for (const memo of memos) {
      // Follow the approval, as the backend's subscriber would.
      const approval = approvals.find((candidate) => candidate.id === memo.approvalRequestId);
      if (memo.status === "pending_approval" && approval && approval.status !== "pending") {
        memo.status =
          approval.status === "approved" ? "approved" : approval.status === "rejected" ? "rejected" : "withdrawn";
        if (memo.status === "approved") memo.approvedPct = memo.requestedPct;
      }
    }
    const rows = memos
      .filter((memo) => !query.status || memo.status === query.status)
      .filter((memo) => matchesQuery(query.q, memo.memoCode, memo.customer.displayName));
    return paginate(rows, query);
  }),
  mockRequest(
    "GET /v1/admin/discount-memos/{memoId}",
    ({ params }) =>
      memos.find((memo) => memo.id === params.memoId) ?? problem(404, "http.not_found", "ไม่พบบันทึกขอส่วนลดนี้"),
  ),

  mockRequest("POST /v1/admin/orders", ({ body }) => {
    const quote = quotations.find((candidate) => candidate.id === body.quoteId);
    if (!quote) return problem(404, "http.not_found", "ไม่พบใบเสนอราคานี้");
    const total = body.destinations.reduce((sum, destination) => sum + destination.quantity, 0);
    if (total !== body.quantity) {
      return problem(422, "validation.failed", "จำนวนที่แบ่งส่งรวมกันต้องเท่ากับจำนวนที่สั่ง", [
        { path: "destinations", code: "sum", message: "ผลรวมไม่เท่ากับจำนวนที่สั่ง" },
      ]);
    }
    const groupNo = 900 + orders.length;
    quote.status = "converted";
    // A real order row, so the new order opens and shows up in รอชำระ.
    const template = orders.find((order) => order.status === "waiting_payment")!;
    const id = mockId("ord", groupNo);
    const orderCode = `PK-2569-${String(groupNo).padStart(5, "0")}`;
    orders.unshift({
      ...structuredClone(template),
      id,
      orderCode,
      groupId: mockId("grp", groupNo),
      groupCode: `PG-2569-${String(groupNo).padStart(5, "0")}`,
      channel: "cs",
      customer: quote.customer,
      quantity: body.quantity,
      grossAmount: quote.grossAmount,
      createdAt: bangkokIso(),
      csRemarks: body.csRemarks ?? null,
      poNumber: body.poNumber ?? null,
    });
    return {
      groupId: mockId("grp", groupNo),
      groupCode: `PG-2569-${String(groupNo).padStart(5, "0")}`,
      orders: [{ id, orderCode }],
    };
  }),
];
