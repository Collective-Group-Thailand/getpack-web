/**
 * CONTRACT-REQUEST partner.today, partner.jobs, partner.job-milestones, partner.job-qc,
 * partner.job-issues, partner.capacity-calendar — the factory's production floor (F5 5.2) over
 * **the commerce mock's own orders and jobs**: what the factory accepts, starts and completes here
 * is what the back office's order screen and production board show.
 *
 * At start, two of the launch factory's in-production jobs are put back to `released` — jobs
 * waiting for acceptance, one due within hours (D-074) — and the second's order is split across
 * two delivery addresses (D-110), so a flow can accept, produce and ship to both.
 *
 * Rules the API states (B4.2): acceptance within its window; milestones in order; quantities
 * out + scrap ≤ in, in ≤ what the previous step put out; photos where the route asks for them; QC
 * recorded before the QC step completes; `clientRef` answers a replay, a different device's
 * report on the same step is a `409` and the server's state stands.
 */

import type { z } from "zod";

import type { jobIssue, partnerJob, partnerJobSummary, partnerToday, qcCheck } from "@/lib/api/requests/partner-jobs";

import { orders, type MockOrder } from "../admin/commerce";
import { inspections } from "../admin/governance";
import { stores } from "../admin/partners";
import { fileDataUrl, files } from "../admin/platform";
import { mockRequest, type MockContext } from "../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import type { RequestKey } from "@/lib/api/requests/registry";

import { own } from "./support";

type Job = MockOrder["jobs"][number];
type JobDto = z.output<typeof partnerJob>;
type Summary = z.output<typeof partnerJobSummary>;
type QcCheck = z.output<typeof qcCheck>;
type Issue = z.output<typeof jobIssue>;
type View = Summary["views"][number];

const DAY = 24 * 60;
const HOUR = 60;
const now = () => bangkokIso();

/** The route every mock job follows (B4.2: editable data per product type in the API). */
export const ROUTE = [
  { key: "step_1", name: "รับงาน", photo: false, qc: false },
  { key: "step_2", name: "เตรียมวัตถุดิบ", photo: false, qc: false },
  { key: "step_3", name: "พิมพ์", photo: true, qc: false },
  { key: "step_4", name: "ไดคัท", photo: true, qc: false },
  { key: "step_5", name: "ตรวจคุณภาพ", photo: false, qc: true },
  { key: "step_6", name: "แพ็ก", photo: true, qc: false },
] as const;

const QC_CHECKLIST = [
  { key: "colour", label: "สีตรงตามปรู๊ฟที่อนุมัติ" },
  { key: "registration", label: "งานพิมพ์ไม่เหลื่อม" },
  { key: "diecut", label: "ไดคัทและรอยพับตรงเส้น" },
  { key: "count", label: "นับจำนวนครบตามใบสั่ง" },
  { key: "clean", label: "ไม่มีรอยเปื้อนหรือเสียหาย" },
];

interface StepExtra {
  startedAt: string | null;
  quantityIn: number | null;
  quantityOut: number | null;
  quantityScrap: number | null;
  photoIds: string[];
  note: string | null;
  reportedBy: { id: string; displayName: string } | null;
  clientRef: string | null;
}

interface Extra {
  steps: Map<number, StepExtra>;
  qcChecks: QcCheck[];
  issues: Issue[];
  history: JobDto["history"];
  rejectedReason: JobDto["rejectedReason"];
  releasedAt: string;
}

const extras = new Map<string, Extra>();

const blankStep = (): StepExtra => ({
  startedAt: null,
  quantityIn: null,
  quantityOut: null,
  quantityScrap: null,
  photoIds: [],
  note: null,
  reportedBy: null,
  clientRef: null,
});

/** The launch factory's production jobs, with the order each belongs to. */
export function factoryJobs(factoryId: string): { order: MockOrder; job: Job }[] {
  return orders.flatMap((order) =>
    order.jobs
      .filter((job) => job.factory?.id === factoryId && job.kind === "production")
      .map((job) => ({ order, job })),
  );
}

