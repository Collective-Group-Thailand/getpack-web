/**
 * Artwork, proofs and design services from the customer's side, at their published paths
 * (`store.artwork.*`, `store.designServices.*`, `store.files.download`; U-F0.2).
 *
 * The rows are the prepress desk's (`../admin/prepress.ts`): an upload here is the submission
 * prepress checks, a proof prepress sends is the one the customer reviews, a comment is one thread
 * both reply to. This file projects them onto the published DTOs, for this zone and for the back
 * office's own operations (`../admin/artwork.ts`), which show staff by name.
 *
 * Proof pages and the dieline template are drawn with `@getpack/dieline` from the order's box size —
 * obviously fake artwork on the real outline — and served as SVG through `store.files.download`,
 * so the viewer has something true-to-shape to zoom, overlay and annotate.
 *
 * As in getpack-api, a designer's delivery (hired design, D-071) is a proof: approving it approves
 * the design, asking for changes opens the next free round; a charged round is confirmed with the
 * fee the customer saw.
 */

import {
  allFaces,
  buildStyle,
  dielineLines,
  dielineToSvg,
  faceBounds,
  REFERENCE_MATERIALS,
  svgPathData,
} from "@getpack/dieline";
import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { catalogueRows } from "../admin/catalogue";
import { baht, orders, refreshOrder, satang } from "../admin/commerce";
import {
  customerAnnotate,
  customerDecide,
  customerSubmit,
  prepressIfAny,
  prepressOf,
  proofAnnotations,
  refreshPrepress,
  rejectReasons,
  templateNotes,
  type PrepressDetail,
} from "../admin/prepress";
import { fileDataUrl, files } from "../admin/platform";
import { rfqs } from "../admin/rfq";
import { bangkokIso, mockId, problem } from "../support";
import { groupForOrder } from "./checkout";
import { customerOf, type MockCustomer } from "./customers";
import { ownerIdOf } from "./owner";
import {
  DESIGN_ROUND_STATUS,
  DESIGN_SERVICE_STATUS,
  PREFLIGHT_STATUS,
  PROOF_STATUS,
  SUBMISSION_STATUS,
} from "@/domain/status";
import { statusLabels } from "../status-labels";

type Proof = PrepressDetail["proofs"][number];
type Submission = PrepressDetail["submissions"][number];
type Service = NonNullable<PrepressDetail["designService"]>;

const DIELINE_KEYS: Record<string, string> = { "RTE-01": "reverse-tuck-end", "RSC-01": "rsc", "TRAY-01": "tray" };
/** The `artwork.approval_checklist` setting, as the mock has it. */
const APPROVAL_CHECKLIST: Schemas["ArtworkChecklistItemDto"][] = [
  { key: "text_spelling", labelTh: "ตรวจตัวสะกดและข้อความครบแล้ว", labelEn: "Spelling and text checked" },
  {
    key: "colours",
    labelTh: "สีบนจอใช้อ้างอิงเท่านั้น สีพิมพ์จริงอาจต่างเล็กน้อย",
    labelEn: "Screen colours are a guide only",
  },
  { key: "size_and_cut", labelTh: "ขนาดกล่องและเส้นไดคัทถูกต้อง", labelEn: "Box size and cut lines are right" },
];
/** What the customer confirmed when approving, per proof. */
const decisionChecklists = new Map<string, string[]>();
const BOARD = REFERENCE_MATERIALS["board-350"];
const PALETTE = ["#1f6f5c", "#b4532a", "#3b5ba5", "#8a3f8f"];
const TEAM = "ทีม getpack";

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");
const keyRequired = (request: Request) =>
  request.headers.get("idempotency-key")
    ? null
    : problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้");

const svgUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
/** What `store.files.download` hands back for a file the mock drew (proof pages, overlays, templates). */
const drawn = new Map<string, string>();

/** A file the mock drew, or one it keeps the bytes of, as a data URL — for either zone's download. */
export function mockFileUrl(fileId: string): string | null {
  return (
    drawn.get(fileId) ??
    fileDataUrl(fileId) ??
    (files.get(fileId)
      ? `data:text/plain;charset=utf-8,${encodeURIComponent(`${files.get(fileId)!.originalName} (ข้อมูลจำลอง)`)}`
      : null) ??
    podPhotoUrl(fileId) ??
    rfqs.flatMap((rfq) => rfq.files).find((file) => file.id === fileId)?.url ??
    null
  );
}

