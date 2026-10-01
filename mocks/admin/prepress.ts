/**
 * The prepress desk's state — every order's artwork submissions, proofs and annotations, template
 * deliveries and hired design — and the back office's design documents.
 *
 * This is the one stateful source of artwork (U-F0.3): the published admin operations
 * (`./artwork.ts`) and the storefront's (`../store/artwork.ts`) both project these rows onto the
 * contract's DTOs, so a file accepted in prepress, a proof sent or a comment made shows on the
 * order screen, the prepress workspace and the customer's pages alike. Prepress state hangs off the
 * commerce mock's own orders, and a change here moves that order's artwork status too, the way
 * B4.1's events would. Stages follow B4.1: preflight (D-070) → accepted for proof
 * → proof with the customer → approved or changes requested; hired design rounds with three
 * free, then a paid round the customer settles first (D-071); a mockup job (D-072). Drawing the
 * dieline answers 501 `drawing.engine_unavailable`, exactly as B4.1 does until the engine ships.
 *
 * The rows keep the aggregate's shape the prepress requests asked for (`admin-prepress.ts`),
 * because assigning an order is still a request that answers it. Two requests stay mocked here:
 * assign and copy (CONTRACT-REQUEST admin.prepress-actions, admin.design-documents).
 */

import { http, HttpResponse } from "msw";
import type { z } from "zod";

import type { designRound, prepressDetail, proofDetail } from "@/lib/api/requests/admin-prepress";
import type { designDocumentView } from "@/lib/api/requests/admin-prepress";
import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, mockId, problem } from "../support";
import { designProductRefOf, storeDesignDtoForStaff } from "../store/designs";
import { baht, orders, satang } from "./commerce";
import { registerQueue } from "./console";

type Detail = z.output<typeof prepressDetail>;
type Proof = z.output<typeof proofDetail>;
type Round = z.output<typeof designRound>;

/** One annotation as the desk keeps it; replies carry `parentId` (the old request's shape, mock-only). */
interface Annotation {
  id: string;
  parentId: string | null;
  page: number;
  kind: Schemas["AnnotationKind"];
  /** Page-relative 0–1 coordinates: `{ x, y }` for a pin, `{ x, y, w, h }` for a rect, `{ points }` for a drawing. */
  geometry: Record<string, unknown>;
  comment: string;
  author: { id: string; displayName: string };
  authorKind: Schemas["AnnotationAuthorKind"];
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: { id: string; displayName: string } | null;
}
type Order = (typeof orders)[number];
type FileRef = Detail["proofs"][number]["proofFile"];

const HOUR = 60;
const DAY = 24 * HOUR;

const PREPRESS = PERSONAS.find((persona) => persona.key === "prepress")!;
const refOf = (who: StaffPersona) => ({ id: who.id, displayName: who.displayName });

function file(n: number, name: string, mimeType = "application/pdf"): FileRef {
  return {
    id: mockId("ppf", n),
    originalName: name,
    mimeType,
    sizeBytes: 240_000 + n * 3_517,
    thumbnailUrl: null,
    url: `data:text/plain;charset=utf-8,${encodeURIComponent(`${name} (ข้อมูลจำลอง)`)}`,
  };
}

/** A small tuck-end box with a brand panel, as the online designer would have saved it. */
const SAMPLE_DESIGN = {
  spec: { style: "tuck-end", dims: { length: 80, width: 50, height: 120 }, paperId: "ivory-350" },
  content: {
    pattern: { kind: "solid", color: "#eef6f4", background: "#ffffff", size: 10 },
    elements: [
      {
        id: "e1",
        type: "rect",
        x: 22,
        y: 78,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        width: 68,
        height: 30,
        fill: "#0f5f58",
        stroke: "#000000",
        strokeWidth: 0,
        cornerRadius: 2,
      },
      {
        id: "e2",
        type: "text",
        x: 27,
        y: 88,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        text: "แบรนด์ตัวอย่าง",
        fontSize: 7,
        fontFamily: "Noto Sans Thai",
        fontStyle: "bold",
        fill: "#ffffff",
        align: "left",
      },
      {
        id: "e3",
        type: "circle",
        x: 41,
        y: 125,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        width: 30,
        height: 30,
        fill: "#e8a33d",
        stroke: "#000000",
        strokeWidth: 0,
        cornerRadius: 0,
      },
    ],
  },
};

/* ------------------------------------------------------------------------------------ seeds */

type Plan =
  | { stage: "template" }
  | { stage: "preflight"; blocked: boolean }
  | { stage: "proof"; designer?: boolean }
  | { stage: "awaiting_customer"; mockup?: boolean }
  | { stage: "changes_requested" }
  | { stage: "design"; rounds: Round["status"][] }
  | { stage: "mockup" };

