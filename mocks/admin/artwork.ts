/**
 * The back office's artwork, proofs, templates, drawings and hired designs at their published
 * paths (`admin.artwork.*`, `admin.designServices.*`, `admin.designs.drawForOrder`,
 * `admin.files.download`; U-F0.3).
 *
 * The rows are the prepress desk's (`./prepress.ts`), the one stateful source of artwork: what
 * prepress accepts, sends or answers here is what the order screen, the workspace and the
 * customer's pages read. The projections onto the DTOs are the storefront mock's
 * (`../store/artwork.ts`), with staff shown by name. Each handler checks the operation's
 * `x-required-permissions`.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, type StaffPersona } from "../personas";
import { mockFileUrl, syncDesign, toDesignService, toProof, toSubmission, toTemplates } from "../store/artwork";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { baht, satang } from "./commerce";
import {
  byAnnotation,
  byDesignService,
  byProof,
  bySubmission,
  prepressOf,
  prepressRows,
  proofAnnotations,
  queueItems,
  refreshPrepress,
  rejectReasons,
  templateNotes,
  uploaded,
  type PrepressDetail,
  type QueueKind,
} from "./prepress";

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const notFound = (detail = "ไม่พบรายการนี้") => problem(404, "http.not_found", detail);
const QUEUE_KINDS: readonly QueueKind[] = ["submissions", "proofs_waiting", "changes_requested"];

function allowed(request: Request, permission: string): StaffPersona | null {
  const who = staffPersonaOf(request);
  return who && can(who, permission) ? who : null;
}

const pageOf = (url: URL) => ({
  page: Number(url.searchParams.get("page") ?? 1),
  perPage: Number(url.searchParams.get("perPage") ?? 25),
});

/** getpack-api's order statuses that still take artwork, and never once it is approved. */
const TAKES_ARTWORK = ["waiting_payment", "paid_for_production", "artwork_approved"];

/** An order's prepress row, with any delivered design round turned into its proof. */
function rowOf(orderId: string): PrepressDetail | undefined {
  const detail = prepressOf(orderId);
  return detail ? syncDesign(detail) : undefined;
}

function notAccepting(detail: PrepressDetail) {
  return detail.artworkStatus === "approved" || !TAKES_ARTWORK.includes(detail.orderStatus);
}

/** What the next revision costs, as getpack-api answers it once changes were requested (D-071). */
function withNextRevision(detail: PrepressDetail): Schemas["DesignServiceDto"] {
  const service = detail.designService!;
  const dto = toDesignService(detail, service);
  const last = service.rounds.at(-1);
  return {
    ...dto,
    nextRevision:
      service.status === "revision_requested" && last
        ? {
            revisionNo: last.roundNo,
            chargeable: last.chargeable,
            feeNet: last.feeAmount,
            // VAT on the API's fee, as getpack-api's settings compute it.
            feeGross: last.chargeable && last.feeAmount ? baht(Math.round(satang(last.feeAmount) * 1.07)) : null,
          }
        : dto.nextRevision,
  };
}

/** The note prepress gave when it accepted a file with warnings (`admin.artwork.accept`). */
export const acceptNotes = new Map<string, string>();

/** Answers already given by Idempotency-Key, so a retried delivery or requote replays the first. */
const replays = new Map<string, unknown>();
const keyOf = (request: Request) => {
  const key = request.headers.get("idempotency-key");
  return key ? `${new URL(request.url).pathname}:${key}` : null;
};
function replayed(request: Request): Response | null {
  const key = keyOf(request);
  return key && replays.has(key)
    ? HttpResponse.json(replays.get(key) as never, { headers: { "Idempotent-Replayed": "true" } })
    : null;
}
function remember(request: Request, body: Schemas["DesignServiceDto"]): Response {
  const key = keyOf(request);
  if (key) replays.set(key, body);
  return HttpResponse.json(body);
}

