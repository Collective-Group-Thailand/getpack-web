/**
 * Structural design requests and partner dieline intake (U3.6, D-272, D-273), for the three zones:
 * - `store.structuralRequests.*`: the customer asks for a structure the library lacks, follows it,
 *   cancels it while nobody works on it;
 * - `admin.structuralRequests.*`: CS assigns it, links a service RFQ when a fee applies or declines
 *   it; the structural designer delivers a dieline; Prepress approves it and publishes it as a base;
 * - `admin.styleIntakes.*` / `partner.styleIntakes.*`: a factory offers a DXF / PDF under the intake
 *   terms in force; Prepress matches it to a recipe with a deviation report, approves it as a
 *   recipe or a template, or rejects it.
 *
 * One seeded request (assigned) and one seeded offer (submitted) stand in for history.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { files } from "../admin/platform";
import { partnerPersonaOf, staffPersonaOf } from "../auth";
import { can, personaByKey } from "../personas";
import { canPartner } from "../partner/personas";
import { own } from "../partner/support";
import { mockRequest } from "../route";
import { bangkokIso, mockId, problem } from "../support";
import { customerByPersona, customerOf, type CustomerPersona } from "./customers";

type Request_ = Schemas["AdminStructuralRequestDto"];
type Intake = Schemas["StyleIntakeDto"];

interface Row {
  request: Request_;
  persona: CustomerPersona;
}

const F001 = { id: "00000000-0000-4000-8000-0000000000f1", code: "F001", name: "โรงงานตัวอย่าง (ข้อมูลจำลอง)" };
const TERMS: Schemas["IntakeTermsDto"] = {
  version: 1,
  effectiveFrom: "2026-10-01",
  textTh:
    "ร่างเงื่อนไขการรับแบบไดคัท (ข้อมูลจำลอง): โรงงานยืนยันว่ามีสิทธิ์ในแบบที่ส่ง และอนุญาตให้ getpack นำโครงสร้างไปใช้ในคลังแบบ โดยยังคงบันทึกที่มาของแบบไว้",
  textEn:
    "Draft dieline intake terms (mock data): the factory confirms it holds the rights to the structure it sends and allows getpack to use it in the style library, its origin recorded.",
};

const attached = (id: string): Schemas["AttachedFileDto"] => {
  const f = files.get(id);
  return {
    id,
    originalName: f?.originalName ?? "file",
    mimeType: f?.mimeType ?? "application/octet-stream",
    sizeBytes: f?.sizeBytes ?? 0,
  };
};
const userRef = (key: string): Schemas["UserRefDto"] => {
  const p = personaByKey(key)!;
  return { id: p.id, displayName: p.displayName };
};

let seq = 1;
const rows: Row[] = [];
const intakes: Intake[] = [];

function seed() {
  if (rows.length) return;
  const at = bangkokIso(-3 * 24 * 60);
  const customer = customerByPersona("returning");
  rows.push({
    persona: "returning",
    request: {
      id: mockId("strq", seq++),
      status: "assigned",
      productTypeCode: "folding",
      description: "กล่องใส่ขวดน้ำหอม 50 มล. ทรงหกเหลี่ยม มีช่องโชว์ขวด (ข้อมูลจำลอง)",
      sizes: { lengthMm: 60, widthMm: 60, heightMm: 140, measurementBasis: "internal" },
      quantity: 3000,
      files: [],
      deliveredFile: null,
      publishedBaseCode: null,
      serviceRfqId: null,
      createdAt: at,
      updatedAt: at,
      assignedAt: at,
      approvedAt: null,
      closedAt: null,
      closedReason: null,
      customer: { id: customer.id, displayName: customer.displayName },
      assignedTo: userRef("prepress"),
      approvedBy: null,
    },
  });
  const fileId = mockId("file-intake", 1);
  files.set(fileId, {
    id: fileId,
    originalName: "F001-mailer-tab-lock.dxf",
    mimeType: "application/dxf",
    sizeBytes: 18_432,
    createdAt: at,
    uploadStatus: "complete",
    scanStatus: "clean",
    retentionClass: "standard",
    sha256: "c0ffee".padEnd(64, "0"),
    thumbnailId: null,
    widthPx: null,
    heightPx: null,
    pageCount: null,
  } as never);
  intakes.push({
    id: mockId("intk", seq++),
    status: "submitted",
    title: "กล่องไปรษณีย์ลิ้นล็อกคู่ (ข้อมูลจำลอง)",
    note: "แบบที่โรงงานผลิตให้ลูกค้าประจำ ขนาด 250 × 180 × 80",
    proposedBaseCode: "PK-CF-01",
    factory: F001,
    file: attached(fileId),
    fileSha256: "c0ffee".padEnd(64, "0"),
    termsVersion: 1,
    deviations: null,
    matchedRecipe: null,
    resultRecipe: null,
    templateBaseCode: null,
    rejectReason: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: at,
  });
}

const notFound = () => problem(404, "http.not_found", "ไม่พบรายการนี้");
const forbidden = () => problem(403, "auth.forbidden", "บทบาทของคุณทำรายการนี้ไม่ได้");
const unauthenticated = () => problem(401, "auth.unauthenticated", "กรุณาเข้าสู่ระบบ");
const invalid = () => problem(409, "structural_requests.invalid_transition", "คำขอนี้อยู่ในขั้นที่ทำรายการนี้ไม่ได้");
const decided = () => problem(409, "styles.intake_decided", "แบบนี้ได้รับการพิจารณาแล้ว");
const required = (path: string) =>
  problem(422, "validation.failed", "ข้อมูลไม่ครบ", [{ path, code: "required", message: "required" }]);
const bodyOf = async <T>(request: Request) => (await request.json().catch(() => null)) as T | null;

const toStore = ({ request: r }: Row): Schemas["StructuralRequestDto"] => ({
  id: r.id,
  status: r.status,
  productTypeCode: r.productTypeCode,
  description: r.description,
  sizes: r.sizes,
  quantity: r.quantity,
  files: r.files,
  deliveredFile: r.deliveredFile,
  publishedBaseCode: r.publishedBaseCode,
  serviceRfqId: r.serviceRfqId,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  assignedAt: r.assignedAt,
  approvedAt: r.approvedAt,
  closedAt: r.closedAt,
  closedReason: r.closedReason,
});

function touch(row: Row, status: Schemas["StructuralRequestStatus"], extra: Partial<Request_> = {}) {
  Object.assign(row.request, { status, updatedAt: bangkokIso(), ...extra });
}

const staff = (request: Request, ...permissions: string[]) => {
  const persona = staffPersonaOf(request);
  return permissions.some((p) => can(persona, p)) ? persona : null;
};

/** The DXF a seeded offer stands for: a plain dieline drawing the review page can lay over a recipe. */
export const SEEDED_INTAKE_FILE = () => intakes[0]?.file.id;