/** Order index (0-based, the commerce seed) → what is on the prepress desk for it. */
const PLANS: Record<number, Plan> = {
  // The storefront's returning customer's hired-design order, three rounds in (F3 3.5).
  0: { stage: "design", rounds: ["changes_requested", "changes_requested", "delivered"] },
  7: { stage: "design", rounds: ["in_progress"] },
  11: { stage: "template" },
  12: { stage: "preflight", blocked: true },
  13: { stage: "preflight", blocked: false },
  14: { stage: "design", rounds: ["changes_requested", "changes_requested", "changes_requested", "awaiting_payment"] },
  15: { stage: "proof", designer: true },
  16: { stage: "awaiting_customer" },
  17: { stage: "changes_requested" },
  18: { stage: "awaiting_customer", mockup: true },
  19: { stage: "mockup" },
};

const SLA_HOURS: Record<string, number> = {
  preflight: 4,
  proof: 8,
  changes_requested: 8,
  template: 4,
  awaiting_customer: 48,
  design: 40,
  mockup: 72,
};

const details = new Map<string, Detail>();
const annotations = new Map<string, Annotation[]>();

function submission(order: Order, n: number, plan: Plan): Detail["submissions"][number] {
  const blocked = plan.stage === "preflight" && plan.blocked;
  const warned = plan.stage === "preflight" && !plan.blocked;
  const designer = plan.stage === "proof" && plan.designer;
  return {
    id: mockId("sub", 500 + n),
    versionNo: 1,
    source: designer ? "designer" : "upload",
    status: plan.stage === "preflight" ? "submitted" : "accepted_for_proof",
    preflightStatus: blocked ? "blocked" : warned ? "passed_with_warnings" : "passed",
    preflightCompletedAt: bangkokIso(-5 * HOUR),
    findings: blocked
      ? [
          {
            check: "size_mismatch",
            severity: "block",
            page: 1,
            message: "ขนาดไฟล์ 210 × 297 มม. ไม่ตรงกับแบบกล่อง 276 × 255 มม.",
            thumbnailUrl: null,
          },
          {
            check: "missing_bleed",
            severity: "block",
            page: 1,
            message: "ไม่มีระยะตัดตก 3 มม. รอบแบบ",
            thumbnailUrl: null,
          },
          { check: "rgb_colour", severity: "warn", page: 1, message: "ภาพ 2 ภาพเป็นโหมดสี RGB", thumbnailUrl: null },
        ]
      : warned
        ? [
            {
              check: "low_resolution",
              severity: "warn",
              page: 1,
              message: "ภาพด้านหน้าความละเอียด 220 ppi ต่ำกว่า 300 ppi",
              thumbnailUrl: null,
            },
            { check: "rgb_colour", severity: "warn", page: 1, message: "โลโก้เป็นโหมดสี RGB", thumbnailUrl: null },
            { check: "thin_lines", severity: "info", page: 1, message: "เส้นบางที่สุด 0.2 pt", thumbnailUrl: null },
          ]
        : [],
    files: [{ role: "artwork", file: file(n * 10, `${order.orderCode}-artwork-v1.pdf`) }],
    designDocumentId: designer ? mockId("ddc", n) : null,
    submittedBy: { id: order.customer.id, displayName: order.customer.displayName },
    submittedAt: bangkokIso(-6 * HOUR),
    nextActions: [],
  };
}

function proof(order: Order, n: number, versionNo: number, status: Proof["status"]): Proof {
  return {
    id: mockId("prf", 500 + n * 10 + versionNo),
    versionNo,
    submissionVersionNo: 1,
    status,
    proofFile: file(n * 10 + versionNo, `${order.orderCode}-proof-v${versionNo}.pdf`),
    dielineFile: file(n * 10 + 5, `${order.orderCode}-dieline.pdf`),
    note: "ตรวจสีและข้อความก่อนอนุมัติ",
    preparedBy: refOf(PREPRESS),
    sentAt: bangkokIso(-(30 - versionNo * 6) * HOUR),
    decidedAt:
      status === "changes_requested" || status === "superseded" ? bangkokIso(-(20 - versionNo * 6) * HOUR) : null,
    decidedBy:
      status === "changes_requested" || status === "superseded"
        ? { id: order.customer.id, displayName: order.customer.displayName }
        : null,
    decisionChannel: status === "changes_requested" || status === "superseded" ? "web" : null,
    onBehalfReason: null,
    approvedFileSha256: null,
    annotations: { open: 0, resolved: 0 },
  };
}

function seedAnnotations(proofId: string, order: Order, n: number, open: boolean) {
  const customer = { id: order.customer.id, displayName: order.customer.displayName };
  const first = mockId("ann", n * 10 + 1);
  annotations.set(proofId, [
    {
      id: first,
      parentId: null,
      page: 1,
      kind: "pin",
      geometry: { x: 0.32, y: 0.41 },
      comment: "ขอโลโก้ใหญ่ขึ้นอีกนิด และขยับขึ้นด้านบน",
      author: customer,
      authorKind: "customer",
      createdAt: bangkokIso(-20 * HOUR),
      resolvedAt: null,
      resolvedBy: null,
    },
    {
      id: mockId("ann", n * 10 + 2),
      parentId: null,
      page: 1,
      kind: "rect",
      geometry: { x: 0.55, y: 0.6, w: 0.2, h: 0.08 },
      comment: "เบอร์โทรผิด ที่ถูกคือ 02-000-0000",
      author: customer,
      authorKind: "customer",
      createdAt: bangkokIso(-19 * HOUR),
      resolvedAt: open ? null : bangkokIso(-2 * HOUR),
      resolvedBy: open ? null : refOf(PREPRESS),
    },
  ]);
}

