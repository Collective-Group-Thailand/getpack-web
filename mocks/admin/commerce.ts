/**
 * Commerce mocks: customers, orders and groups, the CS queues, order actions, notes and
 * timelines (CONTRACT-REQUEST admin.orders, admin.order-notes, admin.order-actions,
 * admin.customers, admin.geo).
 *
 * The seed is deterministic and obviously fake. Amounts are computed here in whole satang —
 * the mock stands in for the backend, which is the only place money is ever computed — and
 * leave as the two-decimal strings the contract uses. Order state follows B3.1: statuses are
 * moved by facts (a slip approved, production started), never set directly.
 */

import type { z } from "zod";

import type { customerDetail, customerSummary } from "@/lib/api/requests/admin-customers";
import type { orderDetail, orderNote, orderSummary, timelineEntry } from "@/lib/api/requests/admin-orders";

import { staffPersonaOf } from "../auth";
import { PERSONAS } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";
import { productTypeRef } from "./catalog";
import { indexForSearch, registerQueue } from "./console";

type Order = z.output<typeof orderDetail>;
type OrderSummary = z.output<typeof orderSummary>;
type Customer = z.output<typeof customerDetail>;
type CustomerSummary = z.output<typeof customerSummary>;
type Note = z.output<typeof orderNote>;
type TimelineEntry = z.output<typeof timelineEntry>;

/* -------------------------------------------------------------------------- money, in satang */

export const baht = (satang: number) => {
  const sign = satang < 0 ? "-" : "";
  const abs = Math.abs(Math.round(satang));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
};
export const satang = (amount: string) => Math.round(Number(amount) * 100);
const vatOf = (net: number) => Math.round(net * 0.07);

/* -------------------------------------------------------------------------------- customers */

let companyMembers: (companyId: string) => string[] = () => [];
/** The companies mock says who belongs to a company, for the orders filter (no import cycle). */
export function setCompanyMembers(lookup: (companyId: string) => string[]): void {
  companyMembers = lookup;
}

const FAKE_CUSTOMERS: [string, "individual" | "juristic", string | null][] = [
  ["ร้านกาแฟตัวอย่าง", "individual", null],
  ["บริษัท ตัวอย่างขนม จำกัด", "juristic", "บริษัท ตัวอย่างขนม จำกัด"],
  ["แบรนด์สกินแคร์ตัวอย่าง", "juristic", "บริษัท สกินแคร์ตัวอย่าง จำกัด"],
  ["คุณสมศรี ตัวอย่าง", "individual", null],
  ["ร้านเบเกอรี่ตัวอย่าง", "individual", null],
  ["บริษัท ตัวอย่างเครื่องสำอาง จำกัด", "juristic", "บริษัท ตัวอย่างเครื่องสำอาง จำกัด"],
  ["ร้านชาไทยตัวอย่าง", "individual", null],
  ["บริษัท ตัวอย่างอาหารเสริม จำกัด", "juristic", "บริษัท ตัวอย่างอาหารเสริม จำกัด"],
  ["คุณวิชัย ตัวอย่าง", "individual", null],
  ["ร้านของขวัญตัวอย่าง", "individual", null],
  ["บริษัท ตัวอย่างสมุนไพร จำกัด", "juristic", "บริษัท ตัวอย่างสมุนไพร จำกัด"],
  ["คุณนภา ตัวอย่าง", "individual", null],
];

export type MockOrder = Order;
export type MockCommerceCustomer = Customer;

export const customers: Customer[] = FAKE_CUSTOMERS.map(([name, type, company], index) => {
  const id = mockId("cus", index + 1);
  const postcode = ["10110", "10400", "50200", "20000", "90110", "40000"][index % 6]!;
  const province = ["กรุงเทพมหานคร", "กรุงเทพมหานคร", "เชียงใหม่", "ชลบุรี", "สงขลา", "ขอนแก่น"][index % 6]!;
  return {
    id,
    customerCode: `C${String(250001 + index)}`,
    displayName: `${name} (ข้อมูลจำลอง)`,
    phone: `08${String(10000000 + index * 7919).slice(0, 8)}`,
    email: `customer${index + 1}@example.invalid`,
    customerType: type,
    companyName: company ? `${company} (ข้อมูลจำลอง)` : null,
    createdVia: index % 4 === 0 ? "cs" : "self",
    ordersCount: 0,
    createdAt: bangkokIso(-60 * 24 * (40 - index)),
    referralCode: `PK${String(1000 + index * 37)}`,
    loyalty: {
      tier: index % 5 === 1 ? "silver" : "member",
      availablePoints: (index * 37) % 400,
      spend12m: baht(((index * 91) % 60) * 100000),
    },
    lastOrderAt: null,
    birthDate: null,
    addresses: [
      {
        id: mockId("adr", index + 1),
        kind: "delivery",
        label: "ที่อยู่หลัก",
        recipientName: `ผู้รับ ${name}`,
        phone: `08${String(20000000 + index * 3571).slice(0, 8)}`,
        line1: `${10 + index}/${index + 1} ถนนตัวอย่าง`,
        line2: null,
        subdistrict: "แขวงตัวอย่าง",
        district: "เขตตัวอย่าง",
        province,
        postcode,
        isDefault: true,
      },
    ],
    taxProfiles:
      type === "juristic"
        ? [
            {
              id: mockId("tax", index + 1),
              taxType: "juristic",
              name: `${company} (ข้อมูลจำลอง)`,
              taxId: `0105${String(560000000 + index * 12345).slice(0, 9)}`,
              branchType: "head_office",
              branchCode: "00000",
              address: `${10 + index}/${index + 1} ถนนตัวอย่าง ${province} ${postcode}`,
              withholdsTax: index % 3 === 0,
              isDefault: true,
            },
          ]
        : [],
  };
});

const summaryOfCustomer = (customer: Customer): CustomerSummary => ({
  id: customer.id,
  customerCode: customer.customerCode,
  displayName: customer.displayName,
  phone: customer.phone,
  email: customer.email,
  customerType: customer.customerType,
  companyName: customer.companyName,
  createdVia: customer.createdVia,
  ordersCount: customer.ordersCount,
  createdAt: customer.createdAt,
});

