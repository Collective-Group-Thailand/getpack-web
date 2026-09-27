/**
 * Artwork, proofs and design services from the customer's side, mocked (CONTRACT-REQUEST
 * store.artwork, store.proofs, store.design-service).
 *
 * The rows are the prepress desk's (`../admin/prepress.ts`): an upload here is the submission
 * prepress checks, a proof prepress sends is the one the customer reviews, a comment is one
 * thread both reply to. Proof pages and the dieline template are drawn with `@packio/dieline`
 * from the order's box size — obviously fake artwork on the real outline — so the viewer has
 * something true-to-shape to zoom, overlay and annotate.
 */

import {
  allFaces,
  buildStyle,
  dielineLines,
  dielineToSvg,
  faceBounds,
  REFERENCE_MATERIALS,
  svgPathData,
} from "@packio/dieline";
import type { z } from "zod";

import type { storeAnnotationThread, storeArtwork } from "@/lib/api/requests/store-artwork";
import type { rfqField } from "@/lib/api/requests/store-rfq";

import { baht, orders, refreshOrder, satang } from "../admin/commerce";
import {
  customerAnnotate,
  customerDecide,
  customerSubmit,
  prepressOf,
  proofAnnotations,
  refreshPrepress,
  type PrepressAnnotation,
  type PrepressDetail,
} from "../admin/prepress";
import { files } from "../admin/platform";
import { mockRequest } from "../route";
import { bangkokIso, mockId, problem } from "../support";
import { groupForOrder } from "./checkout";
import { customerOf, type MockCustomer } from "./customers";
import { ownerIdOf } from "./owner";

type Artwork = z.output<typeof storeArtwork>;
type Thread = z.output<typeof storeAnnotationThread>;

const DIELINE_KEYS: Record<string, string> = { "RTE-01": "reverse-tuck-end", "RSC-01": "rsc", "TRAY-01": "tray" };
const BOARD = REFERENCE_MATERIALS["board-350"];
const PALETTE = ["#1f6f5c", "#b4532a", "#3b5ba5", "#8a3f8f"];

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบคำสั่งซื้อนี้");

function orderOf(customer: MockCustomer, orderId: string) {
  const owner = ownerIdOf(customer);
  return orders.find((order) => order.id === orderId && order.customer.id === owner);
}

const whoOf = (customer: MockCustomer, displayName: string) => ({ id: ownerIdOf(customer), displayName });

function dimsOf(detail: PrepressDetail) {
  return {
    length: detail.dieline.lengthMm ?? 80,
    width: detail.dieline.widthMm ?? 50,
    height: detail.dieline.heightMm ?? 120,
  };
}

const svgUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

/** A proof page: the dieline filled with obviously fake artwork, one colour per version. */
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
  return { index: 0, imageUrl: svgUrl(page), widthPx: width, heightPx: height, dielineOverlayUrl: svgUrl(overlay) };
}

const CHECKLIST = [
  { key: "text", label: "ตรวจข้อความ ตัวสะกด และตัวเลขทั้งหมดแล้ว" },
  { key: "dieline", label: "ตรวจตำแหน่งงานเทียบเส้นไดคัทและระยะปลอดภัยแล้ว" },
  { key: "colour", label: "เข้าใจว่าสีบนหน้าจออาจต่างจากงานพิมพ์จริงเล็กน้อย" },
  { key: "size", label: "ตรวจขนาดกล่องและจำนวนที่สั่งแล้ว" },
];