function designService(order: Order, n: number, plan: Extract<Plan, { stage: "design" }>): Detail["designService"] {
  const fee = order.lines.find((line) => line.lineType === "design_fee");
  const feeNet = fee ? fee.netAmount : "1500.00";
  const free = 3;
  const rounds: Round[] = plan.rounds.map((status, at) => {
    const roundNo = at + 1;
    const chargeable = roundNo > free;
    return {
      roundNo,
      kind: roundNo === 1 ? "initial" : "revision",
      chargeable,
      // D-071: max(THB 500, 20 % of the design fee) — the API's figure; the mock computes it in satang.
      feeAmount: chargeable ? baht(Math.max(50_000, Math.round(satang(feeNet) * 0.2))) : null,
      status,
      requestedAt: bangkokIso(-(8 - at) * DAY),
      startedAt: status === "awaiting_payment" ? null : bangkokIso(-(8 - at) * DAY + HOUR),
      deliveredAt: status === "awaiting_payment" || status === "in_progress" ? null : bangkokIso(-(7 - at) * DAY),
      files: status === "awaiting_payment" ? [] : [file(n * 100 + roundNo, `design-round-${roundNo}.pdf`)],
      note: status === "changes_requested" ? "ลูกค้าขอเปลี่ยนโทนสีและตัวอักษร" : null,
    };
  });
  const next = rounds.length + (rounds.at(-1)?.status === "awaiting_payment" ? 0 : 1);
  return {
    id: mockId("dsr", n),
    status:
      rounds.length === 0
        ? "brief_pending"
        : rounds.at(-1)!.status === "awaiting_payment"
          ? "revision_requested"
          : rounds.at(-1)!.status === "delivered"
            ? "delivered"
            : "in_progress",
    brief: [
      { label: "ชื่อแบรนด์", value: "แบรนด์ตัวอย่าง" },
      { label: "กลุ่มลูกค้า", value: "ผู้หญิงอายุ 25–40 ปี" },
      { label: "โทนสีที่ต้องการ", value: "เขียวเข้ม ทอง" },
      { label: "สิ่งที่ต้องมีบนกล่อง", value: "โลโก้ ชื่อสินค้า ส่วนประกอบ เลข อย." },
      { label: "ตัวอย่างที่ชอบ", value: "เรียบ หรู ไม่ใช้ภาพถ่าย" },
    ],
    briefFiles: [file(n * 100, "brief-logo.ai", "application/postscript")],
    designer: rounds.length ? refOf(PREPRESS) : null,
    targetDueAt: bangkokIso(3 * DAY),
    maxDueAt: bangkokIso(8 * DAY),
    freeRounds: free,
    designFeeNet: feeNet,
    rounds,
    nextRound: {
      roundNo: next,
      chargeable: next > free,
      feeAmount: next > free ? baht(Math.max(50_000, Math.round(satang(feeNet) * 0.2))) : null,
    },
  };
}

function build(order: Order, index: number, plan: Plan): Detail {
  const n = index + 1;
  const detail: Detail = {
    orderId: order.id,
    orderCode: order.orderCode,
    orderStatus: order.status,
    customer: order.customer,
    productType: order.productType,
    quantity: order.quantity,
    unit: order.unit,
    specs: order.specs,
    dieline: { patternCode: "RTE-01", lengthMm: 80, widthMm: 50, heightMm: 120 },
    designOption: plan.stage === "design" ? "hired_design" : order.designOption,
    mockupOption:
      plan.stage === "mockup" || (plan.stage === "awaiting_customer" && plan.mockup) ? "with_print" : "none",
    promisedShipDate: order.promisedShipDate,
    artworkStatus: order.artworkStatus,
    stage: plan.stage,
    assignee: ["preflight", "template"].includes(plan.stage) ? null : refOf(PREPRESS),
    slaDueAt: bangkokIso((SLA_HOURS[plan.stage] ?? 8) * HOUR - 6 * HOUR),
    urgency: "normal",
    submissions: [],
    proofs: [],
    templateDeliveries: [],
    drawingJobs: [],
    designService: null,
    mockup: null,
    designDocument: null,
    nextActions: [],
  };

  switch (plan.stage) {
    case "template":
      detail.artworkStatus = "awaiting_template";
      break;
    case "preflight":
      detail.submissions = [submission(order, n, plan)];
      detail.artworkStatus = "in_review";
      break;
    case "proof":
      detail.submissions = [submission(order, n, plan)];
      detail.artworkStatus = "in_review";
      if (plan.designer) {
        detail.designDocument = {
          id: mockId("ddc", n),
          title: `กล่อง ${order.customer.displayName}`,
          versionNo: 3,
          schemaVersion: 1,
          document: SAMPLE_DESIGN,
          thumbnailUrl: null,
          owner: { displayName: order.customer.displayName },
          editable: false,
          updatedAt: bangkokIso(-7 * HOUR),
        };
      }
      break;
    case "awaiting_customer": {
      detail.submissions = [submission(order, n, plan)];
      const current = proof(order, n, 1, "pending_customer");
      detail.proofs = [current];
      detail.artworkStatus = "proof_sent";
      seedAnnotations(current.id, order, n, true);
      if (plan.mockup) {
        detail.mockup = {
          jobId: mockId("job", 900 + n),
          jobNo: `MJ-2569-${String(40 + n).padStart(5, "0")}`,
          option: "with_print",
          status: "released",
          factory: { name: "โรงงานพาร์ตเนอร์ ตัวอย่าง (ข้อมูลจำลอง)" },
          promisedAt: bangkokIso(4 * DAY),
        };
      }
      break;
    }
    case "changes_requested": {
      detail.submissions = [submission(order, n, plan)];
      const first = proof(order, n, 1, "changes_requested");
      detail.proofs = [first];
      detail.artworkStatus = "changes_requested";
      seedAnnotations(first.id, order, n, true);
      break;
    }
    case "design":
      detail.designService = designService(order, n, plan);
      if (plan.rounds.length) detail.artworkStatus = "in_review";
      break;
    case "mockup":
      detail.artworkStatus = "approved";
      detail.mockup = {
        jobId: mockId("job", 900 + n),
        jobNo: `MJ-2569-${String(40 + n).padStart(5, "0")}`,
        option: "with_print",
        status: "in_progress",
        factory: { name: "โรงงานพาร์ตเนอร์ ตัวอย่าง (ข้อมูลจำลอง)" },
        promisedAt: bangkokIso(2 * DAY),
      };
      break;
  }
  return refresh(detail);
}

