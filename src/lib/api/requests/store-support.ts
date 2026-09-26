/**
 * Help from the storefront (F3 3.7): contacting the team, ordering a sample kit, and the guided
 * help widget that recommends styles and hands the conversation to customer service with what
 * it already knows.
 *
 * All four are open to guests (`public`) and rate-limited by the API (429 with `Retry-After`,
 * api-conventions §7). A hand-off becomes a CS ticket with the context attached, so nobody has to
 * explain twice; the LINE link carries only the ticket number, never the context itself.
 */

import { z } from "zod";

import { dateTime, money, request } from "./define";

export const contactTopic = z
  .enum(["order", "quote", "artwork", "payment", "delivery", "business", "partnership", "other"])
  .meta({ id: "ContactTopic" });

export const supportTicket = z
  .object({
    ticketNo: z.string(),
    /** When the team replies by, on the business calendar. */
    respondBy: dateTime(),
    /** Opens the LINE OA chat with the ticket number prefilled, when LINE is a channel. */
    lineUrl: z.string().nullable(),
  })
  .meta({ id: "SupportTicketDto" });

export const sampleKit = z
  .object({
    code: z.string(),
    name: z.string(),
    description: z.string(),
    contents: z.array(z.string()),
    imageUrl: z.string().nullable(),
    /** `0.00` when free; otherwise paid at the link that comes back, credited on a first order. */
    price: money(),
    creditedOnFirstOrder: z.boolean(),
    leadDays: z.number().int(),
    available: z.boolean(),
  })
  .meta({ id: "SampleKitDto" });

const addressInput = z.object({
  recipientName: z.string().trim().min(1).max(120),
  phone: z.string().regex(/^0\d{8,9}$/),
  line1: z.string().trim().min(1).max(200),
  subdistrict: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  province: z.string().min(1).max(80),
  postcode: z.string().regex(/^\d{5}$/),
});

export const guidedAnswers = z
  .object({
    /** What goes in the box: cosmetics, food, electronics, apparel, gifts, other. */
    use: z.string().max(40),
    size: z.enum(["small", "medium", "large", "unsure"]).meta({ id: "GuidedSize" }),
    quantity: z.enum(["under_500", "500_2000", "2000_10000", "over_10000"]).meta({ id: "GuidedQuantity" }),
    priority: z.enum(["premium", "protection", "budget", "eco"]).meta({ id: "GuidedPriority" }),
  })
  .meta({ id: "GuidedAnswersDto" });

export const guidedRecommendation = z
  .object({
    summary: z.string(),
    styles: z.array(
      z.object({
        slug: z.string(),
        name: z.string(),
        /** Why it suits these answers, in words. */
        why: z.string(),
        imageUrl: z.string().nullable(),
        /** "เริ่มต้น ฿x / ชิ้น" at the quantity band — the API's figure, when it has one. */
        fromUnitPrice: z.string().nullable(),
      }),
    ),
  })
  .meta({ id: "GuidedRecommendationDto" });

export const storeSupportRequests = {
  "POST /v1/store/support/actions/contact": request({
    request: "store.support",
    summary: "Send the team a message from the contact page; a CS ticket comes back with when to expect a reply",
    body: z.object({
      name: z.string().trim().min(1).max(120),
      phone: z
        .string()
        .regex(/^0\d{8,9}$/)
        .optional(),
      email: z.string().email().max(254).optional(),
      topic: contactTopic,
      orderCode: z.string().max(40).optional(),
      message: z.string().trim().min(10).max(3000),
    }),
    response: supportTicket,
    status: 201,
    idempotent: true,
    public: true,
  }),
  "POST /v1/store/support/actions/handoff": request({
    request: "store.support",
    summary: "Hand the guided help conversation to CS with its context (page, answers, recommendations)",
    body: z.object({
      channel: z.enum(["line", "callback"]).meta({ id: "HandoffChannel" }),
      name: z.string().trim().max(120).optional(),
      phone: z
        .string()
        .regex(/^0\d{8,9}$/)
        .optional(),
      context: z.object({
        page: z.string().max(300),
        answers: guidedAnswers.optional(),
        recommended: z.array(z.string()).max(10).optional(),
        note: z.string().max(1000).optional(),
      }),
    }),
    response: supportTicket,
    status: 201,
    idempotent: true,
    public: true,
  }),
  "POST /v1/store/guided-help/actions/recommend": request({
    request: "store.guided-help",
    summary: "Recommend box styles from four answers — use, size, quantity, what matters most",
    body: guidedAnswers,
    response: guidedRecommendation,
    public: true,
  }),
  "GET /v1/store/sample-kits": request({
    request: "store.sample-kits",
    summary: "The sample kits a customer can order to feel materials and finishes before buying",
    response: z.object({ data: z.array(sampleKit) }),
    public: true,
  }),
  "POST /v1/store/sample-kits/actions/request": request({
    request: "store.sample-kits",
    summary: "Order a sample kit to an address; a paid kit comes back with a payment link",
    body: z.object({
      kitCode: z.string(),
      company: z.string().max(200).optional(),
      email: z.string().email().max(254).optional(),
      interest: z.string().max(1000).optional(),
      address: addressInput,
    }),
    response: z.object({
      requestNo: z.string(),
      status: z.enum(["received", "awaiting_payment"]).meta({ id: "SampleKitRequestStatus" }),
      payUrl: z.string().nullable(),
      shipsBy: dateTime(),
    }),
    status: 201,
    idempotent: true,
    public: true,
  }),
} as const;
