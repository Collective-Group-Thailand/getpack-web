/**
 * What the partner zone's onboarding and price screens read beyond packio-api B2.2, published in
 * contract v0.6.0 (U-B0.3): the catalogue names behind the factory's price lines
 * (`partner.factories.priceReferences`, names only — D-044), its requests to the Partner team
 * (`partner.changeRequests.*`), its site visits (`partner.factories.listSiteVisits`, date and result
 * only — D-041) and the evidence on its price proposals (`partner.priceProposals.*Evidence`, D-040).
 *
 * The factory rows are the back office's (`mocks/admin/partners.ts`); change requests are new
 * state, seeded with one answered request for F001 so the list is not empty on first open.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { catalogueRows } from "../admin/catalogue";
import { PRODUCT_TYPES } from "../admin/catalog";
import { files } from "../admin/platform";
import { proposals } from "../admin/partners";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { pageQuery } from "./billing";
import { once, own } from "./support";

type ChangeRequest = Schemas["FactoryChangeRequestDto"];
type Evidence = Schemas["ProposalEvidenceDto"];

const DAY = 24 * 60;
const F001 = "00000000-0000-4000-8000-0000000000f1";
let seq = 1;

const TOPICS: readonly Schemas["FactoryChangeRequestTopic"][] = [
  "capability",
  "capacity",
  "delivery_zones",
  "tolerance",
  "participation_tier",
  "pricing_arrangement",
  "payout_policy",
  "site_visit",
  "other",
];

const changeRequests = new Map<string, ChangeRequest[]>([
  [
    F001,
    [
      {
        id: mockId("fcr", 900),
        factoryId: F001,
        factoryCode: "F001",
        topic: "capacity",
        message: "[กล่องพับ] เพิ่มเครื่องพิมพ์อีกหนึ่งเครื่อง ขอปรับกำลังผลิตกล่องพับเป็น 12,000 แผ่นต่อสัปดาห์",
        preferredDates: [],
        status: "done",
        response: "ปรับกำลังผลิตให้แล้ว มีผลตั้งแต่สัปดาห์หน้า",
        respondedAt: bangkokIso(-DAY * 18),
        respondedBy: { id: mockId("stf", 40), displayName: "ทีมพาร์ตเนอร์ ตัวอย่าง (ข้อมูลจำลอง)" },
        createdBy: { id: mockId("pus", 1), displayName: "เจ้าของโรงงาน ตัวอย่าง (ข้อมูลจำลอง)" },
        createdAt: bangkokIso(-DAY * 20),
      },
    ],
  ],
]);
const evidence = new Map<string, Evidence[]>();

/** The catalogue rows a factory's price columns may refer to, by catalogue table. */
function catalogueReferences(): Schemas["CatalogueReferenceDto"][] {
  const pick = (table: "materials" | "printTypes" | "finishes", catalogue: string) =>
    catalogueRows(table)
      .filter((row) => row.status === "active")
      .map((row) => ({
        catalogue,
        id: String(row.id),
        code: typeof row.code === "string" ? row.code : null,
        nameTh: typeof row.nameTh === "string" ? row.nameTh : null,
        nameEn: typeof row.nameEn === "string" ? row.nameEn : null,
      }));
  return [...pick("materials", "materials"), ...pick("printTypes", "print_types"), ...pick("finishes", "finishes")];
}

const afterToday = (day: string) => Date.parse(`${day}T00:00:00+07:00`) > Date.now();

