/**
 * CONTRACT-REQUEST partner.references, partner.change-requests, partner.site-visits,
 * partner.proposal-evidence — the four requests the partner zone's onboarding and price screens
 * add to the published B2.2 surface (`src/lib/api/requests/partner-onboarding.ts`).
 *
 * The factory rows are the back office's (`mocks/admin/partners.ts`); change requests are new
 * state, seeded with one answered request for F001 so the list is not empty on first open.
 */

import { catalogueRows } from "../admin/catalogue";
import { PRODUCT_TYPES } from "../admin/catalog";
import { files } from "../admin/platform";
import { proposals } from "../admin/partners";
import { mockRequest, type MockContext } from "../route";
import { bangkokIso, mockId, problem } from "../support";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { RequestKey, Requests } from "@/lib/api/requests/registry";

import { own } from "./support";

type ChangeRequest = ResponseOf<Requests, "POST /v1/partner/factories/{factoryId}/change-requests">;
type Evidence = ResponseOf<Requests, "POST /v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence">;

const DAY = 24 * 60;
let seq = 1;

const changeRequests = new Map<string, ChangeRequest[]>([
  [
    "00000000-0000-4000-8000-0000000000f1",
    [
      {
        id: mockId("fcr", 900),
        topic: "capacity",
        productTypeId: PRODUCT_TYPES.find((type) => type.code === "folding_carton")?.id ?? null,
        productTypeCode: "folding_carton",
        message: "เพิ่มเครื่องพิมพ์อีกหนึ่งเครื่อง ขอปรับกำลังผลิตกล่องพับเป็น 12,000 แผ่นต่อสัปดาห์",
        preferredDates: [],
        status: "done",
        response: "ปรับกำลังผลิตให้แล้ว มีผลตั้งแต่สัปดาห์หน้า",
        createdBy: { id: mockId("pus", 1), displayName: "เจ้าของโรงงาน ตัวอย่าง (ข้อมูลจำลอง)" },
        createdAt: bangkokIso(-DAY * 20),
        updatedAt: bangkokIso(-DAY * 18),
      },
    ],
  ],
]);
const evidence = new Map<string, Evidence[]>();

/** The acting factory user, for a contract request under `/factories/{factoryId}`. */
const ownOf = (context: Pick<MockContext<RequestKey>, "request" | "params">, permission?: string) =>
  own(context.request, context.params.factoryId, permission);

/** Every catalogue record the factory's price columns may refer to, by column. */
function referenceColumns() {
  const pick = (table: "materials" | "printTypes" | "finishes", column: string) =>
    catalogueRows(table)
      .filter((row) => row.status === "active")
      .map((row) => ({
        column,
        id: String(row.id),
        code: typeof row.code === "string" ? row.code : null,
        name: String(row.nameTh ?? row.code ?? row.id),
      }));
  return [...pick("materials", "materialId"), ...pick("printTypes", "printTypeId"), ...pick("finishes", "finishId")];
}

export const onboardingRequestHandlers = [
  mockRequest("GET /v1/partner/factories/{factoryId}/references", (context) => {
    const ok = ownOf(context);
    if (ok instanceof Response) return ok;
    const codes = new Set([
      ...ok.store.capabilities.map((item) => item.productTypeCode),
      ...ok.store.priceLists.map((item) => item.productTypeCode),
      ...ok.store.config.participations.map((item) => item.productTypeCode),
    ]);
    return {
      productTypes: PRODUCT_TYPES.filter((type) => codes.has(type.code)).map((type) => ({
        id: type.id,
        code: type.code,
        name: type.nameTh,
      })),
      columns: referenceColumns(),
    };
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/change-requests", (context) => {
    const ok = ownOf(context);
    if (ok instanceof Response) return ok;
    return [...(changeRequests.get(ok.store.factory.id) ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }),
  mockRequest("POST /v1/partner/factories/{factoryId}/change-requests", ({ body, ...context }) => {
    const ok = ownOf(context);
    if (ok instanceof Response) return ok;
    const type = body.productTypeId ? PRODUCT_TYPES.find((candidate) => candidate.id === body.productTypeId) : null;
    if (body.productTypeId && !type)
      return problem(422, "validation.failed", "ไม่พบประเภทสินค้า", [
        { path: "productTypeId", code: "ref", message: "ไม่พบ" },
      ]);
    if (body.topic === "site_visit" && !body.preferredDates?.length)
      return problem(422, "validation.failed", "เลือกวันที่สะดวกอย่างน้อยหนึ่งวัน", [
        { path: "preferredDates", code: "required", message: "อย่างน้อยหนึ่งวัน" },
      ]);
    if (body.preferredDates?.some((day) => Date.parse(`${day}T23:59:59+07:00`) < Date.now()))
      return problem(422, "validation.failed", "วันที่สะดวกต้องเป็นวันนี้หรือหลังจากนี้", [
        { path: "preferredDates", code: "min", message: "ต้องไม่ใช่วันที่ผ่านมาแล้ว" },
      ]);
    const created: ChangeRequest = {
      id: mockId("fcr", seq++),
      topic: body.topic,
      productTypeId: type?.id ?? null,
      productTypeCode: type?.code ?? null,
      message: body.message,
      preferredDates: body.preferredDates ?? [],
      status: "open",
      response: null,
      createdBy: { id: ok.who.id, displayName: ok.who.displayName },
      createdAt: bangkokIso(),
      updatedAt: bangkokIso(),
    };
    changeRequests.set(ok.store.factory.id, [created, ...(changeRequests.get(ok.store.factory.id) ?? [])]);
    return created;
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/site-visits", (context) => {
    const ok = ownOf(context);
    if (ok instanceof Response) return ok;
    // The inspectors and the checklist stay with Packio; the factory sees the outcome.
    return ok.store.visits.map((visit) => ({
      id: visit.id,
      visitedOn: visit.visitedOn,
      result: visit.result,
      notes: visit.notes,
      createdAt: visit.createdAt,
    }));
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence", (context) => {
    const ok = ownOf(context, "factory_prices.read");
    if (ok instanceof Response) return ok;
    const item = proposals.find((c) => c.id === context.params.proposalId && c.factoryId === ok.store.factory.id);
    if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
    return evidence.get(item.id) ?? [];
  }),
  mockRequest(
    "POST /v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence",
    ({ body, ...context }) => {
      const ok = ownOf(context, "factory_prices.propose");
      if (ok instanceof Response) return ok;
      const item = proposals.find((c) => c.id === context.params.proposalId && c.factoryId === ok.store.factory.id);
      if (!item || item.direction !== "factory_to_packio") return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
      if (!["draft", "submitted", "under_review", "countered"].includes(item.status))
        return problem(409, "price.proposal_closed", "ข้อเสนอนี้ปิดไปแล้ว แนบหลักฐานเพิ่มไม่ได้");
      const file = files.get(body.fileId);
      if (!file)
        return problem(422, "validation.failed", "ไม่พบไฟล์ที่อัปโหลด", [
          { path: "fileId", code: "ref", message: "ไม่พบ" },
        ]);
      const created: Evidence = {
        id: mockId("pev", seq++),
        fileId: body.fileId,
        originalName: file.originalName,
        note: body.note ?? null,
        createdBy: { id: ok.who.id, displayName: ok.who.displayName },
        createdAt: bangkokIso(),
      };
      evidence.set(item.id, [...(evidence.get(item.id) ?? []), created]);
      return created;
    },
  ),
];