const BRIEF_FIELDS: z.output<typeof rfqField>[] = [
  {
    key: "brand",
    type: "text",
    labelTh: "ชื่อแบรนด์และสินค้า",
    labelEn: "Brand and product name",
    helpTh: null,
    helpEn: null,
    unit: null,
    required: true,
    min: null,
    max: null,
    options: [],
  },
  {
    key: "audience",
    type: "text",
    labelTh: "กลุ่มลูกค้า",
    labelEn: "Who it is for",
    helpTh: "เช่น ผู้หญิงอายุ 25–40 ปี",
    helpEn: "e.g. women 25–40",
    unit: null,
    required: false,
    min: null,
    max: null,
    options: [],
  },
  {
    key: "style",
    type: "select",
    labelTh: "สไตล์ที่ต้องการ",
    labelEn: "Style",
    helpTh: null,
    helpEn: null,
    unit: null,
    required: true,
    min: null,
    max: null,
    options: [
      { value: "minimal", labelTh: "เรียบ มินิมอล", labelEn: "Minimal" },
      { value: "premium", labelTh: "หรู พรีเมียม", labelEn: "Premium" },
      { value: "playful", labelTh: "สดใส สนุก", labelEn: "Playful" },
      { value: "natural", labelTh: "ธรรมชาติ", labelEn: "Natural" },
    ],
  },
  {
    key: "colours",
    type: "text",
    labelTh: "โทนสี",
    labelEn: "Colours",
    helpTh: null,
    helpEn: null,
    unit: null,
    required: false,
    min: null,
    max: null,
    options: [],
  },
  {
    key: "content",
    type: "textarea",
    labelTh: "ข้อความที่ต้องมีบนกล่อง",
    labelEn: "Text that must be on the box",
    helpTh: "เช่น ส่วนประกอบ เลข อย. วิธีใช้",
    helpEn: "e.g. ingredients, FDA number, directions",
    unit: null,
    required: true,
    min: null,
    max: null,
    options: [],
  },
];

const feeLabel = (roundNo: number) => `ค่าแก้ไขแบบรอบที่ ${roundNo}`;