export const structuralHandlers = [
  /* ------------------------------------------------------------------ store (the customer) */
  http.get("*/v1/store/structural-requests", ({ request }) => {
    seed();
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    return HttpResponse.json(
      rows
        .filter((r) => r.persona === customer.persona)
        .map(toStore)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }),
  http.get("*/v1/store/structural-requests/:requestId", ({ request, params }) => {
    seed();
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const row = rows.find((r) => r.request.id === params.requestId && r.persona === customer.persona);
    return row ? HttpResponse.json(toStore(row)) : notFound();
  }),
  http.post("*/v1/store/structural-requests", async ({ request }) => {
    seed();
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = await bodyOf<Schemas["CreateStructuralRequestDto"]>(request);
    if (!body?.description?.trim()) return required("description");
    if (!body.productTypeCode) return required("productTypeCode");
    const at = bangkokIso();
    const row: Row = {
      persona: customer.persona,
      request: {
        id: mockId("strq", seq++),
        status: "submitted",
        productTypeCode: body.productTypeCode,
        description: body.description.trim(),
        sizes:
          body.lengthMm || body.widthMm || body.heightMm
            ? {
                lengthMm: body.lengthMm ?? null,
                widthMm: body.widthMm ?? null,
                heightMm: body.heightMm ?? null,
                measurementBasis: body.measurementBasis ?? "internal",
              }
            : null,
        quantity: body.quantity ?? null,
        files: (body.fileIds ?? []).map(attached),
        deliveredFile: null,
        publishedBaseCode: null,
        serviceRfqId: null,
        createdAt: at,
        updatedAt: at,
        assignedAt: null,
        approvedAt: null,
        closedAt: null,
        closedReason: null,
        customer: { id: customer.id, displayName: customer.displayName },
        assignedTo: null,
        approvedBy: null,
      },
    };
    rows.push(row);
    return HttpResponse.json(toStore(row), { status: 201 });
  }),
  http.post("*/v1/store/structural-requests/:requestId/actions/cancel", ({ request, params }) => {
    seed();
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const row = rows.find((r) => r.request.id === params.requestId && r.persona === customer.persona);
    if (!row) return notFound();
    if (!["submitted", "assigned", "quoted"].includes(row.request.status)) return invalid();
    touch(row, "cancelled", { closedAt: bangkokIso(), closedReason: "cancelled_by_customer" });
    return HttpResponse.json(toStore(row));
  }),

  /* ------------------------------------------------------------------ admin (CS, designer, Prepress) */
  http.get("*/v1/admin/structural-requests", ({ request }) => {
    seed();
    if (!staff(request, "structural_requests.manage", "structural_requests.design")) return forbidden();
    const status = new URL(request.url).searchParams.get("status");
    return HttpResponse.json(
      rows
        .map((r) => r.request)
        .filter((r) => !status || r.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }),
  http.get("*/v1/admin/structural-requests/:requestId", ({ request, params }) => {
    if (params.requestId === "designers") return undefined;
    seed();
    if (!staff(request, "structural_requests.manage", "structural_requests.design")) return forbidden();
    const row = rows.find((r) => r.request.id === params.requestId);
    return row ? HttpResponse.json(row.request) : notFound();
  }),
  http.post("*/v1/admin/structural-requests/:requestId/actions/:action", async ({ request, params }) => {
    seed();
    const row = rows.find((r) => r.request.id === params.requestId);
    const action = String(params.action);
    const persona = staffPersonaOf(request);
    const needs: Record<string, string> = {
      assign: "structural_requests.manage",
      decline: "structural_requests.manage",
      "link-rfq": "structural_requests.manage",
      deliver: "structural_requests.design",
      approve: "styles.approve_recipe",
      publish: "styles.approve_recipe",
    };
    if (!needs[action]) return notFound();
    if (!can(persona, needs[action])) return forbidden();
    if (!row) return notFound();
    const s = row.request.status;
    const open = ["submitted", "assigned", "quoted"].includes(s);
    switch (action) {
      case "assign": {
        const body = await bodyOf<Schemas["AssignStructuralRequestDto"]>(request);
        const who = body?.assigneeId
          ? [...["prepress", "superadmin"]].map(personaByKey).find((p) => p?.id === body.assigneeId)
          : null;
        if (!who) return required("assigneeId");
        if (!open) return invalid();
        touch(row, s === "quoted" ? "quoted" : "assigned", {
          assignedAt: bangkokIso(),
          assignedTo: { id: who.id, displayName: who.displayName },
        });
        break;
      }
      case "decline": {
        const body = await bodyOf<Schemas["ReasonBodyDto"]>(request);
        if (!body?.reason?.trim()) return required("reason");
        if (!open) return invalid();
        touch(row, "declined", { closedAt: bangkokIso(), closedReason: body.reason.trim() });
        break;
      }
      case "link-rfq": {
        const body = await bodyOf<Schemas["LinkServiceRfqDto"]>(request);
        if (!body?.rfqId?.trim()) return required("rfqId");
        if (s !== "assigned") return invalid();
        touch(row, "quoted", { serviceRfqId: body.rfqId.trim() });
        break;
      }
      case "deliver": {
        const body = await bodyOf<Schemas["DeliverStructuralDesignDto"]>(request);
        if (!body?.dielineFileId) return required("dielineFileId");
        if (s !== "assigned" && s !== "quoted") return invalid();
        if (files.get(body.dielineFileId)?.uploadStatus === "pending")
          return problem(409, "file.not_ready", "ไฟล์ยังอัปโหลดไม่เสร็จ");
        touch(row, "delivered", { deliveredFile: attached(body.dielineFileId) });
        break;
      }
      case "approve":
        if (s !== "delivered") return invalid();
        touch(row, "approved", {
          approvedAt: bangkokIso(),
          approvedBy: { id: persona!.id, displayName: persona!.displayName },
        });
        break;
      case "publish": {
        const body = await bodyOf<Schemas["PublishStructuralDesignDto"]>(request);
        if (!body?.baseCode?.trim()) return required("baseCode");
        if (s !== "approved") return invalid();
        touch(row, "published", { publishedBaseCode: body.baseCode.trim(), closedAt: bangkokIso() });
        break;
      }
    }
    return HttpResponse.json(row.request);
  }),

  // CONTRACT-REQUEST admin.structural-request-designers — the staff holding structural_requests.design.
  mockRequest("GET /v1/admin/structural-requests/designers", ({ request }) => {
    if (!staff(request, "structural_requests.manage", "structural_requests.design")) return forbidden();
    return { data: (["prepress", "superadmin"] as const).map(userRef) };
  }),

  /* ------------------------------------------------------------------ admin (dieline offers) */
  http.get("*/v1/admin/style-intakes", ({ request }) => {
    seed();
    if (!staff(request, "styles.import", "styles.approve_recipe")) return forbidden();
    const status = new URL(request.url).searchParams.get("status");
    return HttpResponse.json(
      intakes.filter((i) => !status || i.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }),
  http.get("*/v1/admin/style-intakes/:intakeId", ({ request, params }) => {
    seed();
    if (!staff(request, "styles.import", "styles.approve_recipe")) return forbidden();
    const intake = intakes.find((i) => i.id === params.intakeId);
    return intake ? HttpResponse.json(intake) : notFound();
  }),
  http.post("*/v1/admin/style-intakes/:intakeId/actions/:action", async ({ request, params }) => {
    seed();
    const action = String(params.action);
    const persona = staffPersonaOf(request);
    const needs: Record<string, string> = {
      match: "styles.import",
      approve: "styles.approve_recipe",
      reject: "styles.approve_recipe",
    };
    if (!needs[action]) return notFound();
    if (!can(persona, needs[action])) return forbidden();
    const intake = intakes.find((i) => i.id === params.intakeId);
    if (!intake) return notFound();
    if (["approved_recipe", "approved_template", "rejected"].includes(intake.status)) return decided();
    const reviewed = { reviewedAt: bangkokIso(), reviewedBy: { id: persona!.id, displayName: persona!.displayName } };
    if (action === "match") {
      const body = await bodyOf<Schemas["MatchStyleIntakeDto"]>(request);
      if (!body?.recipeId) return required("recipeId");
      Object.assign(intake, {
        status: "matched",
        matchedRecipe: { id: body.recipeId, baseCode: intake.proposedBaseCode ?? "PK-CF-01", version: 1 },
        deviations: body.deviations ?? [],
        ...reviewed,
      });
    } else if (action === "approve") {
      const body = await bodyOf<Schemas["ApproveStyleIntakeDto"]>(request);
      if (!body?.as) return required("as");
      if (body.as === "template" && !body.baseCode?.trim()) return required("baseCode");
      if (body.as === "recipe" && !body.recipeId?.trim()) return required("recipeId");
      Object.assign(intake, {
        status: body.as === "recipe" ? "approved_recipe" : "approved_template",
        resultRecipe:
          body.as === "recipe"
            ? {
                id: body.recipeId!.trim(),
                baseCode: body.baseCode?.trim() || intake.proposedBaseCode || "PK-CF-01",
                version: 1,
              }
            : null,
        templateBaseCode: body.as === "template" ? body.baseCode!.trim() : null,
        ...reviewed,
      });
    } else {
      const body = await bodyOf<Schemas["ReasonBodyDto"]>(request);
      if (!body?.reason?.trim()) return required("reason");
      Object.assign(intake, { status: "rejected", rejectReason: body.reason.trim(), ...reviewed });
    }
    return HttpResponse.json(intake);
  }),

  /* ------------------------------------------------------------------ partner (the factory) */
  http.get("*/v1/partner/style-intake-terms", ({ request }) => {
    if (!partnerPersonaOf(request)) return unauthenticated();
    return HttpResponse.json(TERMS);
  }),
  http.get("*/v1/partner/factories/:factoryId/style-intakes", ({ request, params }) => {
    seed();
    const ok = own(request, params.factoryId);
    if (ok instanceof Response) return ok;
    return HttpResponse.json(
      intakes
        .filter((i) => i.factory.id === ok.store.factory.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }),
  http.post("*/v1/partner/factories/:factoryId/style-intakes", async ({ request, params }) => {
    seed();
    const ok = own(request, params.factoryId);
    if (ok instanceof Response) return ok;
    if (!canPartner(ok.who, "factory_style_intakes.submit")) return forbidden();
    const body = await bodyOf<Schemas["SubmitStyleIntakeDto"]>(request);
    if (!body?.title?.trim()) return required("title");
    if (!body.fileId) return required("fileId");
    if (body.acceptedTermsVersion !== TERMS.version)
      return problem(409, "styles.intake_terms_outdated", "เงื่อนไขการรับแบบมีฉบับใหม่");
    const f = ok.store.factory;
    const intake: Intake = {
      id: mockId("intk", seq++),
      status: "submitted",
      title: body.title.trim(),
      note: body.note?.trim() || null,
      proposedBaseCode: body.baseCode?.trim() || null,
      factory: { id: f.id, code: f.code, name: f.tradeName ?? f.legalName },
      file: attached(body.fileId),
      fileSha256: (files.get(body.fileId)?.sha256 as string | null) ?? "0".repeat(64),
      termsVersion: TERMS.version,
      deviations: null,
      matchedRecipe: null,
      resultRecipe: null,
      templateBaseCode: null,
      rejectReason: null,
      reviewedAt: null,
      reviewedBy: null,
      createdAt: bangkokIso(),
    };
    intakes.push(intake);
    return HttpResponse.json(intake, { status: 201 });
  }),
];