/** A proof-of-delivery photo of a seeded delivery (the factory's upload, kept on the order row). */
function podPhotoUrl(fileId: string): string | null {
  for (const order of orders)
    for (const shipment of order.shipments) {
      const photo = shipment.pod?.photos.find((candidate) => candidate.id === fileId);
      if (photo)
        return (
          photo.url ?? `data:text/plain;charset=utf-8,${encodeURIComponent(`${photo.originalName} (ข้อมูลจำลอง)`)}`
        );
    }
  return null;
}
/** A stable id for a file the mock draws for a row, in its own namespace. */
const drawnId = (namespace: string, of: string) =>
  mockId(namespace, Number.parseInt(of.replace(/-/g, "").slice(-6), 16) % 0x100000);

function dimsOf(detail: PrepressDetail) {
  return {
    length: detail.dieline.lengthMm ?? 80,
    width: detail.dieline.widthMm ?? 50,
    height: detail.dieline.heightMm ?? 120,
  };
}

/** A proof page and its dieline overlay: the dieline filled with fake artwork, one colour per version. */
function proofPage(detail: PrepressDetail, versionNo: number) {
  const style = DIELINE_KEYS[detail.dieline.patternCode ?? ""] ?? "tuck-end";
  const dieline = buildStyle(style, dimsOf(detail), BOARD);
  const scale = 1200 / Math.max(dieline.width, dieline.height);
  const width = Math.round(dieline.width * scale);
  const height = Math.round(dieline.height * scale);
  const colour = PALETTE[(versionNo - 1) % PALETTE.length]!;
  const faces = `<g transform="scale(${scale})">${allFaces(dieline)
    .map(
      (face) =>
        `<path d="${[face.outline, ...face.holes].map((c) => svgPathData(c)).join(" ")}" fill-rule="evenodd" fill="${colour}" fill-opacity="0.18"/>`,
    )
    .join("")}</g>`;
  const main = allFaces(dieline).reduce(
    (best, face) => {
      const b = faceBounds(face);
      const area = b.width * b.height;
      return area > best.area ? { area, x: b.x + b.width / 2, y: b.y + b.height / 2 } : best;
    },
    { area: 0, x: dieline.width / 2, y: dieline.height / 2 },
  );
  const cx = main.x * scale;
  const cy = main.y * scale;
  const art = `<circle cx="${cx}" cy="${cy - 60}" r="${versionNo === 1 ? 46 : 64}" fill="${colour}"/><rect x="${cx - 110}" y="${cy + 30}" width="220" height="22" rx="6" fill="#222" fill-opacity="0.6"/><text x="${cx}" y="${cy + 100}" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#222">PROOF v${versionNo} · mock</text>`;
  const page = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#fff"/>${faces}${art}</svg>`;
  const lines = `<g transform="scale(${scale})" fill="none" stroke-width="${2 / scale}">${dielineLines(dieline)
    .filter((l) => l.role === "cut" || l.role === "crease")
    .map(
      (l) =>
        `<path d="${svgPathData([l.edge], false)}" stroke="${l.role === "cut" ? "#d62d20" : "#1e6fd9"}" ${l.role === "crease" ? `stroke-dasharray="${10 / scale} ${6 / scale}"` : ""}/>`,
    )
    .join("")}</g>`;
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${lines}</svg>`;
  return { page: svgUrl(page), overlay: svgUrl(overlay) };
}

/* -------------------------------------------------------------------------------- projections */

/** Designs sent to print: pending until prepress exports them, which the mock does a moment later. */
const exporting = new Map<string, number>();
const EXPORT_MS = 3_000;

