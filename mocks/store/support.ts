/**
 * Help from the storefront, mocked: the contact form and the hand-off to CS at their published
 * paths (`store.support.contact` / `.handoff`, D-221), and guided help and sample kits, which
 * stay contract requests until U2.2 / U2.4 (D-223).
 *
 * Tickets and kit requests are numbered and kept in memory so a test can see them; the
 * recommendation is a fixed, obviously fake rule over the catalogue's live products. Nothing is
 * sent anywhere.
 */

import type { z } from "zod";

import { http, HttpResponse } from "msw";

import type { guidedAnswers } from "@/lib/api/requests/store-support";
import type { Schemas } from "@/lib/api/types";

import { mockRequest } from "../route";
import { bangkokIso, principalOf, problem } from "../support";
import { catalogProducts, imageUrl } from "./catalog";

type Answers = z.output<typeof guidedAnswers>;

const DAY = 24 * 60;
const LINE_OA = "@getpack.mock";

let ticketSeq = 0;
export const tickets: { ticketNo: string; kind: "contact" | "handoff"; body: unknown; at: string }[] = [];

function ticket(kind: "contact" | "handoff", body: unknown, withLine: boolean, signedIn: boolean) {
  ticketSeq += 1;
  const ticketNo = `CS-2569-${String(ticketSeq).padStart(5, "0")}`;
  const at = bangkokIso();
  tickets.push({ ticketNo, kind, body, at });
  const answer: Schemas["SupportTicketDto"] = {
    ticketNo,
    source: kind === "handoff" ? "handoff" : "contact_form",
    // `support.first_response_business_days` (D-175): a day in the mock.
    respondBy: bangkokIso(DAY),
    lineUrl: withLine
      ? `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA)}/?${encodeURIComponent(`เรื่อง ${ticketNo}`)}`
      : null,
    conversationId: signedIn ? "00000000-0000-4000-8000-0000000c5001" : null,
    createdAt: at,
  };
  return HttpResponse.json(answer, { status: 201 });
}

const keyRequired = (request: Request) =>
  request.headers.get("idempotency-key")
    ? null
    : problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้");

/** A guest leaves a name and a phone or e-mail; a signed-in customer is reached through the account. */
function contactRefused(contact: Schemas["SupportContactPersonDto"] | undefined, signedIn: boolean, phoneOnly = false) {
  if (signedIn && !contact) return null;
  if (!contact?.name?.trim())
    return problem(422, "validation.failed", "กรุณาใส่ชื่อ", [
      { path: "contact.name", code: "required", message: "required" },
    ]);
  if (!contact.phone && (phoneOnly || !contact.email))
    return problem(422, "validation.failed", "กรุณาใส่เบอร์โทรหรืออีเมลอย่างน้อยหนึ่งช่องทาง", [
      { path: "contact.phone", code: "required", message: "phone or email" },
    ]);
  return null;
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
  // store.support.contact (public, rate-limited): a CS ticket with the first-response target.
  http.post("*/v1/store/support/actions/contact", async ({ request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const body = (await request.json().catch(() => null)) as Schemas["SupportContactDto"] | null;
    if (!body || !body.message?.trim() || !/^[a-z][a-z0-9_]{0,39}$/.test(body.topic ?? ""))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "message", code: "required", message: "required" },
      ]);
    const signedIn = principalOf(request)?.audience === "customer";
    const invalid = contactRefused(body.contact, signedIn);
    if (invalid) return invalid;
    const limited = throttled(`contact:${body.contact?.phone ?? body.contact?.email ?? body.contact?.name ?? "me"}`);
    if (limited) return limited;
    return ticket("contact", body, false, signedIn);
  }),

  // store.support.handoff: the page and what was said, as a `guided_help` ticket; LINE or a call back.
  http.post("*/v1/store/support/actions/handoff", async ({ request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const body = (await request.json().catch(() => null)) as Schemas["SupportHandoffDto"] | null;
    if (!body?.page)
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "page", code: "required", message: "required" },
      ]);
    const signedIn = principalOf(request)?.audience === "customer";
    const invalid = contactRefused(body.contact, signedIn, true);
    if (invalid) return invalid;
    return ticket("handoff", body, !body.callback, signedIn);
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