/* -------------------------------------------------------------------------- derived, actions */

function stageOf(detail: Detail): Detail["stage"] {
  const latest = detail.submissions[0];
  const current = detail.proofs[0];
  const design = detail.designService;
  if (design && ["brief_pending", "in_progress", "revision_requested"].includes(design.status)) return "design";
  if (detail.artworkStatus === "awaiting_template") return "template";
  if (latest && latest.status === "submitted") return "preflight";
  if (current?.status === "changes_requested") return "changes_requested";
  if (current?.status === "pending_customer") return "awaiting_customer";
  if (latest?.status === "accepted_for_proof" && !current) return "proof";
  if (detail.mockup && !["completed", "cancelled"].includes(detail.mockup.status)) return "mockup";
  return null;
}

function refresh(detail: Detail): Detail {
  detail.stage = stageOf(detail);
  const due = detail.slaDueAt ? Date.parse(detail.slaDueAt) : null;
  detail.urgency =
    due === null || detail.stage === null || detail.stage === "awaiting_customer"
      ? "normal"
      : due < Date.now()
        ? "late"
        : due - Date.now() < 2 * 60 * 60_000
          ? "due_soon"
          : "normal";
  for (const item of detail.proofs) {
    const threads = (annotations.get(item.id) ?? []).filter((annotation) => !annotation.parentId);
    item.annotations = {
      open: threads.filter((thread) => !thread.resolvedAt).length,
      resolved: threads.filter((thread) => thread.resolvedAt).length,
    };
  }
  for (const item of detail.submissions) {
    const blocking = item.findings.some((finding) => finding.severity === "block");
    item.nextActions =
      item.status === "submitted"
        ? [
            {
              key: "submission.accept",
              disabledReason: blocking ? "มีจุดที่ต้องแก้ก่อนทำปรู๊ฟ (ขนาดไม่ตรงหรือไม่มีระยะตัดตก, D-070)" : null,
            },
            { key: "submission.reject" },
          ]
        : [];
  }
  const actions: Detail["nextActions"] = [];
  const latest = detail.submissions[0];
  const current = detail.proofs[0];
  if (latest?.status === "accepted_for_proof" && (!current || current.status === "changes_requested")) {
    actions.push({ key: "prepress.upload_proof", irreversible: true });
  }
  if (detail.designService && ["in_progress"].includes(detail.designService.status)) {
    actions.push({ key: "prepress.deliver_round", irreversible: true });
  }
  if (["awaiting_template", "awaiting_upload"].includes(detail.artworkStatus)) {
    actions.push({ key: "prepress.send_template", irreversible: true });
  }
  // Routine and exceptional actions follow the stage's own work, so neither leads the header.
  actions.push({ key: "prepress.assign" }, { key: "prepress.draw_dieline" });
  if (detail.designService && ["in_progress", "revision_requested"].includes(detail.designService.status)) {
    actions.push({ key: "prepress.requote_design", irreversible: true });
  }
  detail.nextActions = actions;

  // The order screen reads the same fact.
  const order = orders.find((candidate) => candidate.id === detail.orderId);
  if (order) {
    order.artworkStatus = detail.artworkStatus;
    order.artwork.status = detail.artworkStatus;
    if (detail.submissions.length) {
      order.artwork.submissions = detail.submissions.map((item) => ({
        id: item.id,
        versionNo: item.versionNo,
        source: item.source,
        preflightStatus: item.preflightStatus,
        findings: item.findings.map(({ thumbnailUrl: _thumbnail, ...finding }) => finding),
        files: item.files.map((entry) => entry.file),
        submittedAt: item.submittedAt,
        submittedBy: item.submittedBy,
      }));
    }
    if (detail.proofs.length) {
      order.artwork.proofs = detail.proofs.map((item) => ({
        id: item.id,
        versionNo: item.versionNo,
        status: item.status,
        sentAt: item.sentAt,
        decidedAt: item.decidedAt,
        decisionChannel: item.decisionChannel,
        file: item.proofFile,
        openAnnotations: item.annotations.open,
      }));
    }
  }
  return detail;
}

