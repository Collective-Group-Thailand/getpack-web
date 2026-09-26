/**
 * Help from the storefront, mocked (CONTRACT-REQUEST store.support, store.guided-help,
 * store.sample-kits).
 *
 * Tickets and kit requests are numbered and kept in memory so a test can see them; the
 * recommendation is a fixed, obviously fake rule over the catalogue's live products. Nothing is
 * sent anywhere.
 */

import type { z } from "zod";

import type { guidedAnswers } from "@/lib/api/requests/store-support";

import { mockRequest } from "../route";
import { bangkokIso, problem } from "../support";
import { catalogProducts, imageUrl } from "./catalog";

type Answers = z.output<typeof guidedAnswers>;

const DAY = 24 * 60;
const LINE_OA = "@packio.mock";

let ticketSeq = 0;
export const tickets: { ticketNo: string; kind: "contact" | "handoff"; body: unknown; at: string }[] = [];

function ticket(kind: "contact" | "handoff", body: unknown, withLine: boolean) {
  ticketSeq += 1;
  const ticketNo = `CS-2569-${String(ticketSeq).padStart(5, "0")}`;
  tickets.push({ ticketNo, kind, body, at: bangkokIso() });
  return {
    ticketNo,
    respondBy: bangkokIso(kind === "handoff" ? 60 : DAY),
    lineUrl: withLine
      ? `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA)}/?${encodeURIComponent(`เรื่อง ${ticketNo}`)}`
      : null,
  };
}

/** Per-sender throttle, so the rate-limit message has something to answer (api-conventions §7). */
const recent = new Map<string, number[]>();
function throttled(key: string, limit = 5): Response | null {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((at) => now - at < 60 * 60_000);
  hits.push(now);
  recent.set(key, hits);
  if (hits.length <= limit) return null;
  const response = problem(429, "rate_limited", "ส่งบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่");
  response.headers.set("Retry-After", "600");
  return response;
}

const KITS = [
  {
    code: "KIT-PAPER",
    name: "ชุดตัวอย่างกระดาษและงานพิมพ์",
    description: "กระดาษกล่องยอดนิยม 8 ชนิด พร้อมตัวอย่างเคลือบและพิมพ์ 4 สี (ข้อมูลจำลอง)",
    contents: ["กระดาษอาร์ตการ์ด 3 ความหนา", "กระดาษคราฟท์", "กระดาษลูกฟูก E / B", "เคลือบด้าน เคลือบเงา", "ปั๊มฟอยล์"],
    price: "0.00",
    creditedOnFirstOrder: false,
    leadDays: 3,
  },
  {
    code: "KIT-BOX",
    name: "ชุดกล่องตัวอย่าง 5 ทรง",
    description: "กล่องขึ้นรูปจริง 5 ทรงยอดนิยม ให้ลองจับ ลองพับ ก่อนตัดสินใจ (ข้อมูลจำลอง)",
    contents: ["กล่องฝาเสียบ", "กล่องลูกฟูก RSC", "กล่องถาดสวม", "กล่องหูหิ้ว", "ซองกระดาษ"],
    price: "350.00",
    creditedOnFirstOrder: true,
    leadDays: 5,
  },
];

const USES: Record<string, string> = {
  cosmetics: "เครื่องสำอาง",
  food: "อาหาร",
  electronics: "อุปกรณ์อิเล็กทรอนิกส์",
  apparel: "เสื้อผ้า",
  gifts: "ของขวัญ",
};

/** An obviously fake rule: protection and large → corrugated; otherwise folding cartons first. */
function recommend(answers: Answers) {
  const products = catalogProducts();
  const corrugated = products.filter(
    (row) => String(row.slug).includes("shipping") || String(row.slug).includes("mailer"),
  );
  const folding = products.filter((row) => !corrugated.includes(row));
  const order =
    answers.priority === "protection" || answers.size === "large"
      ? [...corrugated, ...folding]
      : [...folding, ...corrugated];
  const why = (index: number) =>
    [
      answers.priority === "premium"
        ? "ผิวงานพิมพ์สวย เพิ่มเคลือบหรือฟอยล์ได้ เหมาะกับสินค้าพรีเมียม"
        : answers.priority === "protection"
          ? "แข็งแรง รับน้ำหนักและกันกระแทกระหว่างขนส่ง"
          : answers.priority === "eco"
            ? "เลือกกระดาษคราฟท์หรือกระดาษรีไซเคิลได้"
            : "ต้นทุนต่อชิ้นต่ำเมื่อสั่งจำนวนมาก",
      "สั่งขั้นต่ำไม่สูง ปรับขนาดได้ตามสินค้า",
      "ทรงยอดนิยม ผลิตเร็ว",
    ][index] ?? "ทรงยอดนิยม";
  return {
    summary: `กล่องสำหรับ${USES[answers.use] ?? "สินค้าของคุณ"} (ข้อมูลจำลอง)`,
    styles: order.slice(0, 3).map((row, index) => ({
      slug: String(row.slug),
      name: String(row.nameTh),
      why: why(index),
      imageUrl: imageUrl(((row.images as { fileId: string }[] | undefined) ?? [])[0]?.fileId),
      fromUnitPrice: answers.quantity === "under_500" ? null : (["12.50", "8.90", "6.40"][index] ?? null),
    })),
  };
}

let kitSeq = 0;

export const storeSupportHandlers = [
  mockRequest("POST /v1/store/support/actions/contact", ({ body }) => {
    const limited = throttled(`contact:${body.phone ?? body.email ?? body.name}`);
    if (limited) return limited;
    if (!body.phone && !body.email)
      return problem(422, "validation.failed", "กรุณาใส่เบอร์โทรหรืออีเมลอย่างน้อยหนึ่งช่องทาง", [
        { path: "phone", code: "required", message: "phone or email" },
      ]);
    return ticket("contact", body, false);
  }),

  mockRequest("POST /v1/store/support/actions/handoff", ({ body }) => {
    if (body.channel === "callback" && !body.phone)
      return problem(422, "validation.failed", "กรุณาใส่เบอร์โทรเพื่อให้ทีมโทรกลับ", [
        { path: "phone", code: "required", message: "required" },
      ]);
    return ticket("handoff", body, body.channel === "line");
  }),

  mockRequest("POST /v1/store/guided-help/actions/recommend", ({ body }) => recommend(body)),

  mockRequest("GET /v1/store/sample-kits", () => ({
    data: KITS.map((kit) => ({ ...kit, imageUrl: null, available: true })),
  })),

  mockRequest("POST /v1/store/sample-kits/actions/request", ({ body }) => {
    const kit = KITS.find((candidate) => candidate.code === body.kitCode);
    if (!kit) return problem(404, "http.not_found", "ไม่พบชุดตัวอย่างนี้");
    const limited = throttled(`kit:${body.address.phone}`, 3);
    if (limited) return limited;
    kitSeq += 1;
    const paid = kit.price !== "0.00";
    return {
      requestNo: `SK-2569-${String(kitSeq).padStart(5, "0")}`,
      status: paid ? "awaiting_payment" : "received",
      payUrl: paid ? `/checkout/sample-kit/${kitSeq}` : null,
      shipsBy: bangkokIso(kit.leadDays * DAY),
    };
  }),
];