/* ----------------------------------------------------------------------------------- orders */

const PRODUCT_TYPES = ["folding_carton", "corrugated", "label_sticker", "flexible_pouch", "tag_sleeve"].map(
  productTypeRef,
);

export const FACTORY = {
  id: "00000000-0000-4000-8000-0000000000f1",
  code: "F001",
  name: "โรงงานพาร์ตเนอร์ ตัวอย่าง (ข้อมูลจำลอง)",
};

type Seed = {
  status: Order["status"];
  artwork: Order["artworkStatus"];
  slip?: boolean;
  urgency?: Order["urgency"];
  shipDays?: number;
  /** Delivered this many days ago (negative) while the order still waits for its receipt (F3 3.6). */
  deliveredDays?: number;
};

/** The spread of states the queues are made of. */
const SEEDS: Seed[] = [
  ...Array.from({ length: 7 }, (): Seed => ({ status: "waiting_payment", artwork: "awaiting_upload" })),
  ...Array.from({ length: 4 }, (): Seed => ({ status: "waiting_payment", artwork: "uploaded", slip: true })),
  ...Array.from({ length: 5 }, (): Seed => ({ status: "paid_for_production", artwork: "awaiting_upload" })),
  ...Array.from({ length: 3 }, (): Seed => ({ status: "paid_for_production", artwork: "proof_sent" })),
  ...Array.from({ length: 4 }, (): Seed => ({ status: "artwork_approved", artwork: "approved" })),
  ...Array.from({ length: 6 }, (_, i): Seed => ({
    status: "in_production",
    artwork: "approved",
    urgency: i < 2 ? "late" : i < 4 ? "due_soon" : "normal",
    shipDays: i < 2 ? -2 : i < 4 ? 2 : 9,
  })),
  // The third was delivered yesterday, a little short within tolerance, and waits for its receipt.
  ...Array.from({ length: 3 }, (_, i): Seed => ({
    status: "shipping",
    artwork: "approved",
    shipDays: 0,
    ...(i === 2 ? { deliveredDays: -1 } : {}),
  })),
  ...Array.from({ length: 5 }, (): Seed => ({ status: "completed", artwork: "approved", shipDays: -10 })),
  { status: "cancelled", artwork: "awaiting_upload" },
];

