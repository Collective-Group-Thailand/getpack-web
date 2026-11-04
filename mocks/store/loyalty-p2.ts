/**
 * Loyalty P2 (API-CHANGES-P2): surveys, the reorder campaign, data refresh, showcase consent, review photos and the
 * bundle add — kept in memory per persona. Every handler is a contract request (`mockRequest`), so its answer is
 * validated against `src/lib/api/requests/store-loyalty-p2.ts`.
 *
 * The fixture is the review case: one open post-delivery survey (8 points), one active ×1.5 reorder campaign on the
 * corrugated box (until a fixed date, D-481), data refresh due, no showcase consent yet. A newcomer has none of it.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";
import type {
  DataRefresh,
  LoyaltyCampaign,
  ShowcaseConsent,
  SurveyAnswers,
  SurveyInstance,
} from "@/lib/api/requests/store-loyalty-p2";

import { mockRequest } from "../route";
import { bangkokIso, mockId, problem } from "../support";
import { addToCart, toCartDto } from "./cart";
import { customerOf, type MockCustomer } from "./customers";
import { quotesOf } from "./quotes";

const DAY = 24 * 60;
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const langOf = (request: Request) =>
  (request.headers.get("accept-language") ?? "th").toLowerCase().startsWith("en") ? ("en" as const) : ("th" as const);

export const SURVEY_ID = mockId("svi", 1);
export const CAMPAIGN_ID = mockId("lcp", 1);
/** The showcase consent text the form shows; an older version is refused (`showcase.text_outdated`). */
export const SHOWCASE_TEXT_VERSION = "2026-11-v1";

type Lang = "th" | "en";
const t = (th: string, en: string) => ({ th, en });

const QUESTIONS = [
  {
    key: "overall",
    kind: "rating",
    label: t("ความพึงพอใจโดยรวม", "Overall satisfaction"),
    min: 1,
    max: 5,
    required: true,
  },
  {
    key: "quality",
    kind: "single",
    label: t("คุณภาพงานพิมพ์ตรงกับที่คาดไหม", "Did the print quality match what you expected?"),
    options: [
      { key: "better", label: t("ดีกว่าที่คาด", "Better than expected") },
      { key: "as_expected", label: t("ตรงตามที่คาด", "As expected") },
      { key: "worse", label: t("ต่ำกว่าที่คาด", "Below expectations") },
    ],
    required: true,
  },
  {
    key: "improve",
    kind: "multi",
    label: t("อยากให้เราปรับปรุงเรื่องใด", "What should we improve?"),
    options: [
      { key: "lead_time", label: t("ระยะเวลาผลิต", "Production time") },
      { key: "price", label: t("ราคา", "Price") },
      { key: "design", label: t("การออกแบบ", "Design") },
    ],
    required: false,
  },
  {
    key: "comment",
    kind: "text",
    label: t("อยากบอกอะไรเพิ่มเติม", "Anything else you'd like to tell us?"),
    maxLength: 500,
    required: false,
  },
] as const;

interface State {
  survey: SurveyInstance["status"];
  dataConfirmedAt: string | null;
  showcase: ShowcaseConsent;
  /** My reviews by order id, with the P2 `photos[]` the published `ReviewDto` does not carry yet. */
  reviews: Map<string, MockReview>;
}

type MockReview = Schemas["ReviewDto"] & { photos: { id: string; url: string }[]; photoRewardPoints: number };

const states = new Map<string, State>();
function stateOf(customer: MockCustomer): State {
  if (!states.has(customer.persona))
    states.set(customer.persona, {
      survey: customer.ownerIndex === null ? "expired" : "open",
      dataConfirmedAt: null,
      showcase: {
        status: "none",
        scope: [],
        consentTextVersion: null,
        requestedAt: null,
        decidedAt: null,
        rewardPoints: 40,
      },
      reviews: new Map(),
    });
  return states.get(customer.persona)!;
}

/** Back to the review case — for tests. */
export function resetLoyaltyP2Mock() {
  states.clear();
}

export function surveyOf(customer: MockCustomer, lang: Lang): SurveyInstance {
  return {
    id: SURVEY_ID,
    trigger: "post_delivery",
    orderCode: "OR-2610-0042",
    status: stateOf(customer).survey,
    expiresAt: bangkokIso(30 * DAY),
    rewardPoints: 8,
    title: lang === "en" ? "How was your latest order?" : "คำสั่งซื้อล่าสุดเป็นอย่างไรบ้าง",
    questions: QUESTIONS.map((question) => ({
      ...question,
      label: question.label[lang],
      ...("options" in question
        ? { options: question.options.map((o) => ({ key: o.key, label: o.label[lang] })) }
        : {}),
    })) as SurveyInstance["questions"],
  };
}