function toArtwork(detail: PrepressDetail): Artwork {
  const order = orders.find((candidate) => candidate.id === detail.orderId)!;
  const style = DIELINE_KEYS[detail.dieline.patternCode ?? ""] ?? null;
  const template = style ? dielineToSvg(buildStyle(style, dimsOf(detail), BOARD), { margin: 5 }) : null;
  const group = groupForOrder(order);
  const service = detail.designService;
  const pendingRound = service?.rounds.find((round) => round.status === "awaiting_payment");
  const feeEntry = pendingRound
    ? group.instalments.find((entry) => entry.label === feeLabel(pendingRound.roundNo))
    : undefined;
  if (pendingRound && feeEntry?.paid) {
    pendingRound.status = "in_progress";
    pendingRound.startedAt = bangkokIso();
    service!.status = "in_progress";
  }
  const current = detail.proofs[0];
  const actions: Artwork["nextActions"] = [];
  const latest = detail.submissions[0];
  if (
    (["awaiting_upload", "changes_requested", "awaiting_template", "uploaded"].includes(detail.artworkStatus) ||
      latest?.preflightStatus === "blocked" ||
      latest?.status === "rejected") &&
    detail.designOption !== "hired_design" &&
    current?.status !== "pending_customer"
  )
    actions.push({ key: "artwork.upload" });
  if (current?.status === "pending_customer")
    actions.push({ key: "proof.approve", irreversible: true }, { key: "proof.request_changes" });
  if (service?.status === "brief_pending") actions.push({ key: "design.submit_brief" });
  if (service?.status === "delivered")
    actions.push({ key: "design.approve", irreversible: true }, { key: "design.request_revision" });

  return {
    orderId: detail.orderId,
    orderCode: detail.orderCode,
    artworkStatus: detail.artworkStatus,
    designOption: detail.designOption,
    rules: {
      accept: ".pdf,.ai,.psd,.png,.jpg,.jpeg,.zip",
      maxBytes: 200 * 1024 * 1024,
      maxFiles: 10,
      bleedMm: 3,
      safeMarginMm: 3,
      minDpi: 300,
      colourMode: "cmyk",
    },
    dieline: {
      dielineKey: style,
      lengthMm: detail.dieline.lengthMm,
      widthMm: detail.dieline.widthMm,
      heightMm: detail.dieline.heightMm,
      templateUrl: template ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(template)}` : null,
    },
    submissions: detail.submissions.map((submission) => ({
      id: submission.id,
      versionNo: submission.versionNo,
      status: submission.status,
      preflightStatus: submission.preflightStatus,
      findings: submission.findings.map(({ thumbnailUrl: _thumbnail, ...finding }) => finding),
      files: submission.files,
      note: null,
      rejectionReason:
        submission.status === "rejected"
          ? submission.preflightStatus === "blocked"
            ? "ไฟล์ไม่ผ่านการตรวจอัตโนมัติ กรุณาแก้ตามรายการด้านล่างแล้วส่งใหม่"
            : "ทีมงานส่งไฟล์คืนให้แก้ไข"
          : null,
      submittedAt: submission.submittedAt,
    })),
    proofs: detail.proofs.map((proof) => ({
      id: proof.id,
      versionNo: proof.versionNo,
      status: proof.status,
      note: proof.note,
      file: proof.proofFile,
      pages: [proofPage(detail, proof.versionNo)],
      sentAt: proof.sentAt,
      decidedAt: proof.decidedAt,
      decision:
        proof.decidedAt && (proof.status === "approved" || proof.status === "changes_requested")
          ? {
              outcome: proof.status,
              byName: proof.decidedBy?.displayName ?? "",
              at: proof.decidedAt,
              note: null,
              fileSha256: proof.approvedFileSha256,
              checklist: proof.status === "approved" ? CHECKLIST.map((item) => item.key) : [],
            }
          : null,
      annotations: proof.annotations,
    })),
    checklist: CHECKLIST,
    designService: service
      ? {
          status: service.status,
          briefFields: BRIEF_FIELDS,
          brief: service.status === "brief_pending" ? [] : service.brief,
          briefSubmitted: service.status !== "brief_pending",
          targetDueAt: service.targetDueAt,
          maxDueAt: service.maxDueAt,
          freeRounds: service.freeRounds,
          rounds: service.rounds.map((round) => ({
            roundNo: round.roundNo,
            kind: round.kind,
            chargeable: round.chargeable,
            feeAmount: round.feeAmount,
            status: round.status,
            requestedAt: round.requestedAt,
            deliveredAt: round.deliveredAt,
            files: round.files,
            note: round.note,
          })),
          nextRound: service.nextRound,
          pendingFeeInstalment:
            pendingRound && feeEntry && !feeEntry.paid
              ? { id: feeEntry.id, label: feeEntry.label, grossAmount: baht(feeEntry.gross), activePaymentId: null }
              : null,
        }
      : null,
    nextActions: actions,
  };
}

function threadsOf(proofId: string): Thread[] {
  const list: PrepressAnnotation[] = proofAnnotations.get(proofId) ?? [];
  return list
    .filter((item) => !item.parentId)
    .map((root) => ({
      id: root.id,
      proofId,
      page: Math.max(0, root.page - 1),
      kind: root.kind === "draw" ? "rect" : root.kind,
      geometry: Object.fromEntries(
        Object.entries(root.geometry).filter(([, value]) => typeof value === "number"),
      ) as Record<string, number>,
      resolved: Boolean(root.resolvedAt),
      messages: [root, ...list.filter((item) => item.parentId === root.id)].map((item) => ({
        id: item.id,
        authorKind: item.authorKind,
        authorName: item.authorKind === "staff" ? "ทีม Packio" : item.author.displayName,
        body: item.comment,
        createdAt: item.createdAt,
      })),
    }));
}

function context(request: Request, orderId: string) {
  const customer = customerOf(request);
  if (!customer) return unauthenticated();
  const order = orderOf(customer, orderId);
  if (!order) return notFound();
  const detail = prepressOf(order.id)!;
  return { customer, order, detail };
}

export const storeArtworkHandlers = [
  mockRequest("GET /v1/store/orders/{orderId}/artwork", ({ params, request }) => {
    const found = context(request, params.orderId);
    return found instanceof Response ? found : toArtwork(found.detail);
  }),

  mockRequest("POST /v1/store/orders/{orderId}/artwork/submissions", ({ params, body, request }) => {
    const found = context(request, params.orderId);
    if (found instanceof Response) return found;
    if (body.files.length === 0 && !body.designDocumentId)
      return problem(422, "validation.failed", "กรุณาแนบไฟล์งาน", [
        { path: "files", code: "min", message: "required" },
      ]);
    const named = body.files.map((entry) => ({
      ...entry,
      name: files.get(entry.fileId)?.originalName ?? "artwork.pdf",
    }));
    customerSubmit(
      found.detail,
      named,
      whoOf(found.customer, found.order.customer.displayName),
      body.designDocumentId ?? null,
    );
    return toArtwork(found.detail);
  }),

  mockRequest("GET /v1/store/orders/{orderId}/proofs/{proofId}/annotations", ({ params, request }) => {
    const found = context(request, params.orderId);
    if (found instanceof Response) return found;
    if (!found.detail.proofs.some((proof) => proof.id === params.proofId)) return notFound();
    return { data: threadsOf(params.proofId) };
  }),

  mockRequest("POST /v1/store/orders/{orderId}/proofs/{proofId}/annotations", ({ params, body, request }) => {
    const found = context(request, params.orderId);
    if (found instanceof Response) return found;
    const proof = found.detail.proofs.find((candidate) => candidate.id === params.proofId);
    if (!proof) return notFound();
    if (proof.status !== "pending_customer") return problem(409, "proof.closed", "ปรู๊ฟฉบับนี้ปิดการแสดงความเห็นแล้ว");
    const created = customerAnnotate(
      proof.id,
      { page: body.page + 1, kind: body.kind, geometry: body.geometry, body: body.body },
      whoOf(found.customer, found.order.customer.displayName),
    );
    refreshPrepress(found.detail);
    return threadsOf(proof.id).find((thread) => thread.id === created.id)!;
  }),

  mockRequest(
    "POST /v1/store/orders/{orderId}/proofs/{proofId}/annotations/{annotationId}/messages",
    ({ params, body, request }) => {
      const found = context(request, params.orderId);
      if (found instanceof Response) return found;
      const thread = threadsOf(params.proofId).find((candidate) => candidate.id === params.annotationId);
      if (!thread) return notFound();
      customerAnnotate(
        params.proofId,
        {
          page: thread.page + 1,
          kind: thread.kind === "rect" ? "rect" : "pin",
          geometry: thread.geometry,
          body: body.body,
          parentId: thread.id,
        },
        whoOf(found.customer, found.order.customer.displayName),
      );
      return threadsOf(params.proofId).find((candidate) => candidate.id === thread.id)!;
    },
  ),

  mockRequest("POST /v1/store/orders/{orderId}/proofs/{proofId}/actions/approve", ({ params, body, request }) => {
    const found = context(request, params.orderId);
    if (found instanceof Response) return found;
    const missing = ["text", "dieline", "colour", "size"].filter((key) => !body.checklist.includes(key));
    if (missing.length > 0)
      return problem(422, "proof.checklist_incomplete", "กรุณายืนยันรายการตรวจสอบให้ครบก่อนอนุมัติ", [
        { path: "checklist", code: "incomplete", message: missing.join(",") },
      ]);
    const decided = customerDecide(
      found.detail,
      params.proofId,
      "approved",
      whoOf(found.customer, found.order.customer.displayName),
    );
    if (decided instanceof Response) return decided;
    refreshOrder(found.order);
    return toArtwork(found.detail);
  }),

  mockRequest(
    "POST /v1/store/orders/{orderId}/proofs/{proofId}/actions/request-changes",
    ({ params, body, request }) => {
      const found = context(request, params.orderId);
      if (found instanceof Response) return found;
      const decided = customerDecide(
        found.detail,
        params.proofId,
        "changes_requested",
        whoOf(found.customer, found.order.customer.displayName),
      );
      if (decided instanceof Response) return decided;
      customerAnnotate(
        params.proofId,
        { page: 1, kind: "pin", geometry: { x: 0.5, y: 0.5 }, body: body.note },
        whoOf(found.customer, found.order.customer.displayName),
      );
      return toArtwork(refreshPrepress(found.detail));
    },
  ),

  mockRequest("PUT /v1/store/orders/{orderId}/design-service/brief", ({ params, body, request }) => {
    const found = context(request, params.orderId);
    if (found instanceof Response) return found;
    const service = found.detail.designService;
    if (!service) return problem(409, "design.not_hired", "คำสั่งซื้อนี้ไม่ได้จ้างออกแบบ");
    const missing = BRIEF_FIELDS.filter((field) => field.required && !body.answers[field.key]);
    if (missing.length > 0)
      return problem(
        422,
        "validation.failed",
        "กรุณากรอกข้อมูลที่จำเป็น",
        missing.map((field) => ({ path: `answers.${field.key}`, code: "required", message: "required" })),
      );
    service.brief = BRIEF_FIELDS.filter((field) => body.answers[field.key] !== undefined).map((field) => {
      const value = body.answers[field.key];
      const option = field.options.find((candidate) => candidate.value === value);
      return { label: field.labelTh, value: option ? option.labelTh : String(value) };
    });
    if (service.status === "brief_pending") {
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
    }
    return toArtwork(refreshPrepress(found.detail));
  }),

  mockRequest("POST /v1/store/orders/{orderId}/design-service/rounds", ({ params, body, request }) => {
    const found = context(request, params.orderId);
    if (found instanceof Response) return found;
    const service = found.detail.designService;
    if (!service || service.status !== "delivered")
      return problem(409, "design.not_delivered", "ขอแก้ไขได้หลังนักออกแบบส่งงานแล้ว");
    const next = service.nextRound;
    if (next.chargeable && body.acceptedFee !== next.feeAmount)
      return problem(
        409,
        "design.fee_not_accepted",
        `รอบนี้มีค่าบริการ ${next.feeAmount} บาท กรุณายืนยันค่าบริการก่อน`,
      );
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
      note: body.note,
    });
    service.status = next.chargeable ? "revision_requested" : "in_progress";
    const following = next.roundNo + 1;
    const fee = baht(Math.max(50_000, Math.round(satang(service.designFeeNet) * 0.2)));
    service.nextRound = {
      roundNo: following,
      chargeable: following > service.freeRounds,
      feeAmount: following > service.freeRounds ? fee : null,
    };
    if (next.chargeable && next.feeAmount) {
      // D-071: the customer pays the round's fee before it starts — an instalment of its own.
      const group = groupForOrder(found.order);
      group.instalments.push({
        id: mockId("dfi", Number.parseInt(found.order.id.slice(-4), 16) * 10 + next.roundNo),
        seq: group.instalments.length + 1,
        label: feeLabel(next.roundNo),
        dueTrigger: "at_checkout",
        requiredBefore: "none",
        gross: satang(next.feeAmount),
        paid: false,
        dueAt: bangkokIso(3 * 24 * 60),
      });
    }
    return toArtwork(refreshPrepress(found.detail));
  }),

  mockRequest("POST /v1/store/orders/{orderId}/design-service/actions/approve", ({ params, request }) => {
    const found = context(request, params.orderId);
    if (found instanceof Response) return found;
    const service = found.detail.designService;
    if (!service || service.status !== "delivered")
      return problem(409, "design.not_delivered", "อนุมัติได้หลังนักออกแบบส่งงานแล้ว");
    service.status = "approved";
    const last = service.rounds.at(-1);
    if (last) last.status = "approved";
    // The approved design becomes the artwork prepress proofs.
    customerSubmit(
      found.detail,
      (last?.files ?? []).map((file) => ({ fileId: file.id, role: "artwork" as const, name: file.originalName })),
      whoOf(found.customer, found.order.customer.displayName),
      null,
    );
    return toArtwork(refreshPrepress(found.detail));
  }),
];