orders.forEach((order, index) => {
  const plan = PLANS[index];
  if (plan) details.set(order.id, build(order, index, plan));
});

/* ----------------------------------------------------------------------------- queues, lookups */

/** packio-api's prepress queue (`admin.artwork.queue`), one row per submission or proof. */
export type QueueKind = Schemas["PrepressQueueKind"];

/** Prepress's SLA in the mock: a flat number of hours from when the work arrived (D-175 is the API's). */
const PREPRESS_SLA_MINUTES = 8 * HOUR;

function dueOf(since: string) {
  return new Date(Date.parse(since) + PREPRESS_SLA_MINUTES * 60_000);
}

/**
 * The rows of one queue, oldest first, as packio-api builds them: preflighted files still to
 * review; proofs waiting for the customer (no due time — they wait on the customer); proofs the
 * customer sent back that no newer proof answers yet.
 */
export function queueItems(kind: QueueKind): Schemas["PrepressQueueItemDto"][] {
  const rows: Schemas["PrepressQueueItemDto"][] = [];
  for (const detail of [...details.values()].map(refresh)) {
    const order = orders.find((candidate) => candidate.id === detail.orderId);
    if (!order || order.status === "cancelled") continue;
    if (kind === "submissions") {
      for (const item of detail.submissions) {
        if (item.status !== "submitted" || item.preflightStatus === "pending" || item.preflightStatus === "running")
          continue;
        const since = item.preflightCompletedAt ?? item.submittedAt;
        rows.push({
          orderId: detail.orderId,
          orderCode: detail.orderCode,
          customer: { id: order.customer.id, displayName: order.customer.displayName },
          productTypeCode: order.productType.code,
          artworkStatus: detail.artworkStatus,
          assignee: detail.assignee,
          kind,
          itemId: item.id,
          versionNo: item.versionNo,
          preflightStatus: item.preflightStatus,
          since,
          dueAt: bangkokIsoOf(dueOf(since)),
          overdue: dueOf(since).getTime() < Date.now(),
        });
      }
    } else {
      const latest = detail.proofs[0];
      for (const item of detail.proofs) {
        const waiting = kind === "proofs_waiting" && item.status === "pending_customer";
        const sentBack =
          kind === "changes_requested" &&
          item.status === "changes_requested" &&
          item === latest &&
          detail.artworkStatus === "changes_requested";
        if (!waiting && !sentBack) continue;
        const since = waiting ? item.sentAt : (item.decidedAt ?? item.sentAt);
        rows.push({
          orderId: detail.orderId,
          orderCode: detail.orderCode,
          customer: { id: order.customer.id, displayName: order.customer.displayName },
          productTypeCode: order.productType.code,
          artworkStatus: detail.artworkStatus,
          assignee: detail.assignee,
          kind,
          itemId: item.id,
          versionNo: item.versionNo,
          preflightStatus: null,
          since,
          dueAt: waiting ? null : bangkokIsoOf(dueOf(since)),
          overdue: !waiting && dueOf(since).getTime() < Date.now(),
        });
      }
    }
  }
  return rows.sort((left, right) => Date.parse(left.since) - Date.parse(right.since));
}

/** A `Date` as the API writes it, on Bangkok time. */
function bangkokIsoOf(date: Date): string {
  return bangkokIso(Math.round((date.getTime() - Date.now()) / 60_000));
}

for (const kind of ["submissions", "changes_requested", "proofs_waiting"] as const) {
  registerQueue("artwork.read", () => {
    const rows = queueItems(kind);
    const due = rows
      .map((row) => row.dueAt)
      .filter((at): at is string => Boolean(at))
      .sort();
    return {
      key: `prepress.${kind}`,
      path: `/admin/prepress?kind=${kind}`,
      count: rows.length,
      overdueCount: rows.filter((row) => row.overdue).length,
      nextDueAt: due.find((at) => Date.parse(at) >= Date.now()) ?? null,
    };
  });
}

const notFound = () => problem(404, "prepress.not_found", "ไม่พบงานก่อนพิมพ์ของคำสั่งซื้อนี้");
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const conflict = (detail: string) => problem(409, "prepress.invalid_state", detail);

function manage(
  request: Request,
  orderId: string | undefined,
  action?: string,
): Response | { detail: Detail; who: StaffPersona } {
  const who = staffPersonaOf(request);
  if (!who || !can(who, "prepress.review")) return forbidden();
  const detail = orderId ? prepressOf(orderId) : undefined;
  if (!detail) return notFound();
  if (action && !refresh(detail).nextActions.some((item) => item.key === action && !item.disabledReason)) {
    return conflict("ทำรายการนี้ในขั้นตอนนี้ไม่ได้");
  }
  return { detail, who };
}