export function toSubmission(detail: PrepressDetail, submission: Submission): Schemas["ArtworkSubmissionDto"] {
  const since = exporting.get(submission.id);
  if (since !== undefined && Date.now() - since >= EXPORT_MS) {
    exporting.delete(submission.id);
    submission.preflightStatus = "passed";
    submission.preflightCompletedAt = bangkokIso();
  }
  const first = submission.files[0]?.file;
  const block = submission.findings.filter((finding) => finding.severity === "block").length;
  const warn = submission.findings.filter((finding) => finding.severity === "warn").length;
  const dims = dimsOf(detail);
  return {
    id: submission.id,
    orderId: detail.orderId,
    orderCode: detail.orderCode,
    versionNo: submission.versionNo,
    channel: "web",
    source: submission.source,
    status: submission.status,
    ...statusLabels("status", SUBMISSION_STATUS, submission.status),
    note: null,
    files: submission.files.map((entry) => ({
      id: entry.file.id,
      fileId: entry.file.id,
      role: entry.role,
      originalName: entry.file.originalName,
      mimeType: entry.file.mimeType,
      sizeBytes: entry.file.sizeBytes,
      linkUrl: null,
    })),
    preflightStatus: submission.preflightStatus,
    ...statusLabels("preflightStatus", PREFLIGHT_STATUS, submission.preflightStatus),
    preflightCompletedAt: submission.preflightCompletedAt,
    preflightReport:
      submission.preflightStatus === "pending" || submission.preflightStatus === "running"
        ? null
        : {
            run: 1,
            blockCount: block,
            warnCount: warn,
            expectedSize: { widthMm: dims.length, heightMm: dims.height },
            files: first
              ? [
                  {
                    submissionFileId: first.id,
                    kind: "pdf",
                    name: first.originalName,
                    pageCount: 1,
                    thumbnailFileId: null,
                    checks: submission.findings.map((finding) => ({
                      check: finding.check,
                      severity: finding.severity,
                      outcome: "fail",
                      page: finding.page,
                      messageTh: finding.message,
                      messageEn: finding.message,
                      measurements: {},
                    })),
                  },
                ]
              : [],
          },
    rejectReason:
      submission.status === "rejected"
        ? (rejectReasons.get(submission.id) ??
          (submission.preflightStatus === "blocked"
            ? "ไฟล์ไม่ผ่านการตรวจอัตโนมัติ กรุณาแก้ตามรายการด้านล่างแล้วส่งใหม่"
            : "ทีมงานส่งไฟล์คืนให้แก้ไข"))
        : null,
    reviewedAt: null,
    submittedAt: submission.submittedAt,
  };
}

/** What the customer wrote when asking for changes, per proof (the desk's row keeps no comment). */
const decisionComments = new Map<string, string>();

/** Staff appear as the team to the customer (`customer`), by name to the back office (`staff`). */
export function toProof(
  detail: PrepressDetail,
  proof: Proof,
  audience: "customer" | "staff" = "customer",
): Schemas["ProofDto"] {
  const { page, overlay } = proofPage(detail, proof.versionNo);
  const pageId = drawnId("prp", proof.id);
  const overlayId = proof.dielineFile?.id ?? drawnId("prd", proof.id);
  drawn.set(pageId, page);
  drawn.set(overlayId, overlay);
  const previous = detail.proofs.find((candidate) => candidate.versionNo === proof.versionNo - 1);
  const annotations = proofAnnotations.get(proof.id) ?? [];
  const submission = detail.submissions.find((candidate) => candidate.versionNo === proof.submissionVersionNo);
  return {
    id: proof.id,
    orderId: detail.orderId,
    orderCode: detail.orderCode,
    versionNo: proof.versionNo,
    status: proof.status,
    ...statusLabels("status", PROOF_STATUS, proof.status),
    submissionId: submission?.id ?? null,
    // The mock's proof is a drawn SVG, so the viewer can show and point at it.
    proofFile: {
      id: pageId,
      mimeType: "image/svg+xml",
      originalName: `${detail.orderCode}-proof-v${proof.versionNo}.svg`,
      pageCount: 1,
    },
    dielineFileId: overlayId,
    changeNote: proof.note,
    sentAt: proof.sentAt,
    decidedAt: proof.decidedAt,
    decisionChannel: proof.decisionChannel,
    // A decision CS made on the customer's behalf names the team to the customer.
    decidedByName: proof.decidedBy
      ? proof.decisionChannel === "cs_on_behalf" && audience === "customer"
        ? TEAM
        : proof.decidedBy.displayName
      : null,
    decisionChecklist: decisionChecklists.get(proof.id) ?? [],
    decisionComment: decisionComments.get(proof.id) ?? null,
    onBehalfReason: proof.onBehalfReason,
    approvedFileId: proof.status === "approved" ? pageId : null,
    approvedFileSha256: proof.approvedFileSha256,
    compare: previous
      ? {
          previousProofId: previous.id,
          previousVersionNo: previous.versionNo,
          previousStatus: previous.status,
          ...statusLabels("previousStatus", PROOF_STATUS, previous.status),
          previousProofFileId: drawnId("prp", previous.id),
          previousDecisionComment: decisionComments.get(previous.id) ?? null,
          openAnnotationsOnPrevious: (proofAnnotations.get(previous.id) ?? []).filter(
            (item) => !item.parentId && !item.resolvedAt,
          ).length,
        }
      : null,
    annotations: annotations.map((item) => ({
      id: item.id,
      parentId: item.parentId,
      page: item.page,
      kind: item.kind,
      geometry: item.geometry,
      comment: item.comment,
      // Staff appear as the team.
      author: {
        kind: item.authorKind,
        displayName: item.authorKind === "staff" && audience === "customer" ? TEAM : item.author.displayName,
      },
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt,
      // Only staff resolve a thread (the back office's artwork mock); they appear as the team too.
      resolvedBy: item.resolvedBy
        ? { kind: "staff" as const, displayName: audience === "customer" ? TEAM : item.resolvedBy.displayName }
        : null,
    })),
  };
}