/** The review customer's one active reorder campaign (none for a newcomer). */
export function campaignsOf(customer: MockCustomer, lang: Lang = "th"): LoyaltyCampaign[] {
  if (customer.ownerIndex === null) return [];
  return [
    {
      id: CAMPAIGN_ID,
      kind: "reorder_bonus",
      multiplier: "1.50",
      startsAt: bangkokIso(-DAY),
      endsAt: bangkokIso(6 * DAY),
      productTypeCode: "corrugated",
      productTypeName: lang === "en" ? "Corrugated box" : "กล่องลูกฟูก",
      reorderOfOrderId: mockId("ord", 1),
      reorderOfOrderCode: "OR-2610-0042",
    },
  ];
}

function dataRefreshOf(customer: MockCustomer): DataRefresh {
  const confirmed = stateOf(customer).dataConfirmedAt;
  return {
    due: confirmed === null,
    lastConfirmedAt: confirmed,
    nextDueAt: confirmed ? bangkokIso(365 * DAY) : null,
    rewardPoints: confirmed ? 0 : 12,
    company: customer.customerType === "juristic" ? { id: mockId("cmp", 1), legalName: "บริษัท ตัวอย่าง จำกัด" } : null,
    taxProfiles: [{ id: mockId("ctp", 1), label: "สำนักงานใหญ่" }],
    addresses: [
      { id: mockId("cad", 1), label: "คลังสินค้า บางนา", isDefault: true },
      { id: mockId("cad", 2), label: "สำนักงาน สาทร", isDefault: false },
    ],
  };
}

/** A survey answer set against the instance's questions: what the API's validation refuses. */
function answerErrors(survey: SurveyInstance, answers: SurveyAnswers) {
  const errors: { path: string; code: string; message: string }[] = [];
  const keys = new Set(survey.questions.map((question) => question.key));
  for (const key of Object.keys(answers))
    if (!keys.has(key)) errors.push({ path: `answers.${key}`, code: "unknown", message: "ไม่มีคำถามนี้" });
  for (const question of survey.questions) {
    const value = answers[question.key];
    const empty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
    if (question.required && empty)
      errors.push({ path: `answers.${question.key}`, code: "required", message: "กรุณาตอบคำถามนี้" });
    if (question.kind === "rating" && value !== undefined && (typeof value !== "number" || value < 1 || value > 5))
      errors.push({ path: `answers.${question.key}`, code: "range", message: "1–5" });
  }
  return errors;
}