export function bySubmission(submissionId: string | undefined) {
  for (const detail of details.values()) {
    const found = detail.submissions.find((item) => item.id === submissionId);
    if (found) return { detail, submission: found };
  }
  return null;
}

export function byProof(proofId: string | undefined) {
  for (const detail of details.values()) {
    const found = detail.proofs.find((item) => item.id === proofId);
    if (found) return { detail, proof: found };
  }
  return null;
}

export function byAnnotation(annotationId: string | undefined) {
  for (const [proofId, list] of annotations) {
    const annotation = list.find((item) => item.id === annotationId);
    const found = annotation ? byProof(proofId) : null;
    if (annotation && found) return { ...found, annotation };
  }
  return null;
}

export function byDesignService(designServiceId: string | undefined) {
  for (const detail of details.values()) {
    if (detail.designService?.id === designServiceId) return { detail, service: detail.designService! };
  }
  return null;
}

/** Every prepress row made so far (the seeded plans and any order opened since). */
export function prepressRows(): Detail[] {
  return [...details.values()].map(refresh);
}

export function uploaded(fileId: string, name: string): FileRef {
  return {
    id: fileId,
    originalName: name,
    mimeType: "application/pdf",
    sizeBytes: 250_000,
    thumbnailUrl: null,
    url: null,
  };
}

/** Why prepress sent a submission back, which the customer reads (`rejectReason`). */
export const rejectReasons = new Map<string, string>();
/** A manual template's note to the customer (`DielineDeliveryDto.note`). */
export const templateNotes = new Map<string, string>();

/* ------------------------------------------------------------ the customer's side (mocks/store) */

export { annotations as proofAnnotations };
export type PrepressDetail = Detail;
export type PrepressAnnotation = Annotation;

/** The prepress row of an order, made on first use for one no seed plan covers. */
export function prepressOf(orderId: string): Detail | undefined {
  const known = details.get(orderId);
  if (known) return refresh(known);
  const index = orders.findIndex((order) => order.id === orderId);
  const order = orders[index];
  if (!order) return undefined;
  const detail = build(order, index, { stage: "template" });
  detail.artworkStatus = order.artworkStatus;
  detail.designOption = order.designOption;
  detail.mockupOption = order.mockupOption;
  // What the commerce fixture already holds for the order, so the order screen and the workspace
  // start from the same history.
  const customer = { id: order.customer.id, displayName: order.customer.displayName };
  detail.submissions = [...order.artwork.submissions]
    .sort((left, right) => right.versionNo - left.versionNo)
    .map((item) => ({
      id: item.id,
      versionNo: item.versionNo,
      source: item.source,
      status: order.artworkStatus === "uploaded" ? "submitted" : "accepted_for_proof",
      preflightStatus: item.preflightStatus,
      preflightCompletedAt: item.submittedAt,
      findings: item.findings.map((finding) => ({ ...finding, thumbnailUrl: null })),
      files: item.files.map((entry) => ({ role: "artwork" as const, file: entry })),
      designDocumentId: null,
      submittedBy: item.submittedBy,
      submittedAt: item.submittedAt,
      nextActions: [],
    }));
  detail.proofs = [...order.artwork.proofs]
    .sort((left, right) => right.versionNo - left.versionNo)
    .map((item) => ({
      id: item.id,
      versionNo: item.versionNo,
      submissionVersionNo: detail.submissions[0]?.versionNo ?? 1,
      status: item.status,
      proofFile: item.file,
      dielineFile: null,
      note: null,
      preparedBy: refOf(PREPRESS),
      sentAt: item.sentAt,
      decidedAt: item.decidedAt,
      decidedBy: item.decidedAt ? customer : null,
      decisionChannel: item.decisionChannel,
      onBehalfReason: null,
      approvedFileSha256: item.status === "approved" ? "a3f5".padEnd(64, "0") : null,
      annotations: { open: 0, resolved: 0 },
    }));
  if (order.designOption === "hired_design")
    detail.designService = designService(order, index + 1, { stage: "design", rounds: [] });
  details.set(orderId, detail);
  return refresh(detail);
}

/**
 * Preflight, mocked by file name (D-070): `size` or `nobleed` blocks, `lowres` or `rgb` warns,
 * anything else passes — so a test can ask for each outcome.
 */