function buildOrder(seed: Seed, index: number): Order {
  const customer = customers[index % customers.length]!;
  const productType = PRODUCT_TYPES[index % PRODUCT_TYPES.length]!;
  const quantity = [500, 1000, 2000, 3000, 5000, 10000][index % 6]!;
  const unitSatang = [1850, 1240, 690, 2475, 980, 3120][index % 6]!;
  const productNet = unitSatang * quantity;
  const plate = index % 3 === 0 ? 150000 : 0;
  const dieBlock = index % 4 === 0 ? 120000 : 0;
  const shipping = 35000 + (index % 5) * 5000;
  const designFee = index % 7 === 0 ? 150000 : 0;
  const discount = index % 6 === 1 ? Math.round(productNet * 0.05) : 0;
  const net = productNet + plate + dieBlock + designFee - discount;
  const vat = vatOf(net + shipping);
  const gross = net + shipping + vat;
  const orderCode = `PK-2569-${String(100 + index).padStart(5, "0")}`;
  const groupCode = `PG-2569-${String(60 + index).padStart(5, "0")}`;
  const createdAt = bangkokIso(-60 * (6 + index * 9));
  const id = mockId("ord", index + 1);
  const groupId = mockId("grp", index + 1);
  const paid = !["waiting_payment", "cancelled"].includes(seed.status);
  const split = gross >= 2000000; // D-020: THB 20,000 and above → 50 / 50.
  const deposit = split ? Math.round(gross / 2) : gross;

  const instalments: Order["instalments"] = split
    ? [
        {
          id: mockId("ins", index * 2 + 1),
          seq: 1,
          label: "มัดจำ 50%",
          dueTrigger: "at_checkout",
          requiredBefore: "production",
          dueAt: bangkokIso(-60 * index),
          grossAmount: baht(deposit),
          paidAmount: paid ? baht(deposit) : "0.00",
          status: paid ? "paid" : "due",
        },
        {
          id: mockId("ins", index * 2 + 2),
          seq: 2,
          label: "ส่วนที่เหลือก่อนจัดส่ง",
          dueTrigger: "before_shipping",
          requiredBefore: "shipping",
          dueAt: null,
          grossAmount: baht(gross - deposit),
          paidAmount: ["shipping", "completed"].includes(seed.status) ? baht(gross - deposit) : "0.00",
          status: ["shipping", "completed"].includes(seed.status) ? "paid" : "pending",
        },
      ]
    : [
        {
          id: mockId("ins", index * 2 + 1),
          seq: 1,
          label: "ชำระเต็มจำนวน",
          dueTrigger: "at_checkout",
          requiredBefore: "production",
          dueAt: bangkokIso(-60 * index),
          grossAmount: baht(gross),
          paidAmount: paid ? baht(gross) : "0.00",
          status: paid ? "paid" : seed.status === "cancelled" ? "cancelled" : "due",
        },
      ];

  const firstDue = instalments[0]!;
  const slips: Order["payments"][number]["slips"] = seed.slip
    ? [
        {
          id: mockId("slp", index + 1),
          file: {
            id: mockId("fil", index + 100),
            originalName: `slip-${orderCode}.jpg`,
            mimeType: "image/jpeg",
            sizeBytes: 184_320,
            thumbnailUrl: null,
            url: null,
          },
          declaredAmount: firstDue.grossAmount,
          declaredTransferredAt: bangkokIso(-50),
          verificationStatus: "manual_review",
          checks: { receiverMatched: true, amountMatched: index % 2 === 0, dateMatched: true, duplicate: false },
          slaDueAt: bangkokIso(index % 2 === 0 ? -30 : 150),
          reviewedBy: null,
          reviewNote: null,
          uploadedAt: bangkokIso(-55),
        },
      ]
    : [];

  const payments: Order["payments"] = paid
    ? [
        {
          id: mockId("pay", index + 1),
          method: index % 2 ? "scb_qr" : "bank_transfer_slip",
          status: "succeeded",
          amount: firstDue.grossAmount,
          feeAmount: "0.00",
          providerRef: `TXN${1000 + index}`,
          paidAt: bangkokIso(-60 * (5 + index * 8)),
          slips: [],
        },
      ]
    : seed.slip
      ? [
          {
            id: mockId("pay", index + 1),
            method: "bank_transfer_slip",
            status: "awaiting_verification",
            amount: firstDue.grossAmount,
            feeAmount: "0.00",
            providerRef: null,
            paidAt: null,
            slips,
          },
        ]
      : [];

  const promised =
    seed.shipDays !== undefined
      ? bangkokIso(60 * 24 * seed.shipDays).slice(0, 10)
      : paid
        ? bangkokIso(60 * 24 * 12).slice(0, 10)
        : null;
  const inProduction = ["in_production", "shipping", "completed"].includes(seed.status);

  const order: Order = {
    id,
    orderCode,
    groupId,
    groupCode,
    channel: index % 3 === 0 ? "cs" : "web",
    customer: {
      id: customer.id,
      customerCode: customer.customerCode,
      displayName: customer.displayName,
      companyName: customer.companyName,
    },
    productType,
    factory: paid ? FACTORY : null,
    quantity,
    unit: productType.code === "label" ? "ดวง" : "ชิ้น",
    netAmount: baht(net),
    discountAmount: baht(discount),
    shippingAmount: baht(shipping),
    vatAmount: baht(vat),
    grossAmount: baht(gross),
    currency: "THB",
    status: seed.status,
    artworkStatus: seed.artwork,
    nextInstalment: instalments.find((item) => item.status !== "paid") ?? null,
    hasSlipToReview: Boolean(seed.slip),
    promisedShipDate: promised,
    slaDueAt:
      seed.status === "waiting_payment"
        ? bangkokIso(60 * (12 - index))
        : seed.slip
          ? slips[0]!.slaDueAt
          : seed.artwork === "awaiting_upload" && paid
            ? bangkokIso(60 * (24 - index * 3))
            : null,
    urgency: seed.urgency ?? "normal",
    createdAt,
    group: {
      id: groupId,
      groupCode,
      status: seed.status === "cancelled" ? "cancelled" : paid ? "in_progress" : "waiting_payment",
      grossAmount: baht(gross),
      orderCount: 1,
    },
    specs: [
      { label: "รูปแบบ", value: productType.code === "folding_carton" ? "กล่องฝาเสียบ (RSC)" : productType.name },
      { label: "ขนาด", value: "120 × 80 × 60 มม." },
      { label: "วัสดุ", value: productType.code === "corrugated" ? "ลูกฟูก E-flute KA125" : "อาร์ตการ์ด 350 แกรม" },
      { label: "พิมพ์", value: "4 สี ด้านหน้า" },
      { label: "เคลือบ", value: index % 2 ? "เคลือบด้าน" : "ไม่เคลือบ" },
    ],
    parts: [
      {
        name: "ตัวกล่อง",
        specs: [{ label: "กระดาษ", value: "อาร์ตการ์ด 350 แกรม" }],
        unitPrice: baht(unitSatang).padEnd(4, "0"),
        netAmount: baht(productNet),
      },
      ...(index % 5 === 0
        ? [
            {
              name: "ถาดรองใน",
              specs: [{ label: "กระดาษ", value: "กล่องแป้ง 300 แกรม" }],
              unitPrice: "2.100000",
              netAmount: baht(210 * quantity),
            },
          ]
        : []),
    ],
    lines: [
      {
        lineNo: 1,
        lineType: "product",
        description: `${productType.name} ${quantity.toLocaleString("th-TH")} ชิ้น`,
        quantity: `${quantity}.000`,
        unit: "ชิ้น",
        unitPrice: (unitSatang / 100).toFixed(6),
        netAmount: baht(productNet - discount),
        vatAmount: baht(vatOf(productNet - discount)),
        grossAmount: baht(productNet - discount + vatOf(productNet - discount)),
        waivedReason: null,
      },
      ...(plate
        ? [
            {
              lineNo: 2,
              lineType: "plate" as const,
              description: "ค่าเพลต",
              quantity: "1.000",
              unit: "ชุด",
              unitPrice: (plate / 100).toFixed(6),
              netAmount: baht(plate),
              vatAmount: baht(vatOf(plate)),
              grossAmount: baht(plate + vatOf(plate)),
              waivedReason: null,
            },
          ]
        : []),
      ...(dieBlock
        ? [
            {
              lineNo: 3,
              lineType: "die_block" as const,
              description: "ค่าบล็อกไดคัท",
              quantity: "1.000",
              unit: "ชุด",
              unitPrice: (dieBlock / 100).toFixed(6),
              netAmount: baht(dieBlock),
              vatAmount: baht(vatOf(dieBlock)),
              grossAmount: baht(dieBlock + vatOf(dieBlock)),
              waivedReason: null,
            },
          ]
        : []),
      ...(designFee
        ? [
            {
              lineNo: 4,
              lineType: "design_fee" as const,
              description: "ค่าออกแบบ",
              quantity: "1.000",
              unit: "งาน",
              unitPrice: (designFee / 100).toFixed(6),
              netAmount: baht(designFee),
              vatAmount: baht(vatOf(designFee)),
              grossAmount: baht(designFee + vatOf(designFee)),
              waivedReason: null,
            },
          ]
        : []),
      {
        lineNo: 9,
        lineType: "shipping",
        description: "ค่าจัดส่ง",
        quantity: "1.000",
        unit: "เที่ยว",
        unitPrice: (shipping / 100).toFixed(6),
        netAmount: baht(shipping),
        vatAmount: baht(vatOf(shipping)),
        grossAmount: baht(shipping + vatOf(shipping)),
        waivedReason: null,
      },
    ],
    tolerance: { shortagePct: "5", overagePct: "5" },
    // The tenth customer (the storefront's `designer` persona) ordered with the online designer.
    designOption: designFee ? "hired_design" : index % customers.length === 9 ? "online_designer" : "own_file",
    mockupOption: "none",
    leadTimeDays: 12,
    confirmedProductionDate: inProduction ? bangkokIso(-60 * 24 * 3).slice(0, 10) : null,
    startMode: inProduction ? "auto" : null,
    destinations: [{ ...customer.addresses[0]!, id: mockId("dst", index + 1), quantity }],
    taxProfile: customer.taxProfiles[0]
      ? {
          name: customer.taxProfiles[0].name,
          taxId: customer.taxProfiles[0].taxId,
          branch: "สำนักงานใหญ่",
          address: customer.taxProfiles[0].address,
          withholdsTax: customer.taxProfiles[0].withholdsTax,
        }
      : null,
    poNumber: customer.customerType === "juristic" ? `PO-${7000 + index}` : null,
    instalments,
    payments,
    artwork: {
      status: seed.artwork,
      submissions:
        seed.artwork === "awaiting_upload"
          ? []
          : [
              {
                id: mockId("sub", index + 1),
                versionNo: 1,
                source: "upload",
                preflightStatus: seed.artwork === "uploaded" && index % 2 ? "passed_with_warnings" : "passed",
                findings:
                  seed.artwork === "uploaded" && index % 2
                    ? [
                        {
                          check: "low_resolution",
                          severity: "warn",
                          page: 1,
                          message: "ภาพด้านหน้าความละเอียด 220 ppi ต่ำกว่า 300 ppi",
                        },
                      ]
                    : [],
                files: [
                  {
                    id: mockId("fil", index + 200),
                    originalName: `${orderCode}-artwork.pdf`,
                    mimeType: "application/pdf",
                    sizeBytes: 4_812_390,
                    thumbnailUrl: null,
                    url: null,
                  },
                ],
                submittedAt: bangkokIso(-60 * 30),
                submittedBy: null,
              },
            ],
      proofs: ["proof_sent", "approved"].includes(seed.artwork)
        ? [
            {
              id: mockId("prf", index + 1),
              versionNo: 1,
              status: seed.artwork === "approved" ? "approved" : "pending_customer",
              sentAt: bangkokIso(-60 * 20),
              decidedAt: seed.artwork === "approved" ? bangkokIso(-60 * 10) : null,
              decisionChannel: seed.artwork === "approved" ? "web" : null,
              file: {
                id: mockId("fil", index + 300),
                originalName: `${orderCode}-proof-v1.pdf`,
                mimeType: "application/pdf",
                sizeBytes: 1_203_441,
                thumbnailUrl: null,
                url: null,
              },
              openAnnotations: 0,
            },
          ]
        : [],
    },
    jobs: inProduction
      ? [
          {
            id: mockId("job", index + 1),
            jobNo: `J-2569-${String(300 + index).padStart(5, "0")}`,
            kind: "production",
            factory: FACTORY,
            status: seed.status === "in_production" ? "in_progress" : "completed",
            acceptDueAt: null,
            promisedShipDate: promised,
            atRisk: seed.urgency === "late" || seed.urgency === "due_soon",
            milestones: ["รับงาน", "เตรียมวัตถุดิบ", "พิมพ์", "ไดคัท", "ตรวจคุณภาพ", "แพ็ก"].map((name, seq) => {
              const done = seed.status !== "in_production" || seq < 3;
              return {
                seq: seq + 1,
                key: `step_${seq + 1}`,
                name,
                status: done ? "completed" : seq === 3 ? "in_progress" : "pending",
                dueAt: bangkokIso(60 * 24 * (seq - 3)),
                completedAt: done ? bangkokIso(60 * 24 * (seq - 4)) : null,
                onTime: done ? seq !== 2 || seed.urgency !== "late" : null,
              };
            }),
          },
        ]
      : [],
    shipments: ["shipping", "completed"].includes(seed.status)
      ? [
          {
            id: mockId("shp", index + 1),
            shipmentNo: `S-2569-${String(500 + index).padStart(5, "0")}`,
            status: seed.status === "completed" || seed.deliveredDays !== undefined ? "delivered" : "in_transit",
            carrier: "factory_fleet",
            trackingNo: null,
            destination: customer.addresses[0]!,
            quantity,
            cartons: Math.ceil(quantity / 250),
            deliveredAt:
              seed.status === "completed"
                ? bangkokIso(-60 * 24 * 8)
                : seed.deliveredDays !== undefined
                  ? bangkokIso(60 * 24 * seed.deliveredDays)
                  : null,
            pod:
              seed.status === "completed" || seed.deliveredDays !== undefined
                ? {
                    receiverName: "ผู้รับ (ข้อมูลจำลอง)",
                    // 3 % short: within the default ± 5 % (D-163), credited pro rata (D-080).
                    deliveredQuantity: seed.deliveredDays !== undefined ? Math.floor(quantity * 0.97) : quantity,
                    capturedAt:
                      seed.deliveredDays !== undefined
                        ? bangkokIso(60 * 24 * seed.deliveredDays)
                        : bangkokIso(-60 * 24 * 8),
                    photos: [],
                  }
                : null,
          },
        ]
      : [],
    documents: paid
      ? [
          {
            id: mockId("doc", index + 1),
            type: "rc",
            number: `RC-2569-${String(800 + index).padStart(5, "0")}`,
            status: "issued",
            issuedAt: bangkokIso(-60 * (5 + index * 8)),
            grossAmount: firstDue.grossAmount,
            file: null,
          },
        ]
      : [],
    claims:
      seed.status === "completed" && index % 2 === 0
        ? [
            {
              id: mockId("clm", index + 1),
              claimNo: `CL-2569-${String(40 + index).padStart(5, "0")}`,
              type: "damaged",
              status: "under_review",
              submittedAt: bangkokIso(-60 * 24 * 2),
            },
          ]
        : [],
    margin: paid
      ? {
          buyCostNet: baht(Math.round(net * 0.72)),
          marginAmount: baht(net - Math.round(net * 0.72)),
          marginPct: "28.0000",
          belowMarginFloor: false,
        }
      : null,
    ccEmails: [],
    csRemarks: index % 8 === 0 ? "ลูกค้าขอให้โทรแจ้งก่อนส่งของ" : null,
    expiresAt: seed.status === "waiting_payment" ? bangkokIso(60 * 24 * 6) : null,
    cancelledAt: seed.status === "cancelled" ? bangkokIso(-60 * 24) : null,
    cancelReason: seed.status === "cancelled" ? "ลูกค้าขอยกเลิกก่อนชำระเงิน" : null,
    nextActions: [],
  };
  order.nextActions = nextActionsOf(order);
  return order;
}

