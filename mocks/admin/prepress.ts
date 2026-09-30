/**
 * The prepress desk, mocked (CONTRACT-REQUEST admin.prepress, admin.prepress-actions,
 * admin.prepress-proofs, admin.prepress-template, admin.design-services, admin.design-documents).
 *
 * Prepress state hangs off the commerce mock's own orders, so `/orders/{id}` and
 * `/prepress/{id}` describe the same order; a change here moves that order's artwork status
 * too, the way B4.1's events would. Stages follow B4.1: preflight (D-070) → accepted for proof
 * → proof with the customer → approved or changes requested; hired design rounds with three
 * free, then a paid round the customer settles first (D-071); a mockup job (D-072). Drawing the
 * dieline answers 501 `drawing.engine_unavailable`, exactly as B4.1 does until the engine ships.
 */

import { HttpResponse } from "msw";
import type { z } from "zod";

import type { designRound, prepressDetail, proofAnnotation, proofDetail } from "@/lib/api/requests/admin-prepress";
import { designDocumentView, prepressItem } from "@/lib/api/requests/admin-prepress";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem, sortBy } from "../support";
import { storeDesignForStaff } from "../store/designs";
import { baht, orders, satang } from "./commerce";
import { registerQueue } from "./console";

type Detail = z.output<typeof prepressDetail>;
type Proof = z.output<typeof proofDetail>;
type Annotation = z.output<typeof proofAnnotation>;
type Round = z.output<typeof designRound>;
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

/* ----------------------------------------------------------------------------- queues, search */

const QUEUE_LABEL_KEYS = ["preflight", "proof", "changes_requested", "template", "design"] as const;
for (const queue of QUEUE_LABEL_KEYS) {
  registerQueue("prepress.read", () => {
    const rows = [...details.values()].map(refresh).filter((detail) => detail.stage === queue);
    const due = rows
      .map((row) => row.slaDueAt)
      .filter((at): at is string => Boolean(at))
      .sort();
    return {
      key: `prepress.${queue}`,
      path: `/admin/prepress?queue=${queue}`,
      count: rows.length,
      overdueCount: due.filter((at) => Date.parse(at) < Date.now()).length,
      nextDueAt: due.find((at) => Date.parse(at) >= Date.now()) ?? null,
    };
  });
}

const itemOf = (detail: Detail) =>
  prepressItem.parse({
    ...detail,
    latestSubmission: detail.submissions[0]
      ? {
          versionNo: detail.submissions[0].versionNo,
          preflightStatus: detail.submissions[0].preflightStatus,
          submittedAt: detail.submissions[0].submittedAt,
        }
      : null,
    latestProof: detail.proofs[0]
      ? { versionNo: detail.proofs[0].versionNo, status: detail.proofs[0].status, sentAt: detail.proofs[0].sentAt }
      : null,
    design: detail.designService
      ? {
          status: detail.designService.status,
          roundNo: Math.max(1, detail.designService.rounds.length),
          freeRounds: detail.designService.freeRounds,
        }
      : null,
    mockup: detail.mockup ? { status: detail.mockup.status } : null,
    updatedAt: detail.submissions[0]?.submittedAt ?? detail.proofs[0]?.sentAt ?? bangkokIso(-DAY),
  });

/* --------------------------------------------------------------------------------- handlers */

const notFound = () => problem(404, "prepress.not_found", "ไม่พบงานก่อนพิมพ์ของคำสั่งซื้อนี้");
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const conflict = (detail: string) => problem(409, "prepress.invalid_state", detail);

function manage(
  request: Request,
  orderId: string | undefined,
  action?: string,
): Response | { detail: Detail; who: StaffPersona } {
  const who = staffPersonaOf(request);
  if (!who || !can(who, "prepress.manage")) return forbidden();
  const detail = orderId ? prepressOf(orderId) : undefined;
  if (!detail) return notFound();
  if (action && !refresh(detail).nextActions.some((item) => item.key === action && !item.disabledReason)) {
    return conflict("ทำรายการนี้ในขั้นตอนนี้ไม่ได้");
  }
  return { detail, who };
}

function bySubmission(submissionId: string | undefined) {
  for (const detail of details.values()) {
    const found = detail.submissions.find((item) => item.id === submissionId);
    if (found) return { detail, submission: found };
  }
  return null;
}

function byProof(proofId: string | undefined) {
  for (const detail of details.values()) {
    const found = detail.proofs.find((item) => item.id === proofId);
    if (found) return { detail, proof: found };
  }
  return null;
}