function preflightOf(names: string[]): Pick<Detail["submissions"][number], "preflightStatus" | "findings"> {
  const findings: Detail["submissions"][number]["findings"] = [];
  const joined = names.join(" ").toLowerCase();
  if (joined.includes("size"))
    findings.push({
      check: "size_mismatch",
      severity: "block",
      page: 1,
      message: "ขนาดไฟล์ไม่ตรงกับแบบกล่อง กรุณาใช้แม่แบบที่ดาวน์โหลดจากหน้านี้",
      thumbnailUrl: null,
    });
  if (joined.includes("nobleed"))
    findings.push({
      check: "missing_bleed",
      severity: "block",
      page: 1,
      message: "ไม่มีระยะตัดตก 3 มม. รอบแบบ",
      thumbnailUrl: null,
    });
  if (joined.includes("lowres"))
    findings.push({
      check: "low_resolution",
      severity: "warn",
      page: 1,
      message: "ภาพความละเอียด 180 ppi ต่ำกว่า 300 ppi อาจไม่คมชัด",
      thumbnailUrl: null,
    });
  if (joined.includes("rgb"))
    findings.push({
      check: "rgb_colour",
      severity: "warn",
      page: 1,
      message: "ไฟล์เป็นโหมดสี RGB สีที่พิมพ์ออกมาอาจต่างจากหน้าจอ",
      thumbnailUrl: null,
    });
  const status = findings.some((finding) => finding.severity === "block")
    ? "blocked"
    : findings.length > 0
      ? "passed_with_warnings"
      : "passed";
  return { preflightStatus: status, findings };
}

export function customerSubmit(
  detail: Detail,
  files: { fileId: string; role: Detail["submissions"][number]["files"][number]["role"]; name: string }[],
  who: { id: string; displayName: string },
  designDocumentId: string | null,
): Detail {
  for (const item of detail.submissions) if (item.status === "submitted") item.status = "superseded";
  const versionNo = (detail.submissions[0]?.versionNo ?? 0) + 1;
  const result = preflightOf(files.map((entry) => entry.name));
  detail.submissions.unshift({
    id: mockId("sub", 7000 + versionNo + Math.floor(Math.random() * 900)),
    versionNo,
    source: designDocumentId ? "designer" : "upload",
    status: result.preflightStatus === "blocked" ? "rejected" : "submitted",
    ...result,
    preflightCompletedAt: bangkokIso(),
    files: files.map((entry) => ({ role: entry.role, file: uploaded(entry.fileId, entry.name) })),
    designDocumentId,
    submittedBy: who,
    submittedAt: bangkokIso(),
    nextActions: [],
  });
  detail.artworkStatus = result.preflightStatus === "blocked" ? "awaiting_upload" : "uploaded";
  detail.slaDueAt = bangkokIso(4 * HOUR);
  return refresh(detail);
}

export function customerDecide(
  detail: Detail,
  proofId: string,
  outcome: "approved" | "changes_requested",
  who: { id: string; displayName: string },
): Detail | Response {
  const current = detail.proofs.find((item) => item.id === proofId);
  if (!current || current.status !== "pending_customer") return conflict("ปรู๊ฟฉบับนี้ไม่ได้รอการตรวจแล้ว");
  current.status = outcome;
  current.decidedAt = bangkokIso();
  current.decidedBy = who;
  current.decisionChannel = "web";
  if (outcome === "approved") {
    current.approvedFileSha256 = "a3f5".padEnd(64, "0");
    detail.artworkStatus = "approved";
    const order = orders.find((candidate) => candidate.id === detail.orderId);
    // D-073: production starts once artwork is approved and the before-production instalments are paid.
    if (order && order.status === "paid_for_production") order.status = "artwork_approved";
  } else {
    detail.artworkStatus = "changes_requested";
  }
  return refresh(detail);
}

export function customerAnnotate(
  proofId: string,
  // `page`, `kind` and `geometry` are a new annotation's own; a reply takes its parent's.
  input: {
    page?: number;
    kind?: Annotation["kind"];
    geometry?: Record<string, unknown>;
    body: string;
    parentId?: string;
  },
  who: { id: string; displayName: string },
): Annotation {
  const list = annotations.get(proofId) ?? [];
  const parent = input.parentId ? list.find((item) => item.id === input.parentId) : undefined;
  const created: Annotation = {
    id: mockId("ann", 6000 + list.length + Math.floor(Math.random() * 900)),
    parentId: parent?.id ?? null,
    page: parent?.page ?? input.page ?? 1,
    kind: parent?.kind ?? input.kind ?? "pin",
    geometry: parent?.geometry ?? input.geometry ?? {},
    comment: input.body,
    author: who,
    authorKind: "customer",
    createdAt: bangkokIso(),
    resolvedAt: null,
    resolvedBy: null,
  };
  annotations.set(proofId, [...list, created]);
  return created;
}

/** An order's prepress row if it has one — without making one (a list must not create rows). */
export function prepressIfAny(orderId: string): Detail | undefined {
  const known = details.get(orderId);
  return known ? refresh(known) : undefined;
}

export function refreshPrepress(detail: Detail): Detail {
  return refresh(detail);
}

type DesignDocumentView = z.output<typeof designDocumentView>;

/** Copies prepress made to work on (F2 2.4, F4 C.2): only the staff member who made one saves it. */
const staffCopies = new Map<string, { ownerId: string; view: DesignDocumentView }>();
let copyCounter = 0;

/** The document on a seeded order (the online designer's), by id. */
function onOrder(id: string) {
  return [...details.values()].find((detail) => detail.designDocument?.id === id)?.designDocument ?? null;
}