/** What the API would offer on an order in this state (entity.next-actions). */
export function nextActionsOf(order: Order): Order["nextActions"] {
  const actions: Order["nextActions"] = [];
  if (order.hasSlipToReview) {
    actions.push({ key: "order.approve_slip", irreversible: true }, { key: "order.reject_slip" });
  }
  if (order.status === "waiting_payment") {
    actions.push({ key: "order.send_payment_reminder" }, { key: "order.record_slip", irreversible: true });
  }
  if (order.status === "paid_for_production" || order.status === "artwork_approved") {
    actions.push({
      key: "order.start_production",
      irreversible: true,
      disabledReason:
        order.artworkStatus === "approved"
          ? null
          : "ไฟล์งานยังไม่ได้รับการอนุมัติ — เริ่มผลิตด้วยมือได้เฉพาะกรณียกเว้น",
    });
  }
  if (["waiting_payment", "paid_for_production", "artwork_approved"].includes(order.status)) {
    actions.push({ key: "order.cancel", irreversible: true });
  }
  return actions;
}

export const orders: Order[] = SEEDS.map(buildOrder);
for (const order of orders) {
  const customer = customers.find((candidate) => candidate.id === order.customer.id)!;
  customer.ordersCount += 1;
  if (!customer.lastOrderAt || customer.lastOrderAt < order.createdAt) customer.lastOrderAt = order.createdAt;
}