export const artworkContractHandlers = [
  http.get("*/v1/admin/prepress/queue", ({ request }) => {
    if (!allowed(request, "artwork.read")) return forbidden();
    const url = new URL(request.url);
    const asked = url.searchParams.get("kind") ?? "submissions";
    if (!QUEUE_KINDS.includes(asked as QueueKind))
      return problem(422, "validation.failed", "ไม่รู้จักคิวนี้", [{ path: "kind", code: "enum", message: asked }]);
    const q = url.searchParams.get("q") ?? undefined;
    const assigneeId = url.searchParams.get("assigneeId");
    const productTypeCode = url.searchParams.get("productTypeCode");
    const artworkStatus = url.searchParams.get("artworkStatus");
    const rows = queueItems(asked as QueueKind)
      .filter((row) => matchesQuery(q, row.orderCode))
      // `none` is the unassigned work, as getpack-api reads it.
      .filter((row) =>
        !assigneeId ? true : assigneeId === "none" ? row.assignee === null : row.assignee?.id === assigneeId,
      )
      .filter((row) => !productTypeCode || row.productTypeCode === productTypeCode)
      .filter((row) => !artworkStatus || row.artworkStatus === artworkStatus);
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),

  http.get("*/v1/admin/orders/:orderId/artwork-submissions", ({ params, request }) => {
    if (!allowed(request, "artwork.read")) return forbidden();
    const detail = rowOf(String(params.orderId));
    if (!detail) return notFound("ไม่พบคำสั่งซื้อนี้");
    return HttpResponse.json(detail.submissions.map((submission) => toSubmission(detail, submission)));
  }),

  // admin.artwork.accept (`prepress.review`): an optional note acknowledges the warnings accepted.
  http.post("*/v1/admin/artwork-submissions/:submissionId/actions/accept", async ({ params, request }) => {
    if (!allowed(request, "prepress.review")) return forbidden();
    const found = bySubmission(String(params.submissionId));
    if (!found) return notFound();
    const { detail, submission } = found;
    if (submission.status !== "submitted")
      return problem(409, "artwork.invalid_status", "รับไฟล์ฉบับนี้ไม่ได้ในขั้นตอนนี้");
    if (submission.preflightStatus === "pending" || submission.preflightStatus === "running")
      return problem(409, "artwork.preflight_pending", "กำลังตรวจไฟล์ รอผลก่อน");
    if (submission.preflightStatus === "blocked")
      return problem(409, "artwork.preflight_blocked", "ไฟล์มีจุดที่ต้องแก้ก่อนทำ Proof (D-070)");
    if (notAccepting(detail)) return problem(409, "artwork.not_accepting", "คำสั่งซื้อนี้ไม่รับไฟล์งานแล้ว");
    const body = (await request.json().catch(() => null)) as Schemas["OptionalNoteDto"] | null;
    submission.status = "accepted_for_proof";
    if (body?.note?.trim()) acceptNotes.set(submission.id, body.note.trim());
    detail.artworkStatus = "in_review";
    refreshPrepress(detail);
    return HttpResponse.json(toSubmission(detail, submission));
  }),

  http.post("*/v1/admin/artwork-submissions/:submissionId/actions/reject", async ({ params, request }) => {
    if (!allowed(request, "prepress.review")) return forbidden();
    const found = bySubmission(String(params.submissionId));
    if (!found) return notFound();
    const { detail, submission } = found;
    const body = (await request.json()) as Schemas["RejectSubmissionDto"];
    if (!body.reason?.trim())
      return problem(422, "validation.failed", "กรุณาระบุสิ่งที่ต้องแก้", [
        { path: "reason", code: "required", message: "required" },
      ]);
    if (submission.status !== "submitted" && submission.status !== "accepted_for_proof")
      return problem(409, "artwork.invalid_status", "ส่งคืนไฟล์ฉบับนี้ไม่ได้ในขั้นตอนนี้");
    if (notAccepting(detail)) return problem(409, "artwork.not_accepting", "คำสั่งซื้อนี้ไม่รับไฟล์งานแล้ว");
    submission.status = "rejected";
    rejectReasons.set(submission.id, body.reason.trim());
    // getpack-api: the order's artwork goes to changes_requested (D-070).
    detail.artworkStatus = "changes_requested";
    refreshPrepress(detail);
    return HttpResponse.json(toSubmission(detail, submission));
  }),

  http.get("*/v1/admin/orders/:orderId/proofs", ({ params, request }) => {
    if (!allowed(request, "artwork.read")) return forbidden();
    const detail = rowOf(String(params.orderId));
    if (!detail) return notFound("ไม่พบคำสั่งซื้อนี้");
    return HttpResponse.json(detail.proofs.map((proof) => toProof(detail, proof, "staff")));
  }),

  http.post("*/v1/admin/orders/:orderId/proofs", async ({ params, request }) => {
    const who = allowed(request, "prepress.review");
    if (!who) return forbidden();
    const detail = rowOf(String(params.orderId));
    if (!detail) return notFound("ไม่พบคำสั่งซื้อนี้");
    const body = (await request.json()) as Schemas["SendProofDto"];
    if (!body.proofFileId)
      return problem(422, "validation.failed", "แนบไฟล์ Proof", [
        { path: "proofFileId", code: "required", message: "required" },
      ]);
    if (notAccepting(detail)) return problem(409, "artwork.not_accepting", "คำสั่งซื้อนี้ไม่รับไฟล์งานแล้ว");
    const source = body.submissionId
      ? detail.submissions.find((item) => item.id === body.submissionId && item.status === "accepted_for_proof")
      : detail.submissions.find((item) => item.status === "accepted_for_proof");
    if (!source) return problem(409, "proofs.no_accepted_artwork", "ยังไม่มีไฟล์งานที่ผ่านการตรวจ");
    // The proof waiting for the customer is superseded by the new one.
    for (const item of detail.proofs) if (item.status === "pending_customer") item.status = "superseded";
    const versionNo = (detail.proofs[0]?.versionNo ?? 0) + 1;
    detail.proofs.unshift({
      id: mockId("prf", 8000 + versionNo + Math.floor(Math.random() * 900)),
      versionNo,
      submissionVersionNo: source.versionNo,
      status: "pending_customer",
      proofFile: uploaded(body.proofFileId, `${detail.orderCode}-proof-v${versionNo}.pdf`),
      dielineFile: body.dielineFileId ? uploaded(body.dielineFileId, `${detail.orderCode}-dieline.pdf`) : null,
      note: body.changeNote ?? null,
      preparedBy: { id: who.id, displayName: who.displayName },
      sentAt: bangkokIso(),
      decidedAt: null,
      decidedBy: null,
      decisionChannel: null,
      onBehalfReason: null,
      approvedFileSha256: null,
      annotations: { open: 0, resolved: 0 },
    });
    detail.artworkStatus = "proof_sent";
    refreshPrepress(detail);
    return HttpResponse.json(toProof(detail, detail.proofs[0]!, "staff"), { status: 201 });
  }),

  http.get("*/v1/admin/proofs/:proofId", ({ params, request }) => {
    if (!allowed(request, "artwork.read")) return forbidden();
    const found = byProof(String(params.proofId));
    if (!found) return notFound("ไม่พบ Proof นี้");
    return HttpResponse.json(toProof(found.detail, found.proof, "staff"));
  }),

  http.post("*/v1/admin/proofs/:proofId/annotations", async ({ params, request }) => {
    const who = allowed(request, "prepress.review");
    if (!who) return forbidden();
    const found = byProof(String(params.proofId));
    if (!found) return notFound("ไม่พบ Proof นี้");
    // Prepress answers while the customer decides, and after changes were requested (B4.1).
    if (found.proof.status !== "pending_customer" && found.proof.status !== "changes_requested")
      return problem(409, "proofs.annotation_closed", "Proof ฉบับนี้ปิดการแสดงความเห็นแล้ว");
    const body = (await request.json()) as Schemas["AnnotateProofDto"];
    const list = proofAnnotations.get(found.proof.id) ?? [];
    // A reply takes its parent's kind, page and geometry; a new annotation must give them.
    const parent = body.parentId ? list.find((item) => item.id === body.parentId) : undefined;
    if (body.parentId && !parent) return notFound("ไม่พบความเห็นที่ตอบกลับ");
    const kind = parent?.kind ?? body.kind;
    const page = parent?.page ?? body.page;
    const geometry = parent?.geometry ?? (body.geometry as Record<string, unknown> | undefined);
    if (!body.comment?.trim() || !kind || !geometry || !page)
      return problem(422, "validation.failed", "กรุณาพิมพ์ความเห็น", [
        { path: body.comment?.trim() ? "geometry" : "comment", code: "required", message: "required" },
      ]);
    proofAnnotations.set(found.proof.id, [
      ...list,
      {
        id: mockId("ann", 9000 + list.length + Math.floor(Math.random() * 900)),
        parentId: parent?.id ?? null,
        page,
        kind,
        geometry,
        comment: body.comment.trim(),
        author: { id: who.id, displayName: who.displayName },
        authorKind: "staff",
        createdAt: bangkokIso(),
        resolvedAt: null,
        resolvedBy: null,
      },
    ]);
    refreshPrepress(found.detail);
    return HttpResponse.json(toProof(found.detail, found.proof, "staff"), { status: 201 });
  }),

  http.post("*/v1/admin/proof-annotations/:annotationId/actions/resolve", ({ params, request }) => {
    const who = allowed(request, "prepress.review");
    if (!who) return forbidden();
    const found = byAnnotation(String(params.annotationId));
    if (!found) return notFound("ไม่พบความเห็นนี้");
    if (!found.annotation.resolvedAt) {
      found.annotation.resolvedAt = bangkokIso();
      found.annotation.resolvedBy = { id: who.id, displayName: who.displayName };
    }
    refreshPrepress(found.detail);
    return HttpResponse.json(toProof(found.detail, found.proof, "staff"));
  }),

  http.get("*/v1/admin/orders/:orderId/templates", ({ params, request }) => {
    if (!allowed(request, "artwork.read")) return forbidden();
    const detail = rowOf(String(params.orderId));
    if (!detail) return notFound("ไม่พบคำสั่งซื้อนี้");
    return HttpResponse.json(toTemplates(detail));
  }),

  http.post("*/v1/admin/orders/:orderId/templates", async ({ params, request }) => {
    const who = allowed(request, "prepress.review");
    if (!who) return forbidden();
    const detail = rowOf(String(params.orderId));
    if (!detail) return notFound("ไม่พบคำสั่งซื้อนี้");
    const body = (await request.json()) as Schemas["SendTemplateDto"];
    if (!body.fileId)
      return problem(422, "validation.failed", "แนบไฟล์แบบกล่อง", [
        { path: "fileId", code: "required", message: "required" },
      ]);
    if (notAccepting(detail)) return problem(409, "artwork.not_accepting", "คำสั่งซื้อนี้ไม่รับไฟล์งานแล้ว");
    const delivery = {
      id: mockId("dld", 100 + detail.templateDeliveries.length + Math.floor(Math.random() * 900)),
      trigger: "manual" as const,
      sentAt: bangkokIso(),
      sentBy: { id: who.id, displayName: who.displayName },
      file: uploaded(body.fileId, `${detail.orderCode}-template.pdf`),
    };
    detail.templateDeliveries.unshift(delivery);
    if (body.note) templateNotes.set(delivery.id, body.note);
    if (detail.artworkStatus === "awaiting_template") detail.artworkStatus = "awaiting_upload";
    refreshPrepress(detail);
    return HttpResponse.json(
      {
        id: delivery.id,
        fileId: delivery.file.id,
        note: body.note ?? null,
        sentAt: delivery.sentAt,
        trigger: delivery.trigger,
      } satisfies Schemas["DielineDeliveryDto"],
      { status: 201 },
    );
  }),

  // admin.designs.listOrderDrawings (`artwork.read`): the order's drawings, newest first.
  http.get("*/v1/admin/orders/:orderId/drawings", ({ params, request }) => {
    if (!allowed(request, "artwork.read")) return forbidden();
    const detail = rowOf(String(params.orderId));
    if (!detail) return notFound("ไม่พบคำสั่งซื้อนี้");
    return HttpResponse.json(
      detail.drawingJobs.map(
        (job) =>
          ({
            id: job.id,
            orderId: detail.orderId,
            format: job.format,
            status: job.status,
            engineVersion: job.engineVersion,
            error: job.error,
            patternId: mockId("pat", 1),
            measurementBasis: "internal",
            lengthMm: detail.dieline.lengthMm ?? 0,
            widthMm: detail.dieline.widthMm ?? 0,
            heightMm: detail.dieline.heightMm ?? 0,
            outputFileId: job.outputFile?.id ?? null,
            outputFile: job.outputFile
              ? {
                  id: job.outputFile.id,
                  originalName: job.outputFile.originalName,
                  mimeType: job.outputFile.mimeType,
                  sizeBytes: job.outputFile.sizeBytes,
                }
              : null,
            createdAt: job.createdAt,
            completedAt: job.status === "succeeded" ? job.createdAt : null,
          }) satisfies Schemas["DrawingJobDto"],
      ),
    );
  }),

  http.post("*/v1/admin/orders/:orderId/drawings", ({ params, request }) => {
    if (!allowed(request, "drawings.generate")) return forbidden();
    if (!rowOf(String(params.orderId))) return notFound("ไม่พบคำสั่งซื้อนี้");
    // B4.1: until @getpack/dieline is deployed server-side, the drawing service answers this.
    return problem(501, "drawing.engine_unavailable", "ระบบวาดแบบกล่องยังไม่พร้อมใช้งาน ส่งแบบจากไฟล์ที่มีอยู่แทน");
  }),

  http.get("*/v1/admin/design-services", ({ request }) => {
    const who = allowed(request, "artwork.read");
    if (!who) return forbidden();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const mine = url.searchParams.get("assignee") === "me";
    const rows = prepressRows()
      .filter((detail) => detail.designService)
      .map((detail) => withNextRevision(syncDesign(detail)))
      .filter((service) => !status || service.status === status)
      .filter((service) => !mine || service.assignee?.id === who.id);
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),

  http.get("*/v1/admin/design-services/:designServiceId", ({ params, request }) => {
    if (!allowed(request, "artwork.read")) return forbidden();
    const found = byDesignService(String(params.designServiceId));
    if (!found) return notFound("ไม่พบงานออกแบบนี้");
    return HttpResponse.json(withNextRevision(syncDesign(found.detail)));
  }),

  // admin.designServices.deliver (`design_services.manage`, optional Idempotency-Key).
  http.post("*/v1/admin/design-services/:designServiceId/actions/deliver", async ({ params, request }) => {
    if (!allowed(request, "design_services.manage")) return forbidden();
    const replay = replayed(request);
    if (replay) return replay;
    const found = byDesignService(String(params.designServiceId));
    if (!found) return notFound("ไม่พบงานออกแบบนี้");
    const body = (await request.json()) as Schemas["DeliverDesignDto"];
    if (!body.fileIds?.length)
      return problem(422, "validation.failed", "แนบไฟล์งานออกแบบ", [
        { path: "fileIds", code: "min", message: "required" },
      ]);
    const round = found.service.rounds.find((item) => item.status === "in_progress");
    if (!round || found.service.status !== "in_progress")
      return problem(409, "design_services.invalid_status", "ไม่มีรอบงานออกแบบที่กำลังทำ");
    round.status = "delivered";
    round.deliveredAt = bangkokIso();
    round.files = body.fileIds.map((id, at) => uploaded(id, `design-round-${round.roundNo}-${at + 1}.pdf`));
    round.note = body.note ?? null;
    found.service.status = "delivered";
    // The delivery becomes the proof the customer decides on (D-071).
    return remember(request, withNextRevision(syncDesign(refreshPrepress(found.detail))));
  }),

  // admin.designServices.requote (`design_services.manage`, optional Idempotency-Key).
  http.post("*/v1/admin/design-services/:designServiceId/actions/requote", async ({ params, request }) => {
    if (!allowed(request, "design_services.manage")) return forbidden();
    const replay = replayed(request);
    if (replay) return replay;
    const found = byDesignService(String(params.designServiceId));
    if (!found) return notFound("ไม่พบงานออกแบบนี้");
    const body = (await request.json()) as Schemas["CloseDesignServiceDto"];
    if (!body.reason?.trim())
      return problem(422, "validation.failed", "กรุณาระบุเหตุผล", [
        { path: "reason", code: "required", message: "required" },
      ]);
    if (!["in_progress", "revision_requested", "brief_pending"].includes(found.service.status))
      return problem(409, "design_services.invalid_status", "เสนอราคาใหม่ไม่ได้ในขั้นตอนนี้");
    found.service.status = "requoted";
    const dto = withNextRevision(refreshPrepress(found.detail));
    return remember(request, { ...dto, closeReason: body.reason.trim() });
  }),

  // admin.files.download: a file the mock drew or keeps; any other falls through to the example.
  http.get("*/v1/admin/files/:fileId/download", ({ params, request }) => {
    if (!staffPersonaOf(request)) return undefined;
    const url = mockFileUrl(String(params.fileId));
    if (!url) return undefined;
    return HttpResponse.json({ url, expiresAt: bangkokIso(5) } satisfies Schemas["DownloadUrlDto"]);
  }),
];