export function extraOf(job: Job): Extra {
  let extra = extras.get(job.id);
  if (!extra) {
    extra = {
      steps: new Map(),
      qcChecks: [],
      issues: [],
      history: [],
      rejectedReason: null,
      releasedAt: bangkokIso(-DAY),
    };
    extras.set(job.id, extra);
  }
  return extra;
}

/* ------------------------------------------------------------------------------ seeding */

function seed() {
  const F001 = "00000000-0000-4000-8000-0000000000f1";
  const jobs = factoryJobs(F001);
  // Completed steps of a seeded job carry quantities, so a report on the next step is checked.
  for (const { order, job } of jobs) {
    const extra = extraOf(job);
    // Released (and accepted) a while back, so their advances have been paid (D-022).
    extra.releasedAt = bangkokIso(-DAY * (job.status === "completed" ? 30 : 7));
    let quantity = Math.round(order.quantity * 1.04);
    job.milestones.forEach((milestone) => {
      const step = blankStep();
      if (milestone.status !== "pending") step.startedAt = bangkokIso(-DAY * (7 - milestone.seq));
      if (milestone.status === "completed") {
        const scrap = milestone.seq >= 3 ? Math.round(quantity * 0.01) : 0;
        Object.assign(step, { quantityIn: quantity, quantityScrap: scrap, quantityOut: quantity - scrap });
        quantity -= scrap;
      }
      extra.steps.set(milestone.seq, step);
    });
  }
  // Two jobs wait for acceptance (D-074): one due tomorrow from the calm end of the seeds, and
  // one due within hours whose order is paid up and not held for an inspection — the one a flow
  // can take all the way to delivery, split across two addresses.
  const open = (jobId: string) =>
    inspections.some((item) => item.job.id === jobId && ["planned", "in_progress", "failed"].includes(item.status));
  const paidUp = (order: MockOrder) =>
    !order.instalments.some((item) => item.requiredBefore === "shipping" && item.status !== "paid");
  const calm = jobs.filter(({ order, job }) => job.status === "in_progress" && order.urgency === "normal").at(-1);
  const shippable = jobs.find(({ order, job }) => job.status === "in_progress" && paidUp(order) && !open(job.id));
  [calm, shippable]
    .filter((item): item is NonNullable<typeof item> => !!item)
    .forEach(({ order, job }, index) => {
      Object.assign(job, {
        status: "released",
        acceptDueAt: bangkokIso(index === 0 ? HOUR * 20 : HOUR * 3),
        atRisk: false,
        milestones: [],
      });
      const extra = extraOf(job);
      extra.steps.clear();
      extra.releasedAt = bangkokIso(index === 0 ? -HOUR * 4 : -HOUR * 21);
      extra.history = [{ at: extra.releasedAt, text: "Packio ส่งงานให้โรงงาน", actor: null }];
      if (index === 1 && order.destinations.length === 1) {
        // Split across two addresses (D-110): head office and a branch.
        const [first] = order.destinations;
        const half = Math.floor(first!.quantity / 2);
        order.destinations = [
          { ...first!, quantity: first!.quantity - half },
          {
            ...first!,
            id: mockId("dst", 700),
            recipientName: `${first!.recipientName} (สาขา)`,
            line1: "88 ถนนสาขาตัวอย่าง (ข้อมูลจำลอง)",
            quantity: half,
          },
        ];
      }
    });
}
seed();

/* ------------------------------------------------------------------------------- views */

/** The buy side of an order (the factory's own price, D-042) — never Packio's sell price. */
export const buyAmountOf = (order: MockOrder) => (Math.round(Number(order.netAmount) * 70) / 100).toFixed(2);

/** "กล่องฝาเสียบ (RSC)" — the product type, and the first spec line where it adds something. */
export const titleOf = (order: MockOrder) => {
  const first = order.specs[0]?.value;
  return first && first !== order.productType.name ? `${order.productType.name} ${first}` : order.productType.name;
};