function toSummary(order: Order): OrderSummary {
  return {
    id: order.id,
    orderCode: order.orderCode,
    groupId: order.groupId,
    groupCode: order.groupCode,
    channel: order.channel,
    customer: order.customer,
    productType: order.productType,
    factory: order.factory,
    quantity: order.quantity,
    unit: order.unit,
    grossAmount: order.grossAmount,
    currency: order.currency,
    status: order.status,
    artworkStatus: order.artworkStatus,
    nextInstalment: order.nextInstalment
      ? {
          label: order.nextInstalment.label,
          status: order.nextInstalment.status,
          dueAt: order.nextInstalment.dueAt,
          grossAmount: order.nextInstalment.grossAmount,
        }
      : null,
    hasSlipToReview: order.hasSlipToReview,
    promisedShipDate: order.promisedShipDate,
    slaDueAt: order.slaDueAt,
    urgency: order.urgency,
    createdAt: order.createdAt,
  };
}

/** What each queue holds — the API's definition, applied to the mock's rows. */
export const QUEUES: Record<string, (order: Order) => boolean> = {
  waiting_payment: (order) => order.status === "waiting_payment" && !order.hasSlipToReview,
  slip_review: (order) => order.hasSlipToReview,
  awaiting_artwork: (order) =>
    ["paid_for_production", "waiting_payment"].includes(order.status) &&
    ["awaiting_upload", "changes_requested", "awaiting_template"].includes(order.artworkStatus),
  ready_to_produce: (order) =>
    order.status === "artwork_approved" ||
    (order.status === "paid_for_production" && order.artworkStatus === "approved"),
  due_soon: (order) => order.urgency === "due_soon",
  late: (order) => order.urgency === "late",
};

/* -------------------------------------------------------------------- notes and the timeline */

const notes = new Map<string, Note[]>();
const extraTimeline = new Map<string, TimelineEntry[]>();

function timelineOf(order: Order): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    {
      id: `${order.id}:created`,
      at: order.createdAt,
      kind: "order.placed",
      title: "สร้างคำสั่งซื้อ",
      detail: order.channel === "cs" ? "CS สร้างแทนลูกค้า" : null,
      actor: null,
      visibility: "customer",
      promisedAt: null,
    },
  ];
  for (const payment of order.payments) {
    if (payment.paidAt)
      entries.push({
        id: `${payment.id}:paid`,
        at: payment.paidAt,
        kind: "payment.received",
        title: `รับชำระเงิน ${payment.amount} บาท`,
        detail: null,
        actor: null,
        visibility: "customer",
        promisedAt: null,
      });
    for (const slip of payment.slips)
      entries.push({
        id: `${slip.id}:uploaded`,
        at: slip.uploadedAt,
        kind: "slip.uploaded",
        title: "ลูกค้าอัปโหลดสลิป",
        detail: slip.checks && !slip.checks.amountMatched ? "ยอดในสลิปไม่ตรงกับยอดที่ต้องชำระ ส่งให้การเงินตรวจ" : null,
        actor: null,
        visibility: "internal",
        promisedAt: null,
      });
  }
  for (const proof of order.artwork.proofs)
    entries.push({
      id: `${proof.id}:sent`,
      at: proof.sentAt,
      kind: "proof.sent",
      title: `ส่งปรู๊ฟ v${proof.versionNo}`,
      detail: null,
      actor: null,
      visibility: "customer",
      promisedAt: null,
    });
  for (const job of order.jobs)
    for (const step of job.milestones)
      if (step.completedAt)
        entries.push({
          id: `${job.id}:${step.seq}`,
          at: step.completedAt,
          kind: "milestone.completed",
          title: step.name,
          detail: null,
          actor: null,
          visibility: "customer",
          promisedAt: step.dueAt,
        });
  return [...entries, ...(extraTimeline.get(order.id) ?? [])].sort((a, b) => b.at.localeCompare(a.at));
}

function logEvent(
  order: Order,
  kind: string,
  title: string,
  actor: { id: string; displayName: string } | null,
  detail: string | null = null,
) {
  extraTimeline.set(order.id, [
    ...(extraTimeline.get(order.id) ?? []),
    {
      id: `${order.id}:${kind}:${Date.now()}`,
      at: bangkokIso(),
      kind,
      title,
      detail,
      actor,
      visibility: "internal",
      promisedAt: null,
    },
  ]);
}

