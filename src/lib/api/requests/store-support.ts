/**
 * Help from the storefront that getpack-api has deferred by decision (D-223): ordering a sample kit
 * (U2.4) and guided help's recommendation (the Structure Advisor, U2.2). The storefront hides both
 * entry points until then. Contacting the team and the hand-off to CS are published
 * (`store.support.contact` / `.handoff`).
 *
 * Both are open to guests (`public`) and rate-limited by the API (429 with `Retry-After`,
 * api-conventions §7).
 */

import { z } from "zod";

import { dateTime, money, request } from "./define";

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
