/**
 * The factory's working calendar and the partner knowledge base (U2.F7), `partner.calendar.*` and
 * `partner.knowledgeBase.*` (contract v0.41.0):
 *
 * - business hours are versions with an effective date (tomorrow at the earliest); the one in force
 *   is the latest that has started, and a later one waits;
 * - closures are days the factory sets itself, alongside the public holidays the platform seeds;
 * - the knowledge base is a fixed set of published guides, searchable and filtered by category.
 *
 * Mock-only rows, per factory and per process.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { addDays, pageQuery } from "./billing";
import { own, ownScope } from "./support";

type HoursVersion = Schemas["FactoryHoursVersionDto"];
type CalendarDay = Schemas["CalendarDayDto"];
type Article = Schemas["KnowledgeArticleDto"];

const today = () => bangkokIso().slice(0, 10);
const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const invalid = (path: string, message: string) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path, code: "invalid", message }]);

const WEEKDAY = { from: "08:00", to: "17:00" };
const hours = new Map<string, HoursVersion[]>();
const closures = new Map<string, CalendarDay[]>();

function hoursOf(factoryId: string): HoursVersion[] {
  if (!hours.has(factoryId))
    hours.set(factoryId, [
      {
        id: mockId("fhv", hours.size + 1),
        effectiveFrom: addDays(today(), -120),
        createdAt: `${addDays(today(), -121)}T10:00:00+07:00`,
        hours: {
          mon: WEEKDAY,
          tue: WEEKDAY,
          wed: WEEKDAY,
          thu: WEEKDAY,
          fri: WEEKDAY,
          sat: { from: "08:00", to: "12:00" },
          sun: null,
        },
        inForce: true,
      },
    ]);
  const rows = hours.get(factoryId)!;
  const current = rows
    .filter((row) => row.effectiveFrom <= today())
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  return rows
    .map((row) => ({ ...row, inForce: row.id === current?.id }))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
}

function closuresOf(factoryId: string): CalendarDay[] {
  if (!closures.has(factoryId))
    closures.set(factoryId, [
      {
        day: addDays(today(), 12),
        kind: "holiday",
        nameTh: "วันหยุดนักขัตฤกษ์ (ข้อมูลจำลอง)",
        nameEn: "Public holiday (mock data)",
        observance: "all",
        updatedAt: bangkokIso(),
      },
    ]);
  return closures.get(factoryId)!;
}

const doc = (...paragraphs: string[]) => ({
  type: "doc",
  content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

const CATEGORIES: Schemas["StoreArticleCategoryDto"][] = [
  { slug: "qc-photo-standard", nameTh: "มาตรฐานรูป QC", nameEn: "QC photo standard" },
  { slug: "shipping", nameTh: "การส่งของ", nameEn: "Shipping" },
  { slug: "billing", nameTh: "วางบิลและรับเงิน", nameEn: "Billing and payouts" },
];

const ARTICLES: Article[] = [
  {
    slug: "qc-photos",
    categorySlugs: ["qc-photo-standard"],
    titleTh: "ถ่ายรูป QC ให้ผ่านในครั้งเดียว",
    titleEn: "QC photos that pass the first time",
    excerptTh: "แสง มุม และสิ่งที่ต้องเห็นในรูป (ข้อมูลจำลอง)",
    excerptEn: "Light, angle and what each photo must show (mock data)",
    publishedAt: "2026-09-01T09:00:00+07:00",
    bodySchemaVersion: 1,
    body: {
      th: doc("ถ่ายในที่แสงพอ เห็นสีงานพิมพ์ชัด (ข้อมูลจำลอง)", "ถ่ายด้านหน้า ด้านข้าง และรอยพับ อย่างละหนึ่งรูป"),
      en: doc(
        "Shoot in good light so the print colour shows (mock data)",
        "One photo each of the front, the side and the folds",
      ),
    },
  },
  {
    slug: "pallet-labels",
    categorySlugs: ["shipping"],
    titleTh: "ติดป้ายพาเลทและกล่อง",
    titleEn: "Labelling pallets and cartons",
    excerptTh: "ป้ายที่ระบบพิมพ์ให้ ติดตรงไหน (ข้อมูลจำลอง)",
    excerptEn: "Where the printed labels go (mock data)",
    publishedAt: "2026-08-20T09:00:00+07:00",
    bodySchemaVersion: 1,
    body: {
      th: doc("ติดป้ายทุกกล่องด้านที่หันออก (ข้อมูลจำลอง)"),
      en: doc("Label every carton on the outward face (mock data)"),
    },
  },
  {
    slug: "billing-statements",
    categorySlugs: ["billing"],
    titleTh: "ใบวางบิลกับใบกำกับภาษี",
    titleEn: "Billing statements and tax invoices",
    excerptTh: "ยืนยันใบวางบิล แล้วส่งใบกำกับภาษี (ข้อมูลจำลอง)",
    excerptEn: "Confirm the statement, then send the tax invoice (mock data)",
    publishedAt: "2026-08-10T09:00:00+07:00",
    bodySchemaVersion: 1,
    body: {
      th: doc("ยืนยันใบวางบิลก่อน แล้วแนบใบกำกับภาษี (ข้อมูลจำลอง)"),
      en: doc("Confirm the statement first, then attach the tax invoice (mock data)"),
    },
  },
];

const card = ({ body: _body, bodySchemaVersion: _version, ...rest }: Article): Schemas["KnowledgeArticleCardDto"] =>
  rest;

export const calendarHandlers = [
  http.get("*/v1/partner/factories/:factoryId/business-hours", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json(hoursOf(ok.store.factory.id));
  }),
  http.put("*/v1/partner/factories/:factoryId/business-hours", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.manage");
    if (ok instanceof Response) return ok;
    const body = (await request.json()) as Schemas["SetFactoryHoursDto"];
    if (!isDay(body.effectiveFrom) || body.effectiveFrom <= today())
      return invalid("effectiveFrom", "วันเริ่มใช้ต้องเป็นวันพรุ่งนี้หรือหลังจากนั้น");
    for (const [day, span] of Object.entries(body.hours ?? {}))
      if (span && (!isTime(span.from) || !isTime(span.to) || span.from >= span.to))
        return invalid(`hours.${day}`, "เวลาเปิดต้องก่อนเวลาปิด");
    const rows = hoursOf(ok.store.factory.id).filter((row) => row.effectiveFrom !== body.effectiveFrom);
    const version: HoursVersion = {
      id: mockId("fhv", 100 + rows.length + Math.floor(Math.random() * 1000)),
      effectiveFrom: body.effectiveFrom,
      createdAt: bangkokIso(),
      hours: body.hours,
      inForce: false,
    };
    hours.set(ok.store.factory.id, [...rows, version]);
    return HttpResponse.json(version);
  }),
  http.get("*/v1/partner/factories/:factoryId/closures", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.read");
    if (ok instanceof Response) return ok;
    const from = new URL(request.url).searchParams.get("from");
    const start = isDay(from) ? from : today();
    return HttpResponse.json(
      closuresOf(ok.store.factory.id)
        .filter((row) => row.day >= start)
        .sort((a, b) => a.day.localeCompare(b.day)),
    );
  }),
  http.put("*/v1/partner/factories/:factoryId/closures/:day", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.manage");
    if (ok instanceof Response) return ok;
    const day = String(params.day);
    const body = (await request.json()) as Schemas["PutClosureDto"];
    if (!isDay(day) || day <= today()) return invalid("day", "วันปิดต้องเป็นวันในอนาคต");
    if (!body.nameTh?.trim()) return invalid("nameTh", "กรุณาระบุชื่อ");
    const row: CalendarDay = {
      day,
      kind: "closure",
      nameTh: body.nameTh.trim(),
      nameEn: body.nameEn ?? null,
      observance: "all",
      updatedAt: bangkokIso(),
    };
    closures.set(ok.store.factory.id, [...closuresOf(ok.store.factory.id).filter((item) => item.day !== day), row]);
    return HttpResponse.json(row);
  }),
  http.delete("*/v1/partner/factories/:factoryId/closures/:day", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.manage");
    if (ok instanceof Response) return ok;
    const rows = closuresOf(ok.store.factory.id);
    const row = rows.find((item) => item.day === params.day);
    // Public holidays are the platform's; the factory removes only its own closures.
    if (!row || row.kind !== "closure") return problem(404, "http.not_found", "ไม่พบวันปิดนี้");
    closures.set(
      ok.store.factory.id,
      rows.filter((item) => item !== row),
    );
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/v1/partner/knowledge-base/categories", ({ request }) => {
    // Any signed-in factory user reads the knowledge base; the factory comes from the token.
    const ok = ownScope(request);
    if (ok instanceof Response) return ok;
    return HttpResponse.json(CATEGORIES);
  }),
  http.get("*/v1/partner/knowledge-base/articles", ({ request }) => {
    // Any signed-in factory user reads the knowledge base; the factory comes from the token.
    const ok = ownScope(request);
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const category = url.searchParams.get("category");
    const rows = ARTICLES.filter((row) => !category || row.categorySlugs.includes(category))
      .filter((row) => matchesQuery(q, row.titleTh, row.titleEn ?? "", row.excerptTh ?? "", row.excerptEn ?? ""))
      .map(card);
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  http.get("*/v1/partner/knowledge-base/articles/:slug", ({ request, params }) => {
    // Any signed-in factory user reads the knowledge base; the factory comes from the token.
    const ok = ownScope(request);
    if (ok instanceof Response) return ok;
    const row = ARTICLES.find((item) => item.slug === params.slug);
    return row ? HttpResponse.json(row) : problem(404, "http.not_found", "ไม่พบคู่มือนี้");
  }),
];