const fileRefOf = (id: string) => {
  const file = files.get(id);
  return {
    id,
    originalName: file?.originalName ?? "photo.jpg",
    mimeType: file?.mimeType ?? "image/jpeg",
    sizeBytes: file?.sizeBytes ?? 0,
    thumbnailUrl: fileDataUrl(id),
    url: fileDataUrl(id),
  };
};

function milestonesOf(job: Job): JobDto["milestones"] {
  const extra = extraOf(job);
  return job.milestones.map((milestone) => {
    const step = extra.steps.get(milestone.seq) ?? blankStep();
    const route = ROUTE[milestone.seq - 1] ?? ROUTE[0];
    return {
      seq: milestone.seq,
      key: milestone.key,
      name: milestone.name,
      status: milestone.status,
      dueAt: milestone.dueAt,
      startedAt: step.startedAt,
      completedAt: milestone.completedAt,
      requiresPhoto: route.photo,
      requiresQc: route.qc,
      quantityIn: step.quantityIn,
      quantityOut: step.quantityOut,
      quantityScrap: step.quantityScrap,
      photos: step.photoIds.map(fileRefOf),
      note: step.note,
      reportedBy: step.reportedBy,
      onTime: milestone.onTime,
    };
  });
}

/** What each destination still needs, against the shipments made for it. */
export type ShippedCounter = (order: MockOrder, destinationId: string) => number;
let shippedOf: ShippedCounter = () => 0;
export const setShippedCounter = (counter: ShippedCounter) => {
  shippedOf = counter;
};

export function destinationsOf(order: MockOrder): JobDto["destinations"] {
  return order.destinations.map((destination) => ({
    id: destination.id,
    recipientName: destination.recipientName,
    phone: destination.phone,
    address: [destination.line1, destination.line2, destination.subdistrict, destination.district]
      .filter(Boolean)
      .join(" "),
    province: destination.province,
    postcode: destination.postcode,
    quantity: destination.quantity,
    shippedQuantity: shippedOf(order, destination.id),
  }));
}

export const jobDone = (job: Job) =>
  job.status === "completed" || (job.milestones.length > 0 && job.milestones.every((m) => m.status === "completed"));

function viewsOf(order: MockOrder, job: Job): View[] {
  const current = job.milestones.find((milestone) => milestone.status !== "completed");
  const late =
    job.atRisk ||
    (job.status === "released" && !!job.acceptDueAt && Date.parse(job.acceptDueAt) < Date.now()) ||
    (!!current?.dueAt && current.status !== "completed" && Date.parse(current.dueAt) < Date.now());
  const remaining = destinationsOf(order).some((destination) => destination.shippedQuantity < destination.quantity);
  const views: View[] = [];
  if (job.status === "released") views.push("to_accept");
  else if (["accepted", "in_progress", "on_hold"].includes(job.status) && !jobDone(job))
    views.push(current && ROUTE[current.seq - 1]?.qc ? "awaiting_qc" : "in_production");
  if (jobDone(job) && remaining) views.push("ready_to_ship");
  if (late && !jobDone(job) && job.status !== "rejected") views.push("late");
  return views;
}

export function summaryOf(order: MockOrder, job: Job): Summary {
  const current = job.milestones.find((milestone) => milestone.status !== "completed") ?? null;
  return {
    id: job.id,
    jobNo: job.jobNo,
    kind: job.kind,
    status: job.status,
    productType: order.productType,
    title: titleOf(order),
    quantity: order.quantity,
    acceptDueAt: job.status === "released" ? job.acceptDueAt : null,
    promisedShipDate: job.promisedShipDate ?? order.promisedShipDate ?? bangkokIso(DAY * 10).slice(0, 10),
    atRisk: job.atRisk,
    riskReason: job.atRisk ? "งานพิมพ์ช้ากว่าแผน" : null,
    current: current
      ? { seq: current.seq, key: current.key, name: current.name, status: current.status, dueAt: current.dueAt }
      : null,
    inspectionRequired: Number(order.grossAmount) >= 100_000,
    views: viewsOf(order, job),
  };
}