export const loyaltyP2Handlers = [
  // CONTRACT-REQUEST store.surveys
  mockRequest("GET /v1/store/surveys/next", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return { survey: stateOf(customer).survey === "open" ? surveyOf(customer, langOf(request)) : null };
  }),
  // CONTRACT-REQUEST store.surveys
  mockRequest("GET /v1/store/surveys/{surveyId}", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (params.surveyId !== SURVEY_ID || stateOf(customer).survey === "expired")
      return problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
    return { survey: surveyOf(customer, langOf(request)) };
  }),
  // CONTRACT-REQUEST store.surveys
  mockRequest("POST /v1/store/surveys/{surveyId}/actions/seen", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (params.surveyId !== SURVEY_ID) return problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
    const state = stateOf(customer);
    if (state.survey === "open") state.survey = "seen";
    return new HttpResponse(null, { status: 204 });
  }),
  // CONTRACT-REQUEST store.surveys
  mockRequest("POST /v1/store/surveys/{surveyId}/actions/dismiss", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (params.surveyId !== SURVEY_ID) return problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
    const state = stateOf(customer);
    if (state.survey === "open" || state.survey === "seen") state.survey = "dismissed";
    return new HttpResponse(null, { status: 204 });
  }),
  // CONTRACT-REQUEST store.surveys: earn_survey once per instance
  mockRequest("POST /v1/store/surveys/{surveyId}/responses", ({ request, params, body }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (params.surveyId !== SURVEY_ID) return problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
    const state = stateOf(customer);
    if (state.survey !== "open" && state.survey !== "seen")
      return problem(409, "surveys.not_open", "แบบสอบถามนี้ปิดแล้ว");
    const survey = surveyOf(customer, langOf(request));
    const errors = answerErrors(survey, body.answers);
    if (errors.length) return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", errors);
    state.survey = "completed";
    customer.points += survey.rewardPoints;
    return HttpResponse.json({ status: "completed" as const, rewardPoints: survey.rewardPoints }, { status: 201 });
  }),

  // CONTRACT-REQUEST store.loyalty.campaigns
  mockRequest("GET /v1/store/loyalty/campaigns", ({ request }) => {
    const customer = customerOf(request);
    return customer ? { items: campaignsOf(customer, langOf(request)) } : unauthenticated();
  }),

  // CONTRACT-REQUEST store.loyalty.data-refresh
  mockRequest("GET /v1/store/loyalty/data-refresh", ({ request }) => {
    const customer = customerOf(request);
    return customer ? dataRefreshOf(customer) : unauthenticated();
  }),
  // CONTRACT-REQUEST store.loyalty.data-refresh: confirming early stamps the date but earns nothing
  mockRequest("POST /v1/store/loyalty/data-refresh/actions/confirm", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const state = stateOf(customer);
    if (state.dataConfirmedAt === null) customer.points += 12;
    state.dataConfirmedAt = bangkokIso();
    return dataRefreshOf(customer);
  }),

  // CONTRACT-REQUEST store.loyalty.showcase-consent
  mockRequest("GET /v1/store/loyalty/showcase-consent", ({ request }) => {
    const customer = customerOf(request);
    return customer ? stateOf(customer).showcase : unauthenticated();
  }),
  // CONTRACT-REQUEST store.loyalty.showcase-consent: grant → requested (Marketing approves); withdraw → withdrawn
  mockRequest("PUT /v1/store/loyalty/showcase-consent", ({ request, body }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const state = stateOf(customer);
    if (body.granted) {
      if (state.showcase.status === "requested")
        return problem(409, "showcase.consent_pending", "คำขอก่อนหน้ายังรอการตรวจสอบ");
      if (body.consentTextVersion !== SHOWCASE_TEXT_VERSION)
        return problem(422, "showcase.text_outdated", "ข้อความความยินยอมมีฉบับใหม่ กรุณาอ่านอีกครั้ง");
      state.showcase = {
        ...state.showcase,
        status: "requested",
        scope: body.scope,
        consentTextVersion: body.consentTextVersion,
        requestedAt: bangkokIso(),
        decidedAt: null,
      };
    } else {
      state.showcase = { ...state.showcase, status: "withdrawn", decidedAt: state.showcase.decidedAt };
    }
    return state.showcase;
  }),

  // store.reviews.get / submit are published; these keep the review per order so the order page's form, its
  // "รีวิวของคุณ" state and the P2 photos agree (the generated handler answers one fixed review for every order).
  http.get("*/v1/store/orders/:orderId/review", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const review = stateOf(customer).reviews.get(String(params.orderId));
    return review ? HttpResponse.json(review) : problem(404, "http.not_found", "ยังไม่มีรีวิว");
  }),
  http.post("*/v1/store/orders/:orderId/review", async ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const state = stateOf(customer);
    const orderId = String(params.orderId);
    if (state.reviews.has(orderId)) return problem(409, "reviews.exists", "รีวิวแล้ว");
    const body = (await request.json()) as Schemas["SubmitReviewDto"];
    const review: MockReview = {
      id: mockId("rvw", state.reviews.size + 1),
      orderId,
      orderCode: "OR-2610-0042",
      productTypeCode: "folding_carton",
      rating: body.rating,
      comment: body.comment ?? null,
      status: "pending",
      reply: null,
      // D-490: ฿25 at the seeded point value (2.50) = 10 points.
      rewardPoints: 10,
      createdAt: bangkokIso(),
      photos: [],
      photoRewardPoints: 0,
    };
    state.reviews.set(orderId, review);
    return HttpResponse.json(review, { status: 201 });
  }),

  // CONTRACT-REQUEST store.reviews.add-photos
  mockRequest("POST /v1/store/orders/{orderId}/review/photos", ({ request, params, body }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const review = stateOf(customer).reviews.get(params.orderId);
    if (!review) return problem(404, "http.not_found", "ยังไม่มีรีวิว");
    if (review.photos.length + body.photoFileIds.length > 4)
      return problem(422, "reviews.photo_limit", "แนบรูปได้สูงสุด 4 รูป");
    const first = review.photos.length === 0;
    review.photos.push(...body.photoFileIds.map((id) => ({ id, url: `/v1/store/catalog/images/${id}` })));
    if (first) {
      review.photoRewardPoints = 10;
      review.rewardPoints += 10;
    }
    return HttpResponse.json(review, { status: 201 });
  }),

  // CONTRACT-REQUEST store.promotions.add-bundle: the mock adds the customer's saved quotations (one per item, up to
  // the bundle's size) — it has no preset pricing of its own; the cart and its ETag are the real mock's.
  mockRequest("POST /v1/store/promotions/{promotionId}/actions/add-bundle", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    if (params.promotionId !== mockId("deal", 20))
      return problem(422, "promotions.not_bundle", "ดีลนี้ไม่ใช่ชุดสินค้า");
    const added = quotesOf(customer.persona)
      .slice(0, 2)
      .map((quote) => addToCart(customer, quote));
    return HttpResponse.json(toCartDto(customer), {
      status: 201,
      headers: { "X-Added-Item-Ids": added.join(",") },
    });
  }),
];