/** The dieline templates sent for the order; one is drawn for a box the mock knows the shape of. */
export function toTemplates(detail: PrepressDetail): Schemas["DielineDeliveryDto"][] {
  const style = DIELINE_KEYS[detail.dieline.patternCode ?? ""];
  const sent = detail.templateDeliveries.map((delivery) => {
    if (style)
      drawn.set(delivery.file.id, svgUrl(dielineToSvg(buildStyle(style, dimsOf(detail), BOARD), { margin: 5 })));
    return {
      id: delivery.id,
      fileId: delivery.file.id,
      note: templateNotes.get(delivery.id) ?? null,
      sentAt: delivery.sentAt,
      trigger: delivery.trigger,
    };
  });
  if (sent.length > 0 || !style) return sent;
  // D-072: the template goes out once the order is paid; the mock sends it with the first read.
  const fileId = drawnId("dlt", detail.orderId);
  drawn.set(fileId, svgUrl(dielineToSvg(buildStyle(style, dimsOf(detail), BOARD), { margin: 5 })));
  return [
    { id: drawnId("dld", detail.orderId), fileId, note: null, sentAt: bangkokIso(-60), trigger: "auto_after_payment" },
  ];
}

/** The brief as the customer wrote it (fixed fields), per design service. */
const briefs = new Map<string, Schemas["DesignBriefViewDto"]>();
const feeLabel = (roundNo: number) => `ค่าแก้ไขแบบรอบที่ ${roundNo}`;
const grossOf = (net: string) => baht(Math.round(satang(net) * 1.07));

function briefOf(service: Service): Schemas["DesignBriefViewDto"] | null {
  if (service.status === "brief_pending") return null;
  const known = briefs.get(service.id);
  if (known) return known;
  // A seeded service carries the legacy label/value brief; its first answer is the brand.
  return {
    brandName: service.brief[0]?.value ?? "",
    brandCategory: "",
    description: service.brief
      .slice(1)
      .map((item) => `${item.label}: ${item.value}`)
      .join("\n"),
    attachmentFileIds: service.briefFiles.map((file) => file.id),
  };
}

export function toDesignService(detail: PrepressDetail, service: Service): Schemas["DesignServiceDto"] {
  const order = orders.find((candidate) => candidate.id === detail.orderId)!;
  const group = groupForOrder(order);
  const next = service.nextRound;
  // D-071 counts the first design as round 1 and charges from round 4: the free rounds used are
  // the uncharged ones.
  const used = service.rounds.filter((round) => !round.chargeable).length;
  return {
    id: service.id,
    orderId: detail.orderId,
    orderCode: detail.orderCode,
    status: service.status,
    ...statusLabels("status", DESIGN_SERVICE_STATUS, service.status),
    assignee: service.designer,
    brief: briefOf(service),
    briefSubmittedAt: service.rounds[0]?.requestedAt ?? null,
    closeReason: null,
    designFeeNet: service.designFeeNet,
    dueState: service.status === "approved" ? "closed" : service.rounds.length ? "on_track" : "not_started",
    targetDueAt: service.targetDueAt,
    maxDueAt: service.maxDueAt,
    freeRounds: service.freeRounds,
    revisionsUsed: used,
    nextRevision:
      service.status === "delivered"
        ? {
            revisionNo: next.roundNo - 1,
            chargeable: next.chargeable,
            feeNet: next.feeAmount,
            feeGross: next.feeAmount ? grossOf(next.feeAmount) : null,
          }
        : null,
    rounds: service.rounds.map((round) => ({
      id: drawnId("drd", `${service.id.slice(-4)}${String(round.roundNo).padStart(2, "0")}`),
      roundNo: round.roundNo,
      kind: round.kind,
      chargeable: round.chargeable,
      feeNet: round.feeAmount,
      status: round.status,
      ...statusLabels("status", DESIGN_ROUND_STATUS, round.status),
      requestedAt: round.requestedAt,
      startedAt: round.startedAt,
      deliveredAt: round.deliveredAt,
      changeRequest: round.note,
      // The rounds keep the delivered files only, no reference files sent with a revision.
      referenceFileIds: [],
      instalmentId: round.chargeable
        ? (group.instalments.find((entry) => entry.label === feeLabel(round.roundNo))?.id ?? null)
        : null,
      submissionId: null,
    })),
  };
}