/* ----------------------------------------------------------------------- queues and search */

const QUEUE_KEYS: Record<string, string> = {
  waiting_payment: "orders.waiting_payment",
  slip_review: "orders.slip_review",
  awaiting_artwork: "orders.awaiting_artwork",
  ready_to_produce: "orders.ready_to_produce",
  due_soon: "orders.due_soon",
  late: "orders.late",
};

for (const [queue, key] of Object.entries(QUEUE_KEYS)) {
  registerQueue(queue === "slip_review" ? "approvals.act" : "orders.read", () => {
    const rows = orders.filter(QUEUES[queue]!);
    const due = rows
      .map((row) => row.slaDueAt)
      .filter((at): at is string => Boolean(at))
      .sort();
    return {
      key,
      path: `/admin/orders?queue=${queue}`,
      count: rows.length,
      overdueCount: queue === "late" ? rows.length : due.filter((at) => Date.parse(at) < Date.now()).length,
      nextDueAt: due.find((at) => Date.parse(at) >= Date.now()) ?? null,
    };
  });
}

indexForSearch(
  ...orders.map((order) => ({
    type: "order" as const,
    id: order.id,
    code: order.orderCode,
    title: `${order.orderCode} · ${order.customer.displayName}`,
    subtitle: order.productType.name,
    permission: "orders.read",
    keywords: `${order.groupCode} ${customers.find((c) => c.id === order.customer.id)?.phone ?? ""}`,
  })),
  ...customers.map((customer) => ({
    type: "customer" as const,
    id: customer.id,
    code: customer.customerCode,
    title: customer.displayName,
    subtitle: [customer.phone, customer.email].filter(Boolean).join(" · "),
    permission: "customers.read",
    keywords: `${customer.phone} ${customer.email}`,
  })),
);

/**
 * What this actor may see and do — the real API decides per actor (ADR-0005, D-141). Slip review is
 * Finance's (D-061); cost and margin only for the roles D-141 names.
 */
function forActor(order: Order, persona: ReturnType<typeof staffPersonaOf>): Order {
  const finance = persona?.roles.some((role) => ["finance", "finance_manager", "superadmin"].includes(role)) ?? false;
  const seesMargin = persona?.permissions.includes("margin.read") ?? false;
  return {
    ...order,
    margin: seesMargin ? order.margin : undefined,
    nextActions: order.nextActions.filter(
      (action) => finance || !["order.approve_slip", "order.reject_slip"].includes(action.key),
    ),
  };
}

/* ---------------------------------------------------------------------------------- handlers */

const find = (orderId: string | undefined) => orders.find((order) => order.id === orderId);
/** Recomputes the derived columns after the storefront mock changed an order (mocks/store). */
export const refreshOrder = (order: Order) => refresh(order);
const refresh = (order: Order) => {
  order.nextActions = nextActionsOf(order);
  order.nextInstalment = order.instalments.find((item) => item.status !== "paid") ?? null;
  return order;
};