function uploaded(fileId: string, name: string): FileRef {
  return {
    id: fileId,
    originalName: name,
    mimeType: "application/pdf",
    sizeBytes: 250_000,
    thumbnailUrl: null,
    url: null,
  };
}

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
  input: { page: number; kind: Annotation["kind"]; geometry: Record<string, unknown>; body: string; parentId?: string },
  who: { id: string; displayName: string },
): Annotation {
  const list = annotations.get(proofId) ?? [];
  const parent = input.parentId ? list.find((item) => item.id === input.parentId) : undefined;
  const created: Annotation = {
    id: mockId("ann", 6000 + list.length + Math.floor(Math.random() * 900)),
    parentId: parent?.id ?? null,
    page: parent?.page ?? input.page,
    kind: parent?.kind ?? input.kind,
    geometry: parent?.geometry ?? input.geometry,
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

/** Copies prepress made to work on (F2 2.4, F4 C.2): editable by the staff member who made them. */
const staffCopies = new Map<string, { ownerId: string; view: DesignDocumentView }>();
let copyCounter = 0;

/** A document by id: a staff copy, a customer's document on an order, or a customer's saved design. */
function documentFor(id: string, staffId: string): DesignDocumentView | null {
  const copy = staffCopies.get(id);
  if (copy) return { ...copy.view, editable: copy.ownerId === staffId };
  const onOrder = [...details.values()].find((detail) => detail.designDocument?.id === id)?.designDocument;
  if (onOrder) return { ...onOrder, editable: false };
  const saved = storeDesignForStaff(id);
  if (!saved) return null;
  return {
    id: saved.id,
    title: saved.name,
    versionNo: saved.versionNo,
    schemaVersion: saved.document.schemaVersion,
    document: { spec: saved.document.spec, content: saved.document.content },
    thumbnailUrl: saved.thumbnailUrl,
    owner: { displayName: "ลูกค้า" },
    editable: false,
    updatedAt: saved.updatedAt,
  };
}

/** The view with its ETag, checked against its request like `mockRequest` checks a plain return. */
function documentResponse(
  key: "GET /v1/admin/design-documents/{documentId}" | "PUT /v1/admin/design-documents/{documentId}",
  view: DesignDocumentView,
) {
  const checked = designDocumentView.safeParse(view);
  if (!checked.success) {
    console.error(`[mock drift] ${key}`, checked.error.issues.slice(0, 5));
    return problem(500, "mock.drift", `The mock for ${key} returned a shape its request does not describe.`);
  }
  return HttpResponse.json(view, { headers: { ETag: `"v${view.versionNo}"` } });
}

export const prepressHandlers = [
  mockRequest("GET /v1/admin/prepress", ({ query, request }) => {
    if (!can(staffPersonaOf(request), "prepress.read")) return forbidden();
    const rows = [...details.values()]
      .map(refresh)
      .filter((detail) => detail.stage !== null)
      .filter((detail) => !query.queue || detail.stage === query.queue)
      .filter((detail) => !query.artworkStatus || detail.artworkStatus === query.artworkStatus)
      .filter((detail) => !query.productType || detail.productType.code === query.productType)
      .filter((detail) => !query.assigneeId || detail.assignee?.id === query.assigneeId)
      .filter((detail) => matchesQuery(query.q, detail.orderCode, detail.customer.displayName))
      .map(itemOf);
    return paginate(sortBy(rows, query.sort ?? "slaDueAt", query.order ?? "asc"), query);
  }),
  mockRequest("GET /v1/admin/prepress/{orderId}", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "prepress.read")) return forbidden();
    // Any order has a prepress row once asked for — a web order the customer uploaded to, say.
    const detail = prepressOf(params.orderId!);
    return detail ?? notFound();
  }),
  mockRequest("POST /v1/admin/prepress/{orderId}/actions/assign", ({ params, body, request }) => {
    const found = manage(request, params.orderId, "prepress.assign");
    if (found instanceof Response) return found;
    const person = body.assigneeId ? PERSONAS.find((candidate) => candidate.id === body.assigneeId) : null;
    if (body.assigneeId && (!person || !can(person, "prepress.manage")))
      return problem(422, "prepress.assignee_not_eligible", "พนักงานคนนี้ไม่มีสิทธิ์ทำงานก่อนพิมพ์");
    found.detail.assignee = person ? refOf(person) : null;
    return refresh(found.detail);
  }),
  mockRequest("POST /v1/admin/prepress/submissions/{submissionId}/actions/accept", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "prepress.manage")) return forbidden();
    const found = bySubmission(params.submissionId);
    if (!found) return notFound();
    const action = found.submission.nextActions.find((item) => item.key === "submission.accept");
    if (!action) return conflict("รับไฟล์นี้ไม่ได้ในขั้นตอนนี้");
    if (action.disabledReason) return problem(409, "preflight.blocking_findings", action.disabledReason);
    found.submission.status = "accepted_for_proof";
    found.detail.slaDueAt = bangkokIso(8 * HOUR);
    return refresh(found.detail);
  }),
  mockRequest("POST /v1/admin/prepress/submissions/{submissionId}/actions/reject", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "prepress.manage")) return forbidden();
    const found = bySubmission(params.submissionId);
    if (!found) return notFound();
    if (found.submission.status !== "submitted") return conflict("ส่งคืนไฟล์นี้ไม่ได้ในขั้นตอนนี้");
    found.submission.status = "rejected";
    found.detail.artworkStatus = "awaiting_upload";
    return refresh(found.detail);
  }),
  mockRequest("POST /v1/admin/prepress/{orderId}/proofs", ({ params, body, request }) => {
    const found = manage(request, params.orderId, "prepress.upload_proof");
    if (found instanceof Response) return found;
    const { detail, who } = found;
    const source = detail.submissions.find((item) => item.id === body.submissionId);
    if (!source || source.status !== "accepted_for_proof")
      return problem(422, "validation.failed", "เลือกไฟล์งานที่ผ่านการตรวจแล้ว", [
        { path: "submissionId", code: "state", message: "ไฟล์งานยังไม่ผ่านการตรวจ" },
      ]);
    for (const item of detail.proofs) if (item.status !== "approved") item.status = "superseded";
    const versionNo = (detail.proofs[0]?.versionNo ?? 0) + 1;
    detail.proofs.unshift({
      id: mockId("prf", 8000 + versionNo + Math.floor(Math.random() * 900)),
      versionNo,
      submissionVersionNo: source.versionNo,
      status: "pending_customer",
      proofFile: uploaded(body.proofFileId, `${detail.orderCode}-proof-v${versionNo}.pdf`),
      dielineFile: body.dielineFileId ? uploaded(body.dielineFileId, `${detail.orderCode}-dieline.pdf`) : null,
      note: body.note ?? null,
      preparedBy: refOf(who),
      sentAt: bangkokIso(),
      decidedAt: null,
      decidedBy: null,
      decisionChannel: null,
      onBehalfReason: null,
      approvedFileSha256: null,
      annotations: { open: 0, resolved: 0 },
    });
    detail.artworkStatus = "proof_sent";
    detail.slaDueAt = bangkokIso(48 * HOUR);
    return refresh(detail);
  }),
  mockRequest("GET /v1/admin/prepress/proofs/{proofId}/annotations", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "prepress.read")) return forbidden();
    return byProof(params.proofId) ? { data: annotations.get(params.proofId!) ?? [] } : notFound();
  }),
  mockRequest("POST /v1/admin/prepress/proofs/{proofId}/annotations", ({ params, body, request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "prepress.manage")) return forbidden();
    const found = byProof(params.proofId);
    if (!found) return notFound();
    const list = annotations.get(found.proof.id) ?? [];
    const parent = list.find((item) => item.id === body.parentId && !item.parentId);
    if (!parent)
      return problem(422, "validation.failed", "ไม่พบความเห็นที่ตอบกลับ", [
        { path: "parentId", code: "exists", message: "ไม่พบความเห็นนี้" },
      ]);
    const reply: Annotation = {
      id: mockId("ann", 9000 + list.length + Math.floor(Math.random() * 900)),
      parentId: parent.id,
      page: parent.page,
      kind: parent.kind,
      geometry: parent.geometry,
      comment: body.comment,
      author: refOf(who),
      authorKind: "staff",
      createdAt: bangkokIso(),
      resolvedAt: null,
      resolvedBy: null,
    };
    annotations.set(found.proof.id, [...list, reply]);
    return reply;
  }),
  mockRequest(
    "POST /v1/admin/prepress/proofs/{proofId}/annotations/{annotationId}/actions/resolve",
    ({ params, request }) => {
      const who = staffPersonaOf(request);
      if (!who || !can(who, "prepress.manage")) return forbidden();
      const found = byProof(params.proofId);
      const item = (annotations.get(params.proofId!) ?? []).find((candidate) => candidate.id === params.annotationId);
      if (!found || !item || item.parentId) return notFound();
      item.resolvedAt = bangkokIso();
      item.resolvedBy = refOf(who);
      refresh(found.detail);
      return item;
    },
  ),
  mockRequest("POST /v1/admin/prepress/{orderId}/drawing-jobs", ({ params, request }) => {
    const found = manage(request, params.orderId, "prepress.draw_dieline");
    if (found instanceof Response) return found;
    // B4.1: until @packio/dieline is deployed server-side, the drawing service answers this.
    return problem(501, "drawing.engine_unavailable", "ระบบวาดแบบกล่องยังไม่พร้อมใช้งาน ส่งแบบจากไฟล์ที่มีอยู่แทน");
  }),
  mockRequest("POST /v1/admin/prepress/{orderId}/actions/send-template", ({ params, body, request }) => {
    const found = manage(request, params.orderId, "prepress.send_template");
    if (found instanceof Response) return found;
    const { detail, who } = found;
    if (!body.fileId && !body.drawingJobId)
      return problem(422, "validation.failed", "แนบไฟล์แบบกล่อง", [
        { path: "fileId", code: "required", message: "แนบไฟล์แบบกล่อง" },
      ]);
    detail.templateDeliveries.unshift({
      id: mockId("dld", 100 + detail.templateDeliveries.length + Math.floor(Math.random() * 900)),
      trigger: "manual",
      sentAt: bangkokIso(),
      sentBy: refOf(who),
      file: uploaded(body.fileId ?? body.drawingJobId!, `${detail.orderCode}-template.pdf`),
    });
    detail.artworkStatus = "awaiting_upload";
    return refresh(detail);
  }),
  mockRequest("POST /v1/admin/prepress/{orderId}/design/actions/deliver-round", ({ params, body, request }) => {
    const found = manage(request, params.orderId, "prepress.deliver_round");
    if (found instanceof Response) return found;
    const service = found.detail.designService!;
    const round = service.rounds.find((item) => item.status === "in_progress");
    if (!round) return conflict("ไม่มีรอบงานออกแบบที่กำลังทำ");
    round.status = "delivered";
    round.deliveredAt = bangkokIso();
    round.files = body.fileIds.map((id, at) => uploaded(id, `design-round-${round.roundNo}-${at + 1}.pdf`));
    round.note = body.note ?? null;
    service.status = "delivered";
    return refresh(found.detail);
  }),
  mockRequest("POST /v1/admin/prepress/{orderId}/design/actions/requote", ({ params, request }) => {
    const found = manage(request, params.orderId, "prepress.requote_design");
    if (found instanceof Response) return found;
    found.detail.designService!.status = "requoted";
    return refresh(found.detail);
  }),
  mockRequest("GET /v1/admin/design-documents/{documentId}", ({ params, request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "prepress.read")) return forbidden();
    const found = documentFor(params.documentId, who.id);
    if (!found) return problem(404, "design.not_found", "ไม่พบแบบนี้");
    return documentResponse("GET /v1/admin/design-documents/{documentId}", found);
  }),
  mockRequest("PUT /v1/admin/design-documents/{documentId}", ({ params, body, request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "prepress.manage")) return forbidden();
    const copy = staffCopies.get(params.documentId);
    if (!copy) {
      return documentFor(params.documentId, who.id)
        ? problem(403, "design.read_only", "แบบของลูกค้าเปิดได้อย่างเดียว ทำสำเนาเพื่อแก้ไข")
        : problem(404, "design.not_found", "ไม่พบแบบนี้");
    }
    if (copy.ownerId !== who.id) return problem(403, "design.read_only", "สำเนานี้เป็นของเจ้าหน้าที่คนอื่น");
    const match = request.headers.get("if-match");
    if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
    if (match !== `"v${copy.view.versionNo}"`)
      return problem(412, "concurrency.stale", "สำเนานี้ถูกบันทึกจากที่อื่นหลังจากที่คุณเปิด");
    copy.view = {
      ...copy.view,
      title: body.title,
      document: body.document,
      schemaVersion: body.document.schemaVersion,
      versionNo: copy.view.versionNo + 1,
      updatedAt: bangkokIso(),
    };
    return documentResponse("PUT /v1/admin/design-documents/{documentId}", { ...copy.view, editable: true });
  }),
  mockRequest("POST /v1/admin/design-documents/{documentId}/actions/copy", ({ params, body, request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "prepress.manage")) return forbidden();
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