function nextActionsOf(order: MockOrder, job: Job): JobDto["nextActions"] {
  if (job.status === "released") return ["accept", "reject"];
  if (["rejected", "cancelled"].includes(job.status)) return [];
  const actions: JobDto["nextActions"] = [];
  const current = job.milestones.find((milestone) => milestone.status !== "completed");
  if (current?.status === "pending") actions.push("start_milestone");
  if (current?.status === "in_progress") {
    if (ROUTE[current.seq - 1]?.qc) actions.push("record_qc");
    actions.push("complete_milestone");
  }
  if (jobDone(job) && destinationsOf(order).some((d) => d.shippedQuantity < d.quantity)) actions.push("ship");
  actions.push("raise_issue");
  return actions;
}

export function detailOf(order: MockOrder, job: Job): JobDto {
  const extra = extraOf(job);
  const proof = order.artwork.proofs.find((item) => item.status === "approved");
  return {
    ...summaryOf(order, job),
    spec: order.specs,
    artwork: proof
      ? { versionNo: proof.versionNo, approvedAt: proof.decidedAt ?? proof.sentAt, proof: proof.file, dieline: null }
      : null,
    purchaseOrder: {
      poNumber: `PO-F-${job.jobNo.slice(2)}`,
      issuedAt: extra.releasedAt,
      buyAmount: buyAmountOf(order),
      currency: "THB",
    },
    tolerance: order.tolerance,
    destinations: destinationsOf(order),
    milestones: milestonesOf(job),
    qcChecklist: QC_CHECKLIST,
    qcChecks: extra.qcChecks,
    inspections: inspections
      .filter((item) => item.job.id === job.id)
      .map((item) => ({
        id: item.id,
        status: item.status,
        reasons: item.reasons.map((reason) =>
          reason === "value_100_pct"
            ? "มูลค่างานสูง ตรวจทุกงาน"
            : reason === "trial_factory"
              ? "งานช่วงทดลองของโรงงาน"
              : reason === "special_finish_or_food"
                ? "งานตกแต่งพิเศษหรือบรรจุภัณฑ์อาหาร"
                : "สุ่มตรวจตามมูลค่างาน",
        ),
        plannedFor: item.scheduledAt ? item.scheduledAt.slice(0, 10) : null,
        resultAt: item.resultAt,
        notes: item.notes,
      })),
    issues: extra.issues,
    history: [...extra.history].sort((a, b) => b.at.localeCompare(a.at)),
    nextActions: nextActionsOf(order, job),
    rejectedReason: extra.rejectedReason,
  };
}

/* ----------------------------------------------------------------------------- helpers */

type Ctx = Pick<MockContext<RequestKey>, "request" | "params">;

function jobFor(context: Ctx, permission?: string) {
  const ok = own(context.request, context.params.factoryId, permission);
  if (ok instanceof Response) return ok;
  const found = factoryJobs(ok.store.factory.id).find(({ job }) => job.id === context.params.jobId);
  // Another factory's job is not found (D-044), exactly like another factory.
  if (!found) return problem(404, "jobs.not_found", "ไม่พบงานนี้");
  return { ...ok, ...found, extra: extraOf(found.job) };
}

const who = (persona: { id: string; displayName: string }) => ({ id: persona.id, displayName: persona.displayName });
const invalid = (path: string, message: string, detail = "ข้อมูลไม่ถูกต้อง") =>
  problem(422, "validation.failed", detail, [{ path, code: "invalid", message }]);
const conflict = (detail: string) => problem(409, "job.conflict", detail);

function photosExist(ids: string[]) {
  return ids.every((id) => files.has(id));
}

function log(extra: Extra, text: string, actor: { id: string; displayName: string } | null) {
  extra.history.push({ at: now(), text, actor });
}