export const commerceHandlers = [
  mockRequest("GET /v1/admin/orders", ({ query }) => {
    const rows = orders
      .filter((order) => !query.queue || QUEUES[query.queue]!(order))
      .filter((order) => !query.status || order.status === query.status)
      .filter((order) => !query.artworkStatus || order.artworkStatus === query.artworkStatus)
      .filter((order) => !query.channel || order.channel === query.channel)
      .filter((order) => !query.productType || order.productType.code === query.productType)
      .filter((order) => !query.customerId || order.customer.id === query.customerId)
      .filter((order) => !query.companyId || companyMembers(query.companyId).includes(order.customer.id))
      .filter((order) => !query.createdFrom || order.createdAt.slice(0, 10) >= query.createdFrom)
      .filter((order) => !query.createdTo || order.createdAt.slice(0, 10) <= query.createdTo)
      .filter((order) =>
        matchesQuery(
          query.q,
          order.orderCode,
          order.groupCode,
          order.customer.displayName,
          customers.find((c) => c.id === order.customer.id)?.phone,
        ),
      );
    return paginate(sortBy(rows.map(toSummary), query.sort ?? "createdAt", query.order ?? "desc"), query);
  }),
  mockRequest("GET /v1/admin/orders/{orderId}", ({ params, request }) => {
    const order = find(params.orderId);
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    return forActor(order, staffPersonaOf(request));
  }),
  mockRequest("GET /v1/admin/orders/{orderId}/timeline", ({ params, query }) => {
    const order = find(params.orderId);
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    const all = timelineOf(order);
    const start = Number(query.cursor ?? 0);
    const limit = query.limit ?? 50;
    return {
      data: all.slice(start, start + limit),
      meta: { nextCursor: start + limit < all.length ? String(start + limit) : null },
    };
  }),
  mockRequest("GET /v1/admin/orders/{orderId}/notes", ({ params }) => ({
    data: [...(notes.get(params.orderId!) ?? [])].reverse(),
  })),
  mockRequest("POST /v1/admin/orders/{orderId}/notes", ({ params, body, request }) => {
    const persona = staffPersonaOf(request)!;
    const note: Note = {
      id: mockId("not", (notes.get(params.orderId!)?.length ?? 0) + 1 + Math.floor(Math.random() * 1e5)),
      author: { id: persona.id, displayName: persona.displayName },
      body: body.body,
      mentions: body.mentions
        .map((id) => PERSONAS.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({ id: p!.id, displayName: p!.displayName })),
      createdAt: bangkokIso(),
    };
    notes.set(params.orderId!, [...(notes.get(params.orderId!) ?? []), note]);
    return note;
  }),
  mockRequest("GET /v1/admin/order-cancel-reasons", () => ({
    data: [
      { code: "customer_request", name: "ลูกค้าขอยกเลิก", requiresCreditNote: false },
      { code: "payment_expired", name: "เกินกำหนดชำระเงิน", requiresCreditNote: false },
      { code: "cannot_produce", name: "โรงงานผลิตไม่ได้ตามสเปก", requiresCreditNote: true },
      { code: "duplicate", name: "คำสั่งซื้อซ้ำ", requiresCreditNote: false },
    ],
  })),
  mockRequest("POST /v1/admin/orders/{orderId}/actions/approve-slip", ({ params, body, request }) => {
    const order = find(params.orderId);
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    const persona = staffPersonaOf(request)!;
    const payment = order.payments.find((candidate) => candidate.slips.some((s) => s.id === body.slipId));
    const slip = payment?.slips.find((s) => s.id === body.slipId);
    if (!payment || !slip) return problem(404, "http.not_found", "ไม่พบสลิปนี้");
    if (slip.verificationStatus !== "manual_review")
      return problem(409, "slip.not_reviewable", "สลิปนี้ไม่ได้รอการตรวจแล้ว");
    Object.assign(slip, {
      verificationStatus: "manual_approved",
      reviewedBy: { id: persona.id, displayName: persona.displayName },
      reviewNote: body.note ?? null,
    });
    Object.assign(payment, { status: "succeeded", paidAt: bangkokIso(), providerRef: `SLIP-${slip.id.slice(-4)}` });
    const instalment = order.instalments.find((item) => item.status !== "paid");
    if (instalment) Object.assign(instalment, { status: "paid", paidAmount: instalment.grossAmount });
    order.hasSlipToReview = false;
    if (order.status === "waiting_payment") order.status = "paid_for_production";
    order.factory = FACTORY;
    order.slaDueAt = null;
    logEvent(
      order,
      "slip.approved",
      "การเงินอนุมัติสลิป",
      { id: persona.id, displayName: persona.displayName },
      body.note ?? null,
    );
    return forActor(refresh(order), staffPersonaOf(request));
  }),
  mockRequest("POST /v1/admin/orders/{orderId}/actions/reject-slip", ({ params, body, request }) => {
    const order = find(params.orderId);
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    const persona = staffPersonaOf(request)!;
    const slip = order.payments.flatMap((p) => p.slips).find((s) => s.id === body.slipId);
    if (!slip) return problem(404, "http.not_found", "ไม่พบสลิปนี้");
    Object.assign(slip, {
      verificationStatus: "manual_rejected",
      reviewedBy: { id: persona.id, displayName: persona.displayName },
      reviewNote: body.reason,
    });
    order.hasSlipToReview = false;
    logEvent(
      order,
      "slip.rejected",
      "การเงินไม่อนุมัติสลิป",
      { id: persona.id, displayName: persona.displayName },
      body.reason,
    );
    return forActor(refresh(order), staffPersonaOf(request));
  }),
  mockRequest("POST /v1/admin/orders/{orderId}/actions/start-production", ({ params, body, request }) => {
    const order = find(params.orderId);
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    if (!["paid_for_production", "artwork_approved"].includes(order.status))
      return problem(409, "order.invalid_transition", "คำสั่งซื้อนี้เริ่มผลิตไม่ได้ในสถานะปัจจุบัน");
    const persona = staffPersonaOf(request)!;
    order.status = "in_production";
    order.startMode = "manual_exception";
    order.confirmedProductionDate = bangkokIso().slice(0, 10);
    order.jobs = [
      {
        id: mockId("job", 900 + orders.indexOf(order)),
        jobNo: `J-2569-${String(900 + orders.indexOf(order))}`,
        kind: "production",
        factory: FACTORY,
        status: "released",
        acceptDueAt: bangkokIso(60 * 24),
        promisedShipDate: order.promisedShipDate,
        atRisk: false,
        milestones: [],
      },
    ];
    logEvent(
      order,
      "production.started_manually",
      "เริ่มผลิตด้วยมือ (กรณียกเว้น)",
      { id: persona.id, displayName: persona.displayName },
      body.reason,
    );
    return forActor(refresh(order), staffPersonaOf(request));
  }),
  mockRequest("POST /v1/admin/orders/{orderId}/actions/cancel", ({ params, body, request }) => {
    const order = find(params.orderId);
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    if (!["waiting_payment", "paid_for_production", "artwork_approved"].includes(order.status))
      return problem(409, "order.invalid_transition", "ยกเลิกคำสั่งซื้อที่เริ่มผลิตแล้วไม่ได้");
    const persona = staffPersonaOf(request)!;
    Object.assign(order, {
      status: "cancelled",
      cancelledAt: bangkokIso(),
      cancelReason: body.note ?? body.reasonCode,
      hasSlipToReview: false,
      slaDueAt: null,
    });
    order.group.status = "cancelled";
    logEvent(
      order,
      "order.cancelled",
      "ยกเลิกคำสั่งซื้อ",
      { id: persona.id, displayName: persona.displayName },
      body.note ?? body.reasonCode,
    );
    return forActor(refresh(order), staffPersonaOf(request));
  }),
  mockRequest("POST /v1/admin/orders/{orderId}/actions/send-payment-reminder", ({ params, request }) => {
    const order = find(params.orderId);
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    const persona = staffPersonaOf(request)!;
    logEvent(order, "payment.reminder_sent", "ส่งข้อความเตือนชำระเงิน", {
      id: persona.id,
      displayName: persona.displayName,
    });
  }),
  mockRequest("POST /v1/admin/orders/{orderId}/actions/record-slip", ({ params, body, request }) => {
    const order = find(params.orderId);
    if (!order) return problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
    const persona = staffPersonaOf(request)!;
    const slipEntry = {
      id: mockId("slp", 500 + Math.floor(Math.random() * 1e5)),
      file: {
        id: body.fileId,
        originalName: "slip.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 120_000,
        thumbnailUrl: null,
        url: null,
      },
      declaredAmount: body.declaredAmount,
      declaredTransferredAt: body.declaredTransferredAt,
      verificationStatus: "manual_review" as const,
      checks: null,
      slaDueAt: bangkokIso(240),
      reviewedBy: null,
      reviewNote: null,
      uploadedAt: bangkokIso(),
    };
    const payment = order.payments[0] ?? {
      id: mockId("pay", 700 + orders.indexOf(order)),
      method: "bank_transfer_slip" as const,
      status: "awaiting_verification" as const,
      amount: body.declaredAmount,
      feeAmount: "0.00",
      providerRef: null,
      paidAt: null,
      slips: [],
    };
    if (!order.payments.includes(payment)) order.payments.push(payment);
    payment.slips.push(slipEntry);
    order.hasSlipToReview = true;
    logEvent(order, "slip.uploaded_by_cs", "CS อัปโหลดสลิปแทนลูกค้า", {
      id: persona.id,
      displayName: persona.displayName,
    });
    return forActor(refresh(order), staffPersonaOf(request));
  }),
  mockRequest("POST /v1/admin/orders/actions/send-payment-reminders", ({ body }) => {
    const skipped = body.orderIds
      .filter((id) => find(id)?.status !== "waiting_payment")
      .map((orderId) => ({ orderId, reason: "คำสั่งซื้อไม่ได้รอชำระเงินแล้ว" }));
    return { sent: body.orderIds.length - skipped.length, skipped };
  }),
  mockRequest("GET /v1/admin/order-groups/{groupId}", ({ params }) => {
    const members = orders.filter((order) => order.groupId === params.groupId);
    const first = members[0];
    if (!first) return problem(404, "http.not_found", "ไม่พบกลุ่มคำสั่งซื้อนี้");
    return {
      id: first.groupId,
      groupCode: first.groupCode,
      status: first.group.status,
      channel: first.channel,
      customer: first.customer,
      placedBy: { id: PERSONAS[5]!.id, displayName: PERSONAS[5]!.displayName },
      netAmount: first.netAmount,
      discountAmount: first.discountAmount,
      shippingAmount: first.shippingAmount,
      vatAmount: first.vatAmount,
      grossAmount: first.grossAmount,
      currency: "THB" as const,
      poNumber: first.poNumber,
      expiresAt: first.expiresAt,
      placedAt: first.createdAt,
      orders: members.map(toSummary),
      instalments: first.instalments,
    };
  }),

  /* customers */
  mockRequest("GET /v1/admin/customers", ({ query }) => {
    const rows = customers
      .filter((customer) => !query.customerType || customer.customerType === query.customerType)
      .filter((customer) => !query.createdVia || customer.createdVia === query.createdVia)
      .filter((customer) =>
        matchesQuery(
          query.q,
          customer.displayName,
          customer.phone,
          customer.email,
          customer.customerCode,
          customer.companyName,
        ),
      )
      .map(summaryOfCustomer);
    return paginate(sortBy(rows, query.sort ?? "createdAt", query.order ?? "desc"), query);
  }),
  mockRequest("POST /v1/admin/customers", ({ body }) => {
    if (customers.some((customer) => customer.phone === body.phone))
      return problem(409, "customer.phone_taken", "เบอร์นี้มีบัญชีลูกค้าอยู่แล้ว");
    const customer: Customer = {
      id: mockId("cus", customers.length + 1),
      customerCode: `C${250001 + customers.length}`,
      displayName: body.displayName,
      phone: body.phone,
      email: body.email ?? null,
      customerType: body.customerType,
      companyName: null,
      createdVia: "cs",
      ordersCount: 0,
      createdAt: bangkokIso(),
      referralCode: `PK${9000 + customers.length}`,
      loyalty: { tier: "member", availablePoints: 0, spend12m: "0.00" },
      lastOrderAt: null,
      birthDate: null,
      addresses: [],
      taxProfiles: [],
    };
    customers.push(customer);
    return summaryOfCustomer(customer);
  }),
  mockRequest(
    "GET /v1/admin/customers/{customerId}",
    ({ params }) =>
      customers.find((customer) => customer.id === params.customerId) ??
      problem(404, "http.not_found", "ไม่พบลูกค้านี้"),
  ),
  mockRequest("POST /v1/admin/customers/{customerId}/addresses", ({ params, body }) => {
    const customer = customers.find((candidate) => candidate.id === params.customerId);
    if (!customer) return problem(404, "http.not_found", "ไม่พบลูกค้านี้");
    const address = {
      ...body,
      id: mockId("adr", 100 + customer.addresses.length + customers.indexOf(customer) * 10),
      line2: body.line2 ?? null,
      subdistrict: body.subdistrict ?? null,
      district: body.district ?? null,
      isDefault: body.isDefault ?? customer.addresses.length === 0,
    };
    customer.addresses.push(address);
    return address;
  }),
  mockRequest("GET /v1/admin/geo/postcodes/{postcode}", ({ params }) => {
    const known: Record<string, { province: string; districts: { name: string; subdistricts: string[] }[] }> = {
      "10110": {
        province: "กรุงเทพมหานคร",
        districts: [
          { name: "เขตวัฒนา", subdistricts: ["แขวงคลองเตยเหนือ", "แขวงคลองตันเหนือ"] },
          { name: "เขตคลองเตย", subdistricts: ["แขวงคลองเตย", "แขวงคลองตัน"] },
        ],
      },
      "10400": { province: "กรุงเทพมหานคร", districts: [{ name: "เขตพญาไท", subdistricts: ["แขวงสามเสนใน"] }] },
      "50200": {
        province: "เชียงใหม่",
        districts: [{ name: "อำเภอเมืองเชียงใหม่", subdistricts: ["ตำบลศรีภูมิ", "ตำบลพระสิงห์"] }],
      },
      "20000": { province: "ชลบุรี", districts: [{ name: "อำเภอเมืองชลบุรี", subdistricts: ["ตำบลบางปลาสร้อย"] }] },
      "90110": { province: "สงขลา", districts: [{ name: "อำเภอหาดใหญ่", subdistricts: ["ตำบลหาดใหญ่"] }] },
      "40000": { province: "ขอนแก่น", districts: [{ name: "อำเภอเมืองขอนแก่น", subdistricts: ["ตำบลในเมือง"] }] },
    };
    const entry = known[params.postcode!];
    return entry
      ? { postcode: params.postcode!, ...entry }
      : problem(404, "geo.postcode_unknown", "ไม่พบรหัสไปรษณีย์นี้");
  }),
];