export const onboardingHandlers = [
  http.get("*/v1/partner/factories/:factoryId/references", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.read");
    if (ok instanceof Response) return ok;
    const codes = new Set([
      ...ok.store.capabilities.map((item) => item.productTypeCode),
      ...ok.store.priceLists.map((item) => item.productTypeCode),
      ...ok.store.config.participations.map((item) => item.productTypeCode),
    ]);
    return HttpResponse.json({
      productTypes: PRODUCT_TYPES.filter((type) => codes.has(type.code)).map((type) => ({
        id: type.id,
        code: type.code,
        nameTh: type.nameTh,
        nameEn: type.nameEn ?? null,
      })),
      items: catalogueReferences(),
    } satisfies Schemas["PriceReferencesDto"]);
  }),

  http.get("*/v1/partner/factories/:factoryId/change-requests", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const rows = [...(changeRequests.get(ok.store.factory.id) ?? [])]
      .filter((item) => !status || item.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  http.post("*/v1/partner/factories/:factoryId/change-requests", async ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.manage");
    if (ok instanceof Response) return ok;
    const body = (await request
      .clone()
      .json()
      .catch(() => ({}))) as Partial<Schemas["CreateFactoryChangeRequestDto"]>;
    const create = () => {
      const message = body.message?.trim() ?? "";
      if (!body.topic || !TOPICS.includes(body.topic))
        return problem(422, "validation.failed", "เลือกหัวข้อ", [{ path: "topic", code: "enum", message: "หัวข้อ" }]);
      if (message.length < 3 || message.length > 2000)
        return problem(422, "validation.failed", "อย่างน้อย 3 ตัวอักษร", [
          { path: "message", code: "too_small", message: "อย่างน้อย 3 ตัวอักษร" },
        ]);
      const preferredDates = body.preferredDates ?? [];
      // A site visit needs at least one day after today (Asia/Bangkok).
      if (body.topic === "site_visit" && !preferredDates.some(afterToday))
        return problem(422, "validation.failed", "เลือกวันที่สะดวกหลังวันนี้อย่างน้อยหนึ่งวัน", [
          { path: "preferredDates", code: "required", message: "อย่างน้อยหนึ่งวันหลังวันนี้" },
        ]);
      const created: ChangeRequest = {
        id: mockId("fcr", seq++),
        factoryId: ok.store.factory.id,
        factoryCode: ok.store.factory.code,
        topic: body.topic,
        message,
        preferredDates,
        status: "open",
        response: null,
        respondedAt: null,
        respondedBy: null,
        createdBy: { id: ok.who.id, displayName: ok.who.displayName },
        createdAt: bangkokIso(),
      };
      changeRequests.set(ok.store.factory.id, [created, ...(changeRequests.get(ok.store.factory.id) ?? [])]);
      return HttpResponse.json(created, { status: 201 });
    };
    // Idempotency-Key is optional here (recommended): sent, a replay answers the first request.
    return request.headers.get("idempotency-key")
      ? once(request, `change-request:${ok.store.factory.id}`, create)
      : create();
  }),

  http.get("*/v1/partner/factories/:factoryId/site-visits", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_profile.read");
    if (ok instanceof Response) return ok;
    // The inspectors, the checklist and Packio's notes stay with the Partner team (D-041).
    return HttpResponse.json(
      [...ok.store.visits]
        .sort((a, b) => b.visitedOn.localeCompare(a.visitedOn))
        .map((visit) => ({
          id: visit.id,
          visitedOn: visit.visitedOn,
          result: visit.result,
          createdAt: visit.createdAt,
        })) satisfies Schemas["PartnerSiteVisitDto"][],
    );
  }),

  http.get("*/v1/partner/factories/:factoryId/price-proposals/:proposalId/evidence", ({ request, params }) => {
    const ok = own(request, params.factoryId, "factory_prices.read");
    if (ok instanceof Response) return ok;
    const item = proposals.find((c) => c.id === params.proposalId && c.factoryId === ok.store.factory.id);
    if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
    return HttpResponse.json(evidence.get(item.id) ?? []);
  }),
  http.post("*/v1/partner/factories/:factoryId/price-proposals/:proposalId/evidence", async ({ request, params }) => {
    const body = (await request
      .clone()
      .json()
      .catch(() => ({}))) as Partial<Schemas["AddProposalEvidenceDto"]>;
    return once(request, `proposal-evidence:${String(params.proposalId)}`, () => {
      const ok = own(request, params.factoryId, "factory_prices.propose");
      if (ok instanceof Response) return ok;
      const item = proposals.find((c) => c.id === params.proposalId && c.factoryId === ok.store.factory.id);
      if (!item || item.direction !== "factory_to_packio") return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
      if (!["draft", "submitted", "under_review", "countered"].includes(item.status))
        return problem(409, "partners.proposal_closed", "ข้อเสนอนี้ปิดไปแล้ว แนบหลักฐานเพิ่มไม่ได้");
      if ((body.note?.length ?? 0) > 500)
        return problem(422, "validation.failed", "ไม่เกิน 500 ตัวอักษร", [
          { path: "note", code: "too_big", message: "ไม่เกิน 500 ตัวอักษร" },
        ]);
      // An uploaded, clean file of the signed-in user (the presign flow completed).
      const file = body.fileId ? files.get(body.fileId) : undefined;
      if (!file || file.uploadStatus !== "uploaded")
        return problem(422, "validation.failed", "ไม่พบไฟล์ที่อัปโหลด", [
          { path: "fileId", code: "ref", message: "ไม่พบ" },
        ]);
      const list = [
        ...(evidence.get(item.id) ?? []),
        {
          fileId: file.id,
          fileName: file.originalName,
          mimeType: file.mimeType,
          note: body.note?.trim() || null,
          addedBy: { id: ok.who.id, displayName: ok.who.displayName },
          addedAt: bangkokIso(),
        },
      ];
      evidence.set(item.id, list);
      return HttpResponse.json(list, { status: 201 });
    });
  }),
];