/** Spreads a route's due dates from now to the promised ship date. */
function routeFor(job: Job, order: MockOrder): Job["milestones"] {
  const end = Date.parse(
    `${job.promisedShipDate ?? order.promisedShipDate ?? bangkokIso(DAY * 10).slice(0, 10)}T17:00:00+07:00`,
  );
  const start = Date.now();
  const span = Math.max(end - start, DAY * 60_000);
  return ROUTE.map((step, index) => ({
    seq: index + 1,
    key: step.key,
    name: step.name,
    status: index === 0 ? "completed" : "pending",
    dueAt: bangkokIso(Math.round((span * (index + 1)) / ROUTE.length / 60_000)),
    completedAt: index === 0 ? now() : null,
    onTime: index === 0 ? true : null,
  }));
}

/* -------------------------------------------------------------------------------- handlers */

const perm = {
  read: "factory_jobs.read",
  update: "factory_jobs.update",
  accept: "factory_jobs.accept",
  qc: "factory_qc.record",
};

export const jobRequestHandlers = [
  mockRequest("GET /v1/partner/factories/{factoryId}/today", (context) => {
    const ok = own(context.request, context.params.factoryId, perm.read);
    if (ok instanceof Response) return ok;
    const all = factoryJobs(ok.store.factory.id).filter(({ job }) => !["rejected", "cancelled"].includes(job.status));
    const summaries = all.map(({ order, job }) => summaryOf(order, job));
    const today = bangkokIso().slice(0, 10);
    const dueToday = summaries.filter(
      (item) => item.current?.dueAt?.slice(0, 10) === today || item.acceptDueAt?.slice(0, 10) === today,
    );
    const queue = summaries
      .filter((item) => item.views.some((view) => view !== "ready_to_ship") || item.views.includes("ready_to_ship"))
      .filter((item) => item.views.length > 0)
      .sort((a, b) => {
        const rank = (item: Summary) => (item.views.includes("to_accept") ? 0 : item.views.includes("late") ? 1 : 2);
        const due = (item: Summary) =>
          item.acceptDueAt ?? item.current?.dueAt ?? `${item.promisedShipDate}T23:59:59+07:00`;
        return rank(a) - rank(b) || due(a).localeCompare(due(b));
      })
      .slice(0, 10);
    type Alert = z.output<typeof partnerToday>["alerts"][number];
    const alerts = all.flatMap(({ job }): Alert[] => {
      if (job.status === "released" && job.acceptDueAt) {
        const overdue = Date.parse(job.acceptDueAt) < Date.now();
        const soon = Date.parse(job.acceptDueAt) - Date.now() < 6 * 3_600_000;
        if (overdue || soon)
          return [
            {
              kind: overdue ? ("accept_overdue" as const) : ("accept_due_soon" as const),
              jobId: job.id,
              jobNo: job.jobNo,
              text: overdue ? "เลยเวลารับงานแล้ว Packio อาจย้ายงาน" : "ใกล้หมดเวลารับงาน",
              at: job.acceptDueAt,
            },
          ];
      }
      const inspection = inspections.find((item) => item.job.id === job.id && item.status === "planned");
      return inspection
        ? [
            {
              kind: "inspection_planned" as const,
              jobId: job.id,
              jobNo: job.jobNo,
              text: "Packio นัดตรวจคุณภาพงานนี้",
              at: inspection.scheduledAt,
            },
          ]
        : [];
    });
    return {
      counters: {
        toAccept: summaries.filter((item) => item.views.includes("to_accept")).length,
        dueToday: dueToday.length,
        atRisk: summaries.filter((item) => item.views.includes("late")).length,
        onHold: all.filter(({ job }) => job.status === "on_hold").length,
      },
      queue,
      alerts,
    };
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/jobs", (context) => {
    const ok = own(context.request, context.params.factoryId, perm.read);
    if (ok instanceof Response) return ok;
    const view = context.query.view ?? "all";
    const rows = factoryJobs(ok.store.factory.id)
      .map(({ order, job }) => summaryOf(order, job))
      .filter((item) => view === "all" || item.views.includes(view))
      .filter((item) => matchesQuery(context.query.q, item.jobNo, item.title, item.productType.name))
      .sort((a, b) =>
        (a.acceptDueAt ?? a.current?.dueAt ?? a.promisedShipDate).localeCompare(
          b.acceptDueAt ?? b.current?.dueAt ?? b.promisedShipDate,
        ),
      );
    return paginate(rows, context.query);
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/jobs/lookup", (context) => {
    const ok = own(context.request, context.params.factoryId, perm.read);
    if (ok instanceof Response) return ok;
    const code = context.query.code.trim().toUpperCase();
    const found = factoryJobs(ok.store.factory.id).find(
      ({ job }) =>
        job.jobNo.toUpperCase() === code ||
        code.endsWith(job.jobNo.toUpperCase()) ||
        code.includes(job.id.toUpperCase()),
    );
    return found
      ? { jobId: found.job.id, jobNo: found.job.jobNo }
      : problem(404, "jobs.not_found", "ไม่พบงานของโรงงานจากรหัสนี้");
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/jobs/{jobId}", (context) => {
    const found = jobFor(context, perm.read);
    return found instanceof Response ? found : detailOf(found.order, found.job);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/actions/accept", (context) => {
    const found = jobFor(context, perm.accept);
    if (found instanceof Response) return found;
    const { order, job, extra, who: actor } = found;
    if (job.status !== "released") {
      // The same device asking again is a replay; anything else lost the race.
      return job.status === "accepted" || job.status === "in_progress"
        ? detailOf(order, job)
        : conflict("งานนี้ไม่ได้รอรับแล้ว");
    }
    Object.assign(job, { status: "accepted", milestones: routeFor(job, order) });
    extra.steps = new Map(ROUTE.map((_, index) => [index + 1, blankStep()]));
    Object.assign(extra.steps.get(1)!, { startedAt: now(), reportedBy: who(actor), clientRef: context.body.clientRef });
    const late = job.acceptDueAt && Date.parse(job.acceptDueAt) < Date.now();
    log(extra, late ? "โรงงานรับงาน (เลยเวลารับงาน)" : "โรงงานรับงาน", who(actor));
    return detailOf(order, job);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/actions/reject", (context) => {
    const found = jobFor(context, perm.accept);
    if (found instanceof Response) return found;
    const { order, job, extra, who: actor } = found;
    if (job.status !== "released") return conflict("ปฏิเสธได้เฉพาะงานที่รอรับ");
    job.status = "rejected";
    extra.rejectedReason = context.body.reason;
    log(extra, `โรงงานปฏิเสธงาน${context.body.note ? `: ${context.body.note}` : ""}`, who(actor));
    return detailOf(order, job);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/milestones/{seq}/actions/start", (context) => {
    const found = jobFor(context, perm.update);
    if (found instanceof Response) return found;
    const { order, job, extra, who: actor } = found;
    const seq = Number(context.params.seq);
    const milestone = job.milestones.find((item) => item.seq === seq);
    if (!milestone) return problem(404, "jobs.milestone_not_found", "ไม่พบขั้นตอนนี้");
    const step = extra.steps.get(seq) ?? blankStep();
    if (milestone.status !== "pending") {
      return step.clientRef === context.body.clientRef
        ? detailOf(order, job)
        : conflict("ขั้นตอนนี้มีการอัปเดตจากอุปกรณ์อื่นแล้ว หน้านี้แสดงข้อมูลล่าสุด");
    }
    const previous = job.milestones.find((item) => item.seq === seq - 1);
    if (previous && previous.status !== "completed") return conflict("ต้องจบขั้นตอนก่อนหน้าก่อน");
    milestone.status = "in_progress";
    Object.assign(step, { startedAt: now(), reportedBy: who(actor), clientRef: context.body.clientRef });
    extra.steps.set(seq, step);
    if (job.status === "accepted") job.status = "in_progress";
    log(extra, `เริ่ม${milestone.name}`, who(actor));
    return detailOf(order, job);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/milestones/{seq}/actions/complete", (context) => {
    const found = jobFor(context, perm.update);
    if (found instanceof Response) return found;
    const { order, job, extra, who: actor } = found;
    const seq = Number(context.params.seq);
    const milestone = job.milestones.find((item) => item.seq === seq);
    if (!milestone) return problem(404, "jobs.milestone_not_found", "ไม่พบขั้นตอนนี้");
    const step = extra.steps.get(seq) ?? blankStep();
    if (milestone.status === "completed") {
      return step.clientRef === context.body.clientRef
        ? detailOf(order, job)
        : conflict("ขั้นตอนนี้บันทึกเสร็จจากอุปกรณ์อื่นแล้ว หน้านี้แสดงข้อมูลล่าสุด");
    }
    if (milestone.status !== "in_progress") return conflict("ต้องเริ่มขั้นตอนนี้ก่อน");
    const { quantityIn, quantityOut, quantityScrap, photoFileIds } = context.body;
    const route = ROUTE[seq - 1]!;
    const before = [...extra.steps.entries()]
      .filter(([at]) => at < seq)
      .map(([, value]) => value.quantityOut)
      .filter((value) => value !== null)
      .at(-1);
    const ceiling = before ?? Math.ceil(order.quantity * (1 + Number(order.tolerance.overagePct) / 100) * 1.1);
    const errors: { path: string; code: string; message: string }[] = [];
    if (quantityOut + quantityScrap > quantityIn)
      errors.push({ path: "quantityOut", code: "max", message: "จำนวนดีรวมของเสียต้องไม่เกินจำนวนที่รับเข้า" });
    if (quantityIn > ceiling)
      errors.push({
        path: "quantityIn",
        code: "max",
        message: `รับเข้าได้ไม่เกิน ${ceiling.toLocaleString("th-TH")} ชิ้น`,
      });
    if (route.photo && photoFileIds.length === 0)
      errors.push({ path: "photoFileIds", code: "required", message: "ขั้นตอนนี้ต้องแนบรูปถ่ายอย่างน้อยหนึ่งรูป" });
    if (!photosExist(photoFileIds)) errors.push({ path: "photoFileIds", code: "ref", message: "ไม่พบไฟล์รูป" });
    if (errors.length) return problem(422, "validation.failed", "ตรวจจำนวนและรูปอีกครั้ง", errors);
    if (route.qc && !extra.qcChecks.some((check) => check.result !== "fail"))
      return problem(409, "jobs.qc_required", "บันทึกผลตรวจคุณภาพที่ผ่านก่อนจบขั้นตอนนี้");
    Object.assign(step, {
      quantityIn,
      quantityOut,
      quantityScrap,
      photoIds: photoFileIds,
      note: context.body.note ?? null,
      reportedBy: who(actor),
      clientRef: context.body.clientRef,
    });
    extra.steps.set(seq, step);
    Object.assign(milestone, {
      status: "completed",
      completedAt: now(),
      onTime: !milestone.dueAt || Date.parse(milestone.dueAt) >= Date.now(),
    });
    log(
      extra,
      `จบ${milestone.name}: ดี ${quantityOut.toLocaleString("th-TH")} เสีย ${quantityScrap.toLocaleString("th-TH")}`,
      who(actor),
    );
    if (job.milestones.every((item) => item.status === "completed")) {
      job.status = "completed";
      job.atRisk = false;
      log(extra, "ผลิตเสร็จ พร้อมส่ง", who(actor));
    }
    return detailOf(order, job);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/qc-checks", (context) => {
    const found = jobFor(context, perm.qc);
    if (found instanceof Response) return found;
    const { order, job, extra, who: actor } = found;
    const current = job.milestones.find((item) => item.status !== "completed");
    if (!current || !ROUTE[current.seq - 1]?.qc || current.status !== "in_progress")
      return conflict("บันทึกผลตรวจได้ระหว่างขั้นตอนตรวจคุณภาพ");
    if (extra.qcChecks.some((check) => check.id === mockId("qcc", hash(context.body.clientRef))))
      return detailOf(order, job);
    if (!photosExist(context.body.photoFileIds)) return invalid("photoFileIds", "ไม่พบไฟล์รูป");
    const labels = new Map(QC_CHECKLIST.map((item) => [item.key, item.label]));
    extra.qcChecks.push({
      id: mockId("qcc", hash(context.body.clientRef)),
      result: context.body.result,
      isFirstPass: extra.qcChecks.length === 0 && context.body.result === "pass",
      checklist: context.body.checklist.map((item) => ({
        key: item.key,
        label: labels.get(item.key) ?? item.key,
        pass: item.pass,
        note: item.note ?? null,
      })),
      defects: context.body.defects,
      photos: context.body.photoFileIds.map(fileRefOf),
      notes: context.body.notes ?? null,
      performedBy: who(actor),
      performedAt: now(),
    });
    log(
      extra,
      `บันทึกผลตรวจคุณภาพ: ${context.body.result === "pass" ? "ผ่าน" : context.body.result === "fail" ? "ไม่ผ่าน" : "ผ่านแบบมีเงื่อนไข"}`,
      who(actor),
    );
    return detailOf(order, job);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/issues", (context) => {
    const found = jobFor(context, perm.read);
    if (found instanceof Response) return found;
    const { order, job, extra, who: actor } = found;
    const id = mockId("iss", hash(context.body.clientRef));
    if (!extra.issues.some((issue) => issue.id === id)) {
      extra.issues.unshift({
        id,
        kind: context.body.kind,
        description: context.body.description,
        status: "open",
        photos: (context.body.photoFileIds ?? []).map(fileRefOf),
        raisedBy: who(actor),
        raisedAt: now(),
        resolvedAt: null,
      });
      log(extra, `แจ้งปัญหา: ${context.body.description}`, who(actor));
    }
    return detailOf(order, job);
  }),

  mockRequest("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/issues/{issueId}/actions/resolve", (context) => {
    const found = jobFor(context, perm.read);
    if (found instanceof Response) return found;
    const { order, job, extra, who: actor } = found;
    const issue = extra.issues.find((item) => item.id === context.params.issueId);
    if (!issue) return problem(404, "jobs.issue_not_found", "ไม่พบปัญหานี้");
    if (issue.status === "open") {
      Object.assign(issue, { status: "resolved", resolvedAt: now() });
      log(extra, `แก้ปัญหาแล้ว${context.body.note ? `: ${context.body.note}` : ""}`, who(actor));
    }
    return detailOf(order, job);
  }),

  mockRequest("GET /v1/partner/factories/{factoryId}/capacity-calendar", (context) => {
    const ok = own(context.request, context.params.factoryId, perm.read);
    if (ok instanceof Response) return ok;
    const weeks = context.query.weeks ?? 6;
    const monday = new Date(Date.now() + 7 * 3_600_000);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const store = stores.get(ok.store.factory.id)!;
    return {
      weeks: Array.from({ length: weeks }, (_, index) => {
        const weekStart = new Date(monday.getTime() + index * 7 * 86_400_000).toISOString().slice(0, 10);
        return {
          weekStart,
          types: store.config.capacities
            .filter((capacity) => capacity.current)
            .map((capacity) => {
              const cap = Number(capacity.current!.weeklyCapacity);
              const override = store.overrides.get(`${capacity.productTypeId}:${weekStart}`);
              const total = override ?? cap;
              const booked = Math.round(total * Math.max(0, 0.9 - index * 0.15));
              return {
                productTypeId: capacity.productTypeId,
                productType: { code: capacity.productTypeCode, name: capacity.productTypeCode },
                unit: capacity.current!.capacityUnit,
                capacity: total.toFixed(3),
                booked: booked.toFixed(3),
                free: (total - booked).toFixed(3),
              };
            }),
        };
      }),
      closures: [
        {
          date: bangkokIso(DAY * 9).slice(0, 10),
          name: "วันหยุดประจำปีของโรงงาน (ข้อมูลจำลอง)",
          kind: "factory" as const,
        },
        { date: bangkokIso(DAY * 16).slice(0, 10), name: "วันหยุดนักขัตฤกษ์ (ข้อมูลจำลอง)", kind: "national" as const },
      ],
    };
  }),
];

/** A stable small number from a client reference, for deterministic ids of replayed reports. */
function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) % 0xffffff;
  return result;
}

export { QC_CHECKLIST };