/** A document by id, in the copy request's shape: a staff copy, a customer's document on an order, or a saved design. */
function documentFor(id: string, staffId: string): DesignDocumentView | null {
  const copy = staffCopies.get(id);
  if (copy) return { ...copy.view, editable: copy.ownerId === staffId };
  const ordered = onOrder(id);
  if (ordered) return { ...ordered, editable: false };
  const saved = storeDesignDtoForStaff(id);
  if (!saved) return null;
  const document = saved.document as DesignDocumentView["document"] | null;
  return {
    id: saved.id,
    title: saved.title,
    versionNo: saved.versionNo ?? 1,
    schemaVersion: saved.schemaVersion ?? 1,
    document: document ?? { spec: {}, content: {} },
    thumbnailUrl: null,
    owner: { displayName: "ลูกค้า" },
    editable: false,
    updatedAt: saved.updatedAt,
  };
}

/** The published design (`admin.designs.get`): the document opaque, no owner and no editable flag. */
function toDesignDto(id: string): Schemas["DesignDocumentDto"] | null {
  const saved = storeDesignDtoForStaff(id);
  if (saved && !staffCopies.has(id)) return saved;
  const view = staffCopies.get(id)?.view ?? onOrder(id);
  if (!view) return null;
  const catalogProductId = mockId("cpr", 1);
  return {
    id: view.id,
    title: view.title,
    catalogProductId,
    product: designProductRefOf(catalogProductId),
    patternId: null,
    materialId: null,
    semiDesignTemplateId: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    document: view.document,
    schemaVersion: view.schemaVersion,
    versionNo: view.versionNo,
    thumbnailFileId: null,
    thumbnailUrl: view.thumbnailUrl,
    assets: [],
    // A staff copy or an order's document: no order list or view link of its own, one time stamp.
    orders: [],
    share: null,
    createdAt: view.updatedAt,
    updatedAt: view.updatedAt,
  };
}

const etagOf = (versionNo: number | null) => `"v${versionNo ?? 0}"`;

/** The published design surface of the back office (`admin.designs.get` / `.save`, If-Match). */
export const designContractHandlers = [
  http.get("*/v1/admin/designs/:designId", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "artwork.read")) return forbidden();
    const found = toDesignDto(String(params.designId));
    if (!found) return problem(404, "http.not_found", "ไม่พบแบบนี้");
    return HttpResponse.json(found, { headers: { ETag: etagOf(found.versionNo) } });
  }),

  http.put("*/v1/admin/designs/:designId", async ({ params, request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "catalog.manage")) return forbidden();
    const copy = staffCopies.get(String(params.designId));
    // Only the staff author's own designs save; anyone else's is not found, as packio-api answers.
    if (!copy || copy.ownerId !== who.id) return problem(404, "http.not_found", "ไม่พบแบบนี้");
    const match = request.headers.get("if-match");
    if (!match) return problem(428, "concurrency.precondition_required", "ต้องส่ง If-Match");
    if (match !== etagOf(copy.view.versionNo))
      return problem(412, "concurrency.stale", "แบบนี้ถูกบันทึกจากที่อื่นหลังจากที่คุณเปิด");
    const body = (await request.json()) as Schemas["SaveDesignDto"];
    const document = body.document as { spec?: unknown; content?: unknown };
    if (!document || typeof document.spec !== "object" || typeof document.content !== "object")
      return problem(422, "validation.failed", "เอกสารแบบไม่ถูกต้อง", [
        { path: "document", code: "invalid", message: "spec and content are required" },
      ]);
    copy.view = {
      ...copy.view,
      title: body.title ?? copy.view.title,
      document: document as DesignDocumentView["document"],
      schemaVersion: body.schemaVersion,
      versionNo: copy.view.versionNo + 1,
      updatedAt: bangkokIso(),
    };
    const saved = toDesignDto(copy.view.id)!;
    return HttpResponse.json(saved, { headers: { ETag: etagOf(saved.versionNo) } });
  }),
];

/** What is still a request (CONTRACT-REQUEST admin.prepress-actions, admin.design-documents). */
export const prepressHandlers = [
  mockRequest("POST /v1/admin/prepress/{orderId}/actions/assign", ({ params, body, request }) => {
    const found = manage(request, params.orderId, "prepress.assign");
    if (found instanceof Response) return found;
    const person = body.assigneeId ? PERSONAS.find((candidate) => candidate.id === body.assigneeId) : null;
    if (body.assigneeId && (!person || !can(person, "prepress.review")))
      return problem(422, "prepress.assignee_not_eligible", "พนักงานคนนี้ไม่มีสิทธิ์ทำงานก่อนพิมพ์");
    found.detail.assignee = person ? refOf(person) : null;
    return refresh(found.detail);
  }),
  mockRequest("POST /v1/admin/design-documents/{documentId}/actions/copy", ({ params, body, request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "prepress.review")) return forbidden();
    const source = documentFor(params.documentId, who.id);
    if (!source) return problem(404, "design.not_found", "ไม่พบแบบนี้");
    copyCounter += 1;
    const view: DesignDocumentView = {
      ...source,
      id: mockId("ddc", 5000 + copyCounter),
      title: body.title,
      versionNo: 1,
      owner: { displayName: who.displayName },
      editable: true,
      updatedAt: bangkokIso(),
    };
    staffCopies.set(view.id, { ownerId: who.id, view });
    return view;
  }),
];