/* ------------------------------------------------------------------------------------ state */

function orderOf(customer: MockCustomer, orderId: string) {
  const owner = ownerIdOf(customer);
  return orders.find((order) => order.id === orderId && order.customer.id === owner);
}

const whoOf = (customer: MockCustomer, displayName: string) => ({ id: ownerIdOf(customer), displayName });

/** Which delivered design round a proof stands for, so a decision on it reaches the round. */
const designProofs = new Map<string, { serviceId: string; roundNo: number }>();

/**
 * A delivered design round as the proof the customer decides on (getpack-api: the delivery is a
 * submission with source `design_service` that goes to a proof). Made once per delivered round.
 */
export function syncDesign(detail: PrepressDetail): PrepressDetail {
  const service = detail.designService;
  const order = orders.find((candidate) => candidate.id === detail.orderId);
  if (!service || !order) return detail;
  // A charged round starts once its fee instalment is paid (D-071).
  const waiting = service.rounds.find((round) => round.status === "awaiting_payment");
  const fee = waiting && groupForOrder(order).instalments.find((entry) => entry.label === feeLabel(waiting.roundNo));
  if (waiting && fee?.paid) {
    waiting.status = "in_progress";
    waiting.startedAt = bangkokIso();
    service.status = "in_progress";
  }
  const delivered = service.rounds.at(-1);
  if (service.status !== "delivered" || delivered?.status !== "delivered") return detail;
  const known = [...designProofs.entries()].some(
    ([, round]) => round.serviceId === service.id && round.roundNo === delivered.roundNo,
  );
  if (known) return detail;
  for (const item of detail.proofs) if (item.status === "pending_customer") item.status = "superseded";
  const versionNo = (detail.proofs[0]?.versionNo ?? 0) + 1;
  const id = drawnId("prf", `${service.id.slice(-4)}${String(delivered.roundNo).padStart(2, "0")}`);
  detail.proofs.unshift({
    id,
    versionNo,
    submissionVersionNo: detail.submissions[0]?.versionNo ?? 0,
    status: "pending_customer",
    proofFile: delivered.files[0] ?? {
      id,
      originalName: `design-round-${delivered.roundNo}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 0,
      thumbnailUrl: null,
      url: null,
    },
    dielineFile: null,
    note: delivered.note,
    preparedBy: service.designer ?? { id: mockId("usr", 1), displayName: TEAM },
    sentAt: delivered.deliveredAt ?? bangkokIso(),
    decidedAt: null,
    decidedBy: null,
    decisionChannel: null,
    onBehalfReason: null,
    approvedFileSha256: null,
    annotations: { open: 0, resolved: 0 },
  });
  designProofs.set(id, { serviceId: service.id, roundNo: delivered.roundNo });
  detail.artworkStatus = "proof_sent";
  return refreshPrepress(detail);
}

function context(request: Request, orderId: string) {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const order = orderOf(customer, orderId);
  if (!order) return notFound();
  return { customer, order, detail: syncDesign(prepressOf(order.id)!) };
}

/** A proof of one of the customer's orders, by its id alone (`/v1/store/proofs/{proofId}`). */
function proofContext(request: Request, proofId: string) {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const owner = ownerIdOf(customer);
  for (const order of orders.filter((candidate) => candidate.customer.id === owner)) {
    const detail = prepressIfAny(order.id);
    const proof = detail?.proofs.find((candidate) => candidate.id === proofId);
    if (detail && proof) return { customer, order, detail, proof };
  }
  return problem(404, "http.not_found", "ไม่พบแบบตัวอย่างนี้");
}

/** The next revision after a delivered design, free or charged (D-071): the desk's own bookkeeping. */
function openRevision(service: Service, changeRequest: string) {
  const next = service.nextRound;
  const last = service.rounds.at(-1);
  if (last) last.status = "changes_requested";
  service.rounds.push({
    roundNo: next.roundNo,
    kind: "revision",
    chargeable: next.chargeable,
    feeAmount: next.feeAmount,
    status: next.chargeable ? "awaiting_payment" : "in_progress",
    requestedAt: bangkokIso(),
    startedAt: next.chargeable ? null : bangkokIso(),
    deliveredAt: null,
    files: [],
    note: changeRequest,
  });
  service.status = next.chargeable ? "revision_requested" : "in_progress";
  const following = next.roundNo + 1;
  const fee = baht(Math.max(50_000, Math.round(satang(service.designFeeNet) * 0.2)));
  service.nextRound = {
    roundNo: following,
    chargeable: following > service.freeRounds,
    feeAmount: following > service.freeRounds ? fee : null,
  };
  return next;
}

/* --------------------------------------------------------------------------------- handlers */

export const storeArtworkHandlers = [
  http.get("*/v1/store/orders/:orderId/artwork-submissions", ({ params, request }) => {
    const found = context(request, String(params.orderId));
    if (found instanceof Response) return found;
    return HttpResponse.json(found.detail.submissions.map((submission) => toSubmission(found.detail, submission)));
  }),

  http.get("*/v1/store/orders/:orderId/artwork-submissions/:submissionId", ({ params, request }) => {
    const found = context(request, String(params.orderId));
    if (found instanceof Response) return found;
    const submission = found.detail.submissions.find((candidate) => candidate.id === params.submissionId);
    return submission ? HttpResponse.json(toSubmission(found.detail, submission)) : notFound();
  }),

  http.post("*/v1/store/orders/:orderId/artwork-submissions", async ({ params, request }) => {
    const found = context(request, String(params.orderId));
    if (found instanceof Response) return found;
    const body = (await request.json()) as Schemas["SubmitArtworkDto"];
    const given = body.files ?? [];
    if (given.length === 0 && !(body.links ?? []).length)
      return problem(422, "validation.failed", "กรุณาแนบไฟล์งาน", [
        { path: "files", code: "min", message: "required" },
      ]);
    if (found.detail.designOption === "hired_design" || found.detail.artworkStatus === "approved")
      return problem(409, "artwork.not_accepting", "คำสั่งซื้อนี้ไม่ได้รอไฟล์งานแล้ว");
    const named = given.map((entry) => ({
      fileId: entry.fileId,
      role: entry.role ?? ("artwork" as const),
      name: files.get(entry.fileId)?.originalName ?? "artwork.pdf",
    }));
    customerSubmit(found.detail, named, whoOf(found.customer, found.order.customer.displayName), null);
    return HttpResponse.json(toSubmission(found.detail, found.detail.submissions[0]!), { status: 201 });
  }),

  // store.designs.submitForOrder: the design's current version becomes the artwork, pending until
  // prepress exports it (then the mock's preflight, by file name, has nothing to find).
  http.post("*/v1/store/orders/:orderId/artwork-submissions/from-design", async ({ params, request }) => {
    const found = context(request, String(params.orderId));
    if (found instanceof Response) return found;
    const body = (await request.json().catch(() => ({}))) as Schemas["SubmitFromDesignDto"];
    customerSubmit(
      found.detail,
      [],
      whoOf(found.customer, found.order.customer.displayName),
      body.designId ?? mockId("dsg", 1),
    );
    const submission = found.detail.submissions[0]!;
    submission.preflightStatus = "pending";
    submission.preflightCompletedAt = null;
    exporting.set(submission.id, Date.now());
    return HttpResponse.json(toSubmission(found.detail, submission), { status: 201 });
  }),

  http.get("*/v1/store/orders/:orderId/proofs", ({ params, request }) => {
    const found = context(request, String(params.orderId));
    if (found instanceof Response) return found;
    return HttpResponse.json(found.detail.proofs.map((proof) => toProof(found.detail, proof)));
  }),

  http.get("*/v1/store/orders/:orderId/templates", ({ params, request }) => {
    const found = context(request, String(params.orderId));
    if (found instanceof Response) return found;
    return HttpResponse.json(toTemplates(found.detail));
  }),

  http.get("*/v1/store/proofs/:proofId", ({ params, request }) => {
    const found = proofContext(request, String(params.proofId));
    if (found instanceof Response) return found;
    return HttpResponse.json(toProof(found.detail, found.proof));
  }),

  http.post("*/v1/store/proofs/:proofId/annotations", async ({ params, request }) => {
    const found = proofContext(request, String(params.proofId));
    if (found instanceof Response) return found;
    if (found.proof.status !== "pending_customer")
      return problem(409, "proofs.annotation_closed", "แบบตัวอย่างฉบับนี้ปิดการแสดงความเห็นแล้ว");
    const body = (await request.json()) as Schemas["AnnotateProofDto"];
    if (!body.comment?.trim()) return problem(422, "validation.failed", "กรุณาพิมพ์ความเห็น");
    // A new annotation names its place; a reply takes its parent's.
    if (!body.parentId && (body.page === undefined || body.kind === undefined || !body.geometry))
      return problem(422, "validation.failed", "กรุณาระบุตำแหน่งของความเห็น", [
        { path: "page", code: "required", message: "required" },
      ]);
    customerAnnotate(
      found.proof.id,
      {
        page: body.page,
        kind: body.kind,
        geometry: body.geometry as Record<string, unknown> | undefined,
        body: body.comment,
        ...(body.parentId ? { parentId: body.parentId } : {}),
      },
      whoOf(found.customer, found.order.customer.displayName),
    );
    refreshPrepress(found.detail);
    return HttpResponse.json(toProof(found.detail, found.proof), { status: 201 });
  }),

  // store.artwork.getRules (D-070, D-073): what the upload takes and checks, the approval checklist,
  // the order's dieline and box size.
  http.get("*/v1/store/orders/:orderId/artwork-rules", ({ params, request }) => {
    const found = context(request, String(params.orderId));
    if (found instanceof Response) return found;
    const { dieline } = found.detail;
    const rules: Schemas["ArtworkRulesDto"] = {
      accept: [".pdf", ".ai", ".psd", ".png", ".jpg", ".jpeg"],
      maxBytes: 200 * 1024 * 1024,
      maxFiles: 20,
      maxLinks: 5,
      purpose: "artwork",
      bleedMm: "3",
      safeZoneMm: "3",
      minEffectivePpi: 300,
      colourMode: "cmyk",
      checks: [
        { check: "missing_bleed", severity: "block" },
        { check: "low_resolution", severity: "warn" },
        { check: "rgb_colour", severity: "warn" },
        { check: "text_in_safe_zone", severity: "info" },
      ],
      approvalChecklist: APPROVAL_CHECKLIST,
      dieline: dieline.patternCode
        ? {
            patternCode: dieline.patternCode,
            styleCode:
              (catalogueRows("patterns").find((row) => row.code === dieline.patternCode)?.styleCode as
                string | null | undefined) ?? null,
            dielineKey: DIELINE_KEYS[dieline.patternCode] ?? null,
            lengthMm: dieline.lengthMm ?? 80,
            widthMm: dieline.widthMm ?? 50,
            depthMm: dieline.heightMm ?? 120,
          }
        : null,
    };
    return HttpResponse.json(rules);
  }),

  http.post("*/v1/store/proofs/:proofId/actions/approve", async ({ params, request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const found = proofContext(request, String(params.proofId));
    if (found instanceof Response) return found;
    const body = (await request.json().catch(() => ({}))) as Schemas["ApproveProofDto"];
    // Every checklist item must be confirmed once the checklist is set.
    const missing = APPROVAL_CHECKLIST.filter((item) => !(body.checklist ?? []).includes(item.key));
    if (missing.length > 0)
      return problem(422, "validation.failed", "กรุณายืนยันรายการตรวจให้ครบ", [
        { path: "checklist", code: "required", message: missing.map((item) => item.key).join(",") },
      ]);
    const decided = customerDecide(
      found.detail,
      found.proof.id,
      "approved",
      whoOf(found.customer, found.order.customer.displayName),
    );
    if (decided instanceof Response) return problem(409, "proofs.not_pending", "แบบตัวอย่างฉบับนี้ไม่ได้รอการตรวจแล้ว");
    // The approved design closes its round and the service (D-071, design-services onProofDecision).
    const round = designProofs.get(found.proof.id);
    const service = found.detail.designService;
    if (round && service?.id === round.serviceId) {
      service.status = "approved";
      const delivered = service.rounds.find((entry) => entry.roundNo === round.roundNo);
      if (delivered) delivered.status = "approved";
    }
    decisionChecklists.set(found.proof.id, body.checklist ?? []);
    if (body.note) decisionComments.set(found.proof.id, body.note);
    refreshOrder(found.order);
    return HttpResponse.json(toProof(found.detail, found.proof));
  }),

  http.post("*/v1/store/proofs/:proofId/actions/request-changes", async ({ params, request }) => {
    const found = proofContext(request, String(params.proofId));
    if (found instanceof Response) return found;
    const body = (await request.json()) as Schemas["RequestChangesDto"];
    const round = designProofs.get(found.proof.id);
    const service = found.detail.designService;
    // A charged round is confirmed with its fee, not asked for on the proof (D-071).
    if (round && service?.nextRound.chargeable)
      return problem(409, "design_services.invalid_status", "รอบถัดไปมีค่าใช้จ่าย กรุณายืนยันค่าแก้ไขก่อน");
    const decided = customerDecide(
      found.detail,
      found.proof.id,
      "changes_requested",
      whoOf(found.customer, found.order.customer.displayName),
    );
    if (decided instanceof Response) return problem(409, "proofs.not_pending", "แบบตัวอย่างฉบับนี้ไม่ได้รอการตรวจแล้ว");
    decisionComments.set(found.proof.id, body.comment);
    if (round && service) openRevision(service, body.comment);
    return HttpResponse.json(toProof(refreshPrepress(found.detail), found.proof));
  }),

  http.get("*/v1/store/orders/:orderId/design-service", ({ params, request }) => {
    const found = context(request, String(params.orderId));
    if (found instanceof Response) return found;
    const service = found.detail.designService;
    return service
      ? HttpResponse.json(toDesignService(found.detail, service))
      : problem(404, "http.not_found", "คำสั่งซื้อนี้ไม่ได้จ้างออกแบบ");
  }),

  http.put("*/v1/store/orders/:orderId/design-service/brief", async ({ params, request }) => {
    const found = context(request, String(params.orderId));
    if (found instanceof Response) return found;
    const service = found.detail.designService;
    if (!service) return problem(404, "http.not_found", "คำสั่งซื้อนี้ไม่ได้จ้างออกแบบ");
    if (service.status !== "brief_pending") return problem(409, "design_services.invalid_status", "ส่งบรีฟไปแล้ว");
    const body = (await request.json()) as Schemas["DesignBriefDto"];
    const missing = (["brandName", "brandCategory", "description"] as const).filter((key) => !body[key]?.trim());
    if (missing.length > 0)
      return problem(
        422,
        "validation.failed",
        "กรุณากรอกข้อมูลที่จำเป็น",
        missing.map((key) => ({ path: key, code: "required", message: "required" })),
      );
    briefs.set(service.id, {
      brandName: body.brandName,
      brandCategory: body.brandCategory,
      description: body.description,
      attachmentFileIds: body.attachmentFileIds ?? [],
    });
    service.status = "in_progress";
    service.rounds.push({
      roundNo: 1,
      kind: "initial",
      chargeable: false,
      feeAmount: null,
      status: "in_progress",
      requestedAt: bangkokIso(),
      startedAt: bangkokIso(),
      deliveredAt: null,
      files: [],
      note: null,
    });
    service.nextRound = { roundNo: 2, chargeable: service.freeRounds < 1, feeAmount: null };
    return HttpResponse.json(toDesignService(refreshPrepress(found.detail), service));
  }),

  http.post("*/v1/store/orders/:orderId/design-service/actions/confirm-extra-round", async ({ params, request }) => {
    const refused = keyRequired(request);
    if (refused) return refused;
    const found = context(request, String(params.orderId));
    if (found instanceof Response) return found;
    const service = found.detail.designService;
    if (!service || service.status !== "delivered" || !service.nextRound.chargeable || !service.nextRound.feeAmount)
      return problem(409, "design_services.invalid_status", "ยังไม่มีรอบแก้ไขที่มีค่าใช้จ่ายให้ยืนยัน");
    const body = (await request.json()) as Schemas["ConfirmExtraRoundDto"];
    const feeGross = grossOf(service.nextRound.feeAmount);
    if (body.expectedFeeGross !== feeGross)
      return problem(409, "design_services.fee_changed", `ค่าแก้ไขรอบนี้คือ ${feeGross} บาท กรุณาตรวจสอบอีกครั้ง`);
    const pending = found.detail.proofs.find(
      (proof) => proof.status === "pending_customer" && designProofs.has(proof.id),
    );
    if (pending)
      customerDecide(
        found.detail,
        pending.id,
        "changes_requested",
        whoOf(found.customer, found.order.customer.displayName),
      );
    const round = openRevision(service, body.changeRequest);
    // D-071: the customer pays the round's fee before it starts — an instalment of its own.
    const group = groupForOrder(found.order);
    group.instalments.push({
      id: mockId("dfi", Number.parseInt(found.order.id.slice(-4), 16) * 10 + round.roundNo),
      seq: group.instalments.length + 1,
      label: feeLabel(round.roundNo),
      dueTrigger: "at_checkout",
      requiredBefore: "none",
      gross: satang(feeGross),
      paid: false,
      dueAt: bangkokIso(3 * 24 * 60),
    });
    return HttpResponse.json(toDesignService(refreshPrepress(found.detail), service));
  }),

  // store.files.download: a file the mock drew, or one the customer uploaded (its own bytes when the
  // mock kept them, as for a design's images and thumbnails), as a data URL.
  http.get("*/v1/store/files/:fileId/download", ({ params, request }) => {
    if (!customerOf(request)) return unauthenticated();
    const url = mockFileUrl(String(params.fileId));
    if (!url) return problem(404, "http.not_found", "ไม่พบไฟล์นี้");
    return HttpResponse.json({ url, expiresAt: bangkokIso(5) } satisfies Schemas["DownloadUrlDto"]);
  }),
];
