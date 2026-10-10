/**
 * Packio Factory ERP E2.1 + E3 (packio-api v0.46.0; D-346 – D-358) for `pnpm dev:mock` and the e2e: alerts,
 * machines and the kiosk's dispatch list, the machine schedule, maintenance (breakdowns, preventive plans,
 * spare parts) and documents (folders, versions, expiry). It reads E2's production orders for the floor and
 * keeps the rest per factory. Requests for quotation list empty here; their flow lives in the API's e2e.
 * A mock is a fake engine and does its sums in numbers; the screens never do. All data obviously fake.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { mockId, paginate, problem } from "../support";
import { pageQuery } from "./billing";
import { erpMock } from "./erp";
import { erpE2Mock } from "./erp-e2";
import { permissionsOf } from "./personas";
import type { Own } from "./support";

type Alert = Schemas["ErpAlertDto"];
type Machine = {
  id: string;
  name: string;
  details: string | null;
  maxWidthMm: number | null;
  maxLengthMm: number | null;
  status: "active" | "inactive";
};
type Mt = Omit<Schemas["ErpMaintenanceOrderDto"], "nextActions">;
type Plan = Omit<Schemas["ErpMaintenancePlanDto"], "due" | "daysLeft" | "impressionsLeft" | "openOrder">;
type Folder = Omit<Schemas["ErpDocFolderDto"], "docCount">;
type Doc = Omit<Schemas["ErpDocDto"], "expiry">;

interface E3 {
  alerts: Alert[];
  machines: Machine[];
  mts: Mt[];
  plans: Plan[];
  folders: Folder[];
  docs: Doc[];
  seq: number;
}

const { BASE, scope, number, body, notFound, invalid, now, today } = erpMock;
const states = new Map<string, E3>();
const DAY = 86_400_000;
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

function seed(factoryId: string): E3 {
  const machines: Machine[] = erpE2Mock.machines().map((m, i) => ({
    id: m.id,
    name: m.name,
    details: i === 0 ? "ออฟเซ็ต 4 สี (จำลอง)" : null,
    maxWidthMm: i === 0 ? 520 : 760,
    maxLengthMm: i === 0 ? 740 : 1060,
    status: "active",
  }));
  const plans: Plan[] = machines.map((m, i) => ({
    id: mockId("emp", i + 1),
    machine: { id: m.id, name: m.name },
    title: i === 0 ? "ล้างระบบหมึก + อัดจารบี (จำลอง)" : "เปลี่ยนยางรองมีด (จำลอง)",
    instructions: null,
    everyDays: i === 0 ? 30 : null,
    everyImpressions: i === 0 ? null : 200_000,
    durationMinutes: 120,
    lastDoneAt: `${addDays(today(), i === 0 ? -28 : -10)}T09:00:00+07:00`,
    parts: [],
    status: "active",
    version: 1,
  }));
  const folders: Folder[] = [{ id: mockId("edf", 1), name: "ใบรับรอง", parentId: null }];
  const docs: Doc[] = [
    {
      id: mockId("edc", 1),
      title: "ใบรับรอง FSC (จำลอง)",
      category: "certificate",
      folder: { ...folders[0]!, docCount: 1 },
      link: null,
      tags: ["FSC"],
      expiresOn: addDays(today(), 20),
      remindDays: 30,
      note: null,
      status: "active",
      currentVersion: 1,
      file: { id: mockId("fil", 901), name: "fsc.pdf", mimeType: "application/pdf", sizeBytes: 120_000 },
      versions: [
        {
          id: mockId("edv", 1),
          version: 1,
          file: { id: mockId("fil", 901), name: "fsc.pdf", mimeType: "application/pdf", sizeBytes: 120_000 },
          note: null,
          by: "เจ้าของโรงงาน (จำลอง)",
          createdAt: now(),
        },
      ],
      updatedAt: now(),
      version: 1,
    },
  ];
  const alerts: Alert[] = [
    {
      id: mockId("eal", 1),
      kind: "document_expiring",
      status: "open",
      subjectType: "erp_doc",
      subjectId: docs[0]!.id,
      dueOn: docs[0]!.expiresOn,
      payload: { title: docs[0]!.title, expiresOn: docs[0]!.expiresOn },
      createdAt: now(),
      acknowledgedAt: null,
      acknowledgedBy: null,
    },
  ];
  void factoryId;
  return { alerts, machines, mts: [], plans, folders, docs, seq: 0 };
}

const e3Of = (factoryId: string): E3 => {
  let s = states.get(factoryId);
  if (!s) {
    s = seed(factoryId);
    states.set(factoryId, s);
  }
  return s;
};
const ctx = (request: Request, factoryId: unknown, permission?: string) => {
  const ok = scope(request, factoryId, permission);
  if (ok instanceof Response) return ok;
  return { ...ok, e3: e3Of(String(factoryId)), factoryId: String(factoryId) };
};
type Ctx = Exclude<ReturnType<typeof ctx>, Response>;
const actionsOf = (who: Own["who"], rules: [string, string, boolean][]) => {
  const perms = permissionsOf(who);
  return rules
    .filter(([, permission, when]) => when && perms.includes(permission))
    .map(([key]) => ({ key, irreversible: false, disabledReason: null }));
};
const etagged = <T extends { id: string; version: number }>(b: T, status = 200) =>
  HttpResponse.json(b, { status, headers: { ETag: `"${b.id}:${b.version}"` } });

// ------------------------------------------------------------------------------------- machines
const operationsOf = (ok: Ctx) =>
  erpE2Mock
    .e2Of(ok.factoryId)
    .mos.filter((m) => erpE2Mock.running(m.status))
    .flatMap((m) => m.operations.map((operation) => ({ operation, order: erpE2Mock.moSummary(m) })));

const openMt = (e3: E3, machineId: string) =>
  e3.mts.find((m) => m.machine.id === machineId && ["open", "scheduled", "in_progress"].includes(m.status));

function planView(e3: E3, p: Plan): Schemas["ErpMaintenancePlanDto"] {
  const daysLeft =
    p.everyDays !== null
      ? p.everyDays - Math.floor((Date.parse(today()) - Date.parse((p.lastDoneAt ?? now()).slice(0, 10))) / DAY)
      : null;
  const impressionsLeft = p.everyImpressions !== null ? p.everyImpressions - 182_000 : null;
  const open = e3.mts.find((m) => m.plan?.id === p.id && ["open", "scheduled", "in_progress"].includes(m.status));
  return {
    ...p,
    daysLeft,
    impressionsLeft,
    due:
      (daysLeft !== null && daysLeft <= 3) ||
      (impressionsLeft !== null && impressionsLeft <= (p.everyImpressions ?? 0) / 10),
    openOrder: open ? mtRef(open) : null,
  };
}

const mtRef = (m: Mt): Schemas["ErpMaintenanceRefDto"] => ({
  id: m.id,
  mtNo: m.mtNo,
  title: m.title,
  status: m.status,
  priority: m.priority,
});

function machineView(ok: Ctx, m: Machine): Schemas["ErpMachineDto"] {
  const ops = operationsOf(ok).filter((x) => x.operation.machine?.id === m.id);
  const running = ops.find((x) => x.operation.status === "in_progress") ?? null;
  const open = openMt(ok.e3, m.id);
  const down = open && (open.kind === "breakdown" || open.status === "in_progress");
  return {
    ...m,
    impressions30d: "182000",
    state: down ? (open.status === "in_progress" ? "maintenance" : "down") : running ? "running" : "idle",
    running,
    queued: ops.filter((x) => x.operation.status === "pending" || x.operation.status === "paused").length,
    openMaintenance: open ? mtRef(open) : null,
    plans: ok.e3.plans
      .filter((p) => p.machine.id === m.id && p.status === "active")
      .map((p) => {
        const v = planView(ok.e3, p);
        return { planId: p.id, title: p.title, due: v.due, daysLeft: v.daysLeft, impressionsLeft: v.impressionsLeft };
      }),
  };
}

// ---------------------------------------------------------------------------------- maintenance
function mtView(ok: Ctx, m: Mt): Schemas["ErpMaintenanceOrderDto"] {
  const live = ["open", "scheduled", "in_progress"].includes(m.status);
  return {
    ...m,
    nextActions: actionsOf(ok.who, [
      ["erp_mt.schedule", "factory_maintenance.manage", m.status === "open" || m.status === "scheduled"],
      ["erp_mt.start", "factory_maintenance.manage", m.status === "open" || m.status === "scheduled"],
      ["erp_mt.parts", "factory_maintenance.manage", live],
      ["erp_mt.finish", "factory_maintenance.manage", m.status === "in_progress"],
      ["erp_mt.cancel", "factory_maintenance.manage", m.status === "open" || m.status === "scheduled"],
    ]),
  };
}
const mtSummary = (m: Mt): Schemas["ErpMaintenanceOrderSummaryDto"] => ({
  id: m.id,
  mtNo: m.mtNo,
  kind: m.kind,
  machine: m.machine,
  title: m.title,
  priority: m.priority,
  status: m.status,
  reportedAt: m.reportedAt,
  reportedBy: m.reportedBy,
  scheduledStart: m.scheduledStart,
  scheduledEnd: m.scheduledEnd,
  downtimeMinutes: m.downtimeMinutes,
});

function newMt(
  ok: Ctx,
  input: {
    machine: Machine;
    title: string;
    kind: Mt["kind"];
    priority: Mt["priority"];
    description?: string | null;
    plan?: Plan;
    photos?: string[];
  },
): Mt {
  ok.e3.seq += 1;
  const mt: Mt = {
    id: mockId("emt", ok.e3.seq),
    mtNo: number(ok.erp, "MT"),
    kind: input.kind,
    machine: { id: input.machine.id, name: input.machine.name },
    title: input.title,
    description: input.description ?? null,
    instructions: input.plan?.instructions ?? null,
    priority: input.priority,
    status: "open",
    reportedAt: now(),
    reportedBy: "ผู้ใช้จำลอง",
    scheduledStart: null,
    scheduledEnd: null,
    startedAt: null,
    finishedAt: null,
    downtimeMinutes: null,
    resolution: null,
    cancelReason: null,
    plan: input.plan ? { id: input.plan.id, code: input.plan.title, name: input.plan.title } : null,
    plannedParts: input.plan?.parts ?? [],
    parts: [],
    partsValue: "0.00",
    photos: (input.photos ?? []).map((fileId, i) => ({ fileId, name: `photo-${i + 1}.jpg`, mimeType: "image/jpeg" })),
    version: 1,
  };
  ok.e3.mts.unshift(mt);
  if (input.kind === "breakdown")
    ok.e3.alerts.unshift({
      id: mockId("eal", 100 + ok.e3.seq),
      kind: "machine_breakdown",
      status: "open",
      subjectType: "erp_maintenance_order",
      subjectId: mt.id,
      dueOn: null,
      payload: { machine: input.machine.name, mtNo: mt.mtNo, title: mt.title },
      createdAt: now(),
      acknowledgedAt: null,
      acknowledgedBy: null,
    });
  return mt;
}

// ------------------------------------------------------------------------------------ documents
function expiryOf(d: Pick<Doc, "expiresOn" | "remindDays">): Schemas["ErpDocExpiry"] {
  if (!d.expiresOn) return "none";
  if (d.expiresOn < today()) return "expired";
  return d.expiresOn <= addDays(today(), d.remindDays) ? "expiring" : "valid";
}
const folderView = (e3: E3, f: Folder): Schemas["ErpDocFolderDto"] => ({
  ...f,
  docCount: e3.docs.filter((d) => d.folder?.id === f.id && d.status === "active").length,
});
const docView = (d: Doc): Schemas["ErpDocDto"] => ({ ...d, expiry: expiryOf(d) });
function linkOf(ok: Ctx, type: Schemas["ErpDocLink"] | null | undefined, id: string | null | undefined) {
  if (!type || !id) return null;
  const label =
    type === "machine"
      ? ok.e3.machines.find((m) => m.id === id)?.name
      : type === "item"
        ? ok.erp.items.find((i) => i.id === id)?.name
        : type === "trading_partner"
          ? ok.erp.partners.find((p) => p.id === id)?.name
          : type === "maintenance_order"
            ? ok.e3.mts.find((m) => m.id === id)?.mtNo
            : id.slice(-6);
  return label ? { type, id, label } : undefined;
}

// ------------------------------------------------------------------------------------- schedule
function board(ok: Ctx, from: string, days: number): Schemas["ErpScheduleDto"] {
  const to = addDays(from, days);
  const hours: Record<string, { from: string; to: string } | null> = {};
  for (let i = 0; i < days; i += 1) {
    const day = addDays(from, i);
    hours[day] = new Date(`${day}T00:00:00Z`).getUTCDay() === 0 ? null : { from: "08:00", to: "17:00" };
  }
  const slotOf = ({ operation, order }: ReturnType<typeof operationsOf>[number]): Schemas["ErpScheduleSlotDto"] => ({
    operationId: operation.id,
    seq: operation.seq,
    name: operation.name,
    status: operation.status,
    plannedMinutes: operation.plannedMinutes,
    locked: operation.locked,
    start: operation.scheduledStart!,
    end: operation.scheduledEnd!,
    late: !!order.dueOn && operation.scheduledEnd!.slice(0, 10) > order.dueOn,
    order: {
      id: order.id,
      moNo: order.moNo,
      title: order.title,
      dueOn: order.dueOn,
      priority: order.priority,
      status: order.status,
    },
  });
  const ops = operationsOf(ok).filter((x) => x.operation.status !== "done" && x.operation.status !== "skipped");
  const placed = ops.filter((x) => x.operation.scheduledStart && x.operation.scheduledEnd);
  const inWindow = (x: (typeof placed)[number]) =>
    x.operation.scheduledEnd!.slice(0, 10) >= from && x.operation.scheduledStart!.slice(0, 10) < to;
  return {
    from,
    to,
    hours,
    unscheduled: ops.length - placed.length,
    unassigned: placed.filter((x) => !x.operation.machine && inWindow(x)).map(slotOf),
    machines: ok.e3.machines
      .filter((m) => m.status === "active")
      .map((m) => {
        const mine = placed.filter((x) => x.operation.machine?.id === m.id);
        return {
          machine: { id: m.id, name: m.name },
          state: machineView(ok, m).state,
          loadMinutes: mine.reduce((a, x) => a + x.operation.plannedMinutes, 0),
          slots: mine.filter(inWindow).map(slotOf),
          blocks: ok.e3.mts
            .filter((t) => t.machine.id === m.id && t.scheduledStart && t.scheduledEnd && t.status !== "cancelled")
            .map((t) => ({
              start: t.scheduledStart!,
              end: t.scheduledEnd!,
              kind: t.kind,
              maintenanceOrder: { id: t.id, code: t.mtNo, name: t.title },
            })),
        };
      }),
  };
}

/** Next working minute from `at` (08:00–17:00, Monday–Saturday, Bangkok), and `minutes` on from there. */
function placeAt(at: number, minutes: number): [number, number] {
  const bkk = (ms: number) => new Date(ms + 7 * 3_600_000);
  let start = at;
  const fit = () => {
    const d = bkk(start);
    if (d.getUTCDay() === 0 || d.getUTCHours() >= 17) {
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 8 - 7));
      start = next.getTime();
      return true;
    }
    if (d.getUTCHours() < 8) {
      start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8 - 7);
      return true;
    }
    return false;
  };
  while (fit());
  return [start, start + minutes * 60_000];
}
const iso = (ms: number) => `${new Date(ms + 7 * 3_600_000).toISOString().slice(0, 19)}+07:00`;

export const erpE3Handlers = [
  // --------------------------------------------------------------------------------- alerts
  http.get(`${BASE}/alerts`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_profile.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const rows = ok.e3.alerts.filter((a) => !status || status === "all" || a.status === status);
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  http.get(`${BASE}/alerts/count`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_profile.read");
    if (ok instanceof Response) return ok;
    const open = ok.e3.alerts.filter((a) => a.status === "open");
    const byKind: Record<string, number> = {};
    for (const a of open) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
    return HttpResponse.json({ open: open.length, byKind } satisfies Schemas["ErpAlertCountDto"]);
  }),
  http.post(`${BASE}/alerts/:alertId/actions/acknowledge`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_profile.read");
    if (ok instanceof Response) return ok;
    const alert = ok.e3.alerts.find((a) => a.id === params.alertId);
    if (!alert) return notFound();
    Object.assign(alert, { status: "acknowledged", acknowledgedAt: now(), acknowledgedBy: "ผู้ใช้จำลอง" });
    return HttpResponse.json(alert);
  }),
  http.post(`${BASE}/alerts/actions/acknowledge-all`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_profile.read");
    if (ok instanceof Response) return ok;
    for (const a of ok.e3.alerts.filter((x) => x.status === "open"))
      Object.assign(a, { status: "acknowledged", acknowledgedAt: now(), acknowledgedBy: "ผู้ใช้จำลอง" });
    return HttpResponse.json({ open: 0, byKind: {} } satisfies Schemas["ErpAlertCountDto"]);
  }),

  // ----------------------------------------------------------------------------------- rfqs
  http.get(`${BASE}/rfqs`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_procurement.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json(paginate([] as Schemas["ErpRfqSummaryDto"][], pageQuery(new URL(request.url))));
  }),

  // ------------------------------------------------------------------------------- machines
  http.get(`${BASE}/machines`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json(ok.e3.machines.map((m) => machineView(ok, m)));
  }),
  http.post(`${BASE}/machines`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_erp.configure");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["CreateMachineDto"]>(request);
    if (!b.name?.trim()) return invalid("name", "ใส่ชื่อเครื่อง");
    ok.e3.seq += 1;
    const m: Machine = {
      id: mockId("emc", 100 + ok.e3.seq),
      name: b.name.trim(),
      details: b.details ?? null,
      maxWidthMm: b.maxWidthMm ?? null,
      maxLengthMm: b.maxLengthMm ?? null,
      status: b.status ?? "active",
    };
    ok.e3.machines.push(m);
    return HttpResponse.json(machineView(ok, m), { status: 201 });
  }),
  http.get(`${BASE}/machines/:machineId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    const m = ok.e3.machines.find((x) => x.id === params.machineId);
    return m ? HttpResponse.json(machineView(ok, m)) : notFound();
  }),
  http.patch(`${BASE}/machines/:machineId`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_erp.configure");
    if (ok instanceof Response) return ok;
    const m = ok.e3.machines.find((x) => x.id === params.machineId);
    if (!m) return notFound();
    const b = await body<Schemas["UpdateMachineDto"]>(request);
    Object.assign(m, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)));
    return HttpResponse.json(machineView(ok, m));
  }),
  http.get(`${BASE}/machines/:machineId/dispatch`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    const m = ok.e3.machines.find((x) => x.id === params.machineId);
    if (!m) return notFound();
    const mine = operationsOf(ok).filter((x) => x.operation.machine?.id === m.id);
    const current =
      mine.find((x) => x.operation.status === "in_progress") ??
      mine.find((x) => x.operation.status === "paused") ??
      null;
    const next = mine
      .filter((x) => x !== current && (x.operation.status === "pending" || x.operation.status === "paused"))
      .sort((a, b) => (a.operation.scheduledStart ?? "9").localeCompare(b.operation.scheduledStart ?? "9"));
    return HttpResponse.json({ machine: machineView(ok, m), current, next } satisfies Schemas["ErpDispatchDto"]);
  }),

  // ------------------------------------------------------------------------------- schedule
  http.get(`${BASE}/schedule`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? today();
    const days = Math.min(14, Math.max(1, Number(url.searchParams.get("days") ?? 3)));
    return HttpResponse.json(board(ok, from, days));
  }),
  http.post(`${BASE}/schedule/actions/auto-plan`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.manage");
    if (ok instanceof Response) return ok;
    const cursor = new Map<string, number>();
    let placed = 0;
    let kept = 0;
    const late: Schemas["ErpLateOrderDto"][] = [];
    for (const { operation, order } of operationsOf(ok).sort((a, b) => a.order.priority - b.order.priority)) {
      if (operation.status === "done" || operation.status === "skipped") continue;
      if (operation.locked && operation.scheduledStart) {
        kept += 1;
        continue;
      }
      const lane = operation.machine?.id ?? "none";
      const [start, end] = placeAt(cursor.get(lane) ?? Date.now(), operation.plannedMinutes || 30);
      cursor.set(lane, end);
      operation.scheduledStart = iso(start);
      operation.scheduledEnd = iso(end);
      placed += 1;
      if (order.dueOn && iso(end).slice(0, 10) > order.dueOn)
        late.push({
          finishesAt: iso(end),
          order: {
            id: order.id,
            moNo: order.moNo,
            title: order.title,
            dueOn: order.dueOn,
            priority: order.priority,
            status: order.status,
          },
        });
    }
    return HttpResponse.json({ placed, kept, late } satisfies Schemas["ErpAutoPlanResultDto"]);
  }),
  http.put(`${BASE}/production-orders/:moId/operations/:operationId/schedule`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.manage");
    if (ok instanceof Response) return ok;
    const found = operationsOf(ok).find((x) => x.operation.id === params.operationId && x.order.id === params.moId);
    if (!found) return notFound();
    const b = await body<Schemas["ErpMoveOperationDto"]>(request);
    const op = found.operation;
    if (b.plannedMinutes) op.plannedMinutes = b.plannedMinutes;
    if (b.machineId !== undefined) {
      const m = ok.e3.machines.find((x) => x.id === b.machineId);
      op.machine = m ? { id: m.id, name: m.name } : null;
    }
    const start = Date.parse(b.start ?? "");
    if (Number.isNaN(start)) return invalid("start", "เวลาไม่ถูกต้อง");
    op.scheduledStart = iso(start);
    op.scheduledEnd = iso(start + op.plannedMinutes * 60_000);
    op.locked = b.locked ?? true;
    return HttpResponse.json(
      board(ok, op.scheduledStart.slice(0, 10), 1)
        .machines.flatMap((m) => m.slots)
        .find((s) => s.operationId === op.id) ?? null,
    );
  }),
  http.post(`${BASE}/production-orders/:moId/operations/:operationId/actions/lock`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.manage");
    if (ok instanceof Response) return ok;
    const found = operationsOf(ok).find((x) => x.operation.id === params.operationId);
    if (!found) return notFound();
    const b = await body<{ locked?: boolean }>(request);
    found.operation.locked = b.locked ?? !found.operation.locked;
    return HttpResponse.json(null);
  }),
  http.get(`${BASE}/production-orders/:moId/operations/:operationId/events`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_planning.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json([] as Schemas["ErpOperationEventDto"][]);
  }),

  // ---------------------------------------------------------------------------- maintenance
  http.get(`${BASE}/maintenance/orders`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_maintenance.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const machineId = url.searchParams.get("machineId");
    const q = url.searchParams.get("q")?.toLowerCase();
    const rows = ok.e3.mts.filter(
      (m) =>
        (!status ||
          (status === "open_all" ? ["open", "scheduled", "in_progress"].includes(m.status) : m.status === status)) &&
        (!machineId || m.machine.id === machineId) &&
        (!q || `${m.mtNo} ${m.title} ${m.machine.name}`.toLowerCase().includes(q)),
    );
    return HttpResponse.json(paginate(rows.map(mtSummary), pageQuery(url)));
  }),
  http.post(`${BASE}/maintenance/orders/breakdowns`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_maintenance.report");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpReportBreakdownDto"]>(request);
    const machine = ok.e3.machines.find((m) => m.id === b.machineId);
    if (!machine) return notFound();
    if (!b.title || b.title.trim().length < 3) return invalid("title", "อย่างน้อย 3 ตัวอักษร");
    const mt = newMt(ok, {
      machine,
      title: b.title.trim(),
      kind: "breakdown",
      priority: b.priority ?? "high",
      description: b.description ?? null,
      photos: b.photoFileIds ?? [],
    });
    return etagged(mtView(ok, mt), 201);
  }),
  http.get(`${BASE}/maintenance/orders/:mtId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_maintenance.read");
    if (ok instanceof Response) return ok;
    const mt = ok.e3.mts.find((m) => m.id === params.mtId);
    return mt ? etagged(mtView(ok, mt)) : notFound();
  }),
  ...(["schedule", "start", "parts", "finish", "cancel"] as const).map((action) =>
    http.post(`${BASE}/maintenance/orders/:mtId/actions/${action}`, async ({ request, params }) => {
      const ok = ctx(request, params.factoryId, "factory_maintenance.manage");
      if (ok instanceof Response) return ok;
      const mt = ok.e3.mts.find((m) => m.id === params.mtId);
      if (!mt) return notFound();
      const offered = mtView(ok, mt).nextActions.some((a) => a.key === `erp_mt.${action}`);
      if (!offered) return problem(409, "erp.invalid_status", `อยู่ในสถานะ ${mt.status}`);
      const b = await body<Record<string, unknown>>(request);
      if (action === "schedule") {
        const s = b as Schemas["ErpScheduleMaintenanceDto"];
        if (!s.start || !s.end || Date.parse(s.end) <= Date.parse(s.start))
          return invalid("end", "เวลาสิ้นสุดต้องหลังเวลาเริ่ม");
        Object.assign(mt, { scheduledStart: s.start, scheduledEnd: s.end, status: "scheduled" });
      } else if (action === "start") {
        Object.assign(mt, { startedAt: now(), status: "in_progress" });
      } else if (action === "parts") {
        const p = b as Schemas["ErpMaintenancePartsDto"];
        const warehouse = ok.erp.warehouses.find((w) => w.id === p.warehouseId) ?? ok.erp.warehouses[0]!;
        for (const line of p.lines ?? []) {
          const item = ok.erp.items.find((i) => i.id === line.itemId);
          if (!item) return notFound();
          const unitCost = Number(item.lastPurchasePrice ?? 0);
          const value = (unitCost * Number(line.quantity)).toFixed(2);
          mt.parts.push({
            id: mockId("emq", mt.parts.length + 1 + ok.e3.seq * 10),
            item: { id: item.id, sku: item.sku, name: item.name, kind: item.kind, baseUnit: item.baseUnit },
            quantity: Number(line.quantity).toFixed(3),
            unitCost: unitCost.toFixed(6),
            value,
            warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name },
            at: now(),
            by: "ผู้ใช้จำลอง",
          });
        }
        mt.partsValue = mt.parts.reduce((a, x) => a + Number(x.value), 0).toFixed(2);
      } else if (action === "finish") {
        const f = b as Schemas["ErpFinishMaintenanceDto"];
        if (!f.resolution || f.resolution.trim().length < 3) return invalid("resolution", "อย่างน้อย 3 ตัวอักษร");
        const minutes = f.downtimeMinutes ?? Math.round((Date.now() - Date.parse(mt.startedAt ?? now())) / 60_000);
        Object.assign(mt, {
          finishedAt: now(),
          status: "done",
          resolution: f.resolution.trim(),
          downtimeMinutes: minutes,
        });
        const plan = ok.e3.plans.find((p) => p.id === mt.plan?.id);
        if (plan) plan.lastDoneAt = now();
        for (const a of ok.e3.alerts.filter((x) => x.subjectId === mt.id && x.status === "open"))
          Object.assign(a, { status: "acknowledged", acknowledgedAt: now(), acknowledgedBy: "ระบบ" });
      } else {
        const reason = String(b.reason ?? "").trim();
        if (reason.length < 3) return invalid("reason", "อย่างน้อย 3 ตัวอักษร");
        Object.assign(mt, { status: "cancelled", cancelReason: reason });
      }
      mt.version += 1;
      return etagged(mtView(ok, mt));
    }),
  ),
  http.get(`${BASE}/maintenance/plans`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_maintenance.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json(ok.e3.plans.map((p) => planView(ok.e3, p)));
  }),
  http.post(`${BASE}/maintenance/plans`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_maintenance.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpSaveMaintenancePlanDto"]>(request);
    const machine = ok.e3.machines.find((m) => m.id === b.machineId);
    if (!machine) return notFound();
    if (!b.everyDays && !b.everyImpressions) return invalid("everyDays", "ตั้งรอบเป็นวันหรือจำนวนชิ้น");
    ok.e3.seq += 1;
    const plan: Plan = {
      id: mockId("emp", 100 + ok.e3.seq),
      machine: { id: machine.id, name: machine.name },
      title: b.title ?? "",
      instructions: b.instructions ?? null,
      everyDays: b.everyDays ?? null,
      everyImpressions: b.everyImpressions ?? null,
      durationMinutes: b.durationMinutes ?? 60,
      lastDoneAt: null,
      parts: [],
      status: b.status ?? "active",
      version: 1,
    };
    ok.e3.plans.push(plan);
    return etagged(planView(ok.e3, plan), 201);
  }),
  http.get(`${BASE}/maintenance/plans/:planId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_maintenance.read");
    if (ok instanceof Response) return ok;
    const plan = ok.e3.plans.find((p) => p.id === params.planId);
    return plan ? etagged(planView(ok.e3, plan)) : notFound();
  }),
  http.put(`${BASE}/maintenance/plans/:planId`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_maintenance.manage");
    if (ok instanceof Response) return ok;
    const plan = ok.e3.plans.find((p) => p.id === params.planId);
    if (!plan) return notFound();
    const b = await body<Schemas["ErpSaveMaintenancePlanDto"]>(request);
    const machine = ok.e3.machines.find((m) => m.id === b.machineId);
    Object.assign(plan, {
      title: b.title,
      instructions: b.instructions ?? null,
      everyDays: b.everyDays ?? null,
      everyImpressions: b.everyImpressions ?? null,
      durationMinutes: b.durationMinutes ?? plan.durationMinutes,
      status: b.status ?? plan.status,
      ...(machine ? { machine: { id: machine.id, name: machine.name } } : {}),
      version: plan.version + 1,
    });
    return etagged(planView(ok.e3, plan));
  }),
  http.post(`${BASE}/maintenance/plans/:planId/actions/open`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_maintenance.manage");
    if (ok instanceof Response) return ok;
    const plan = ok.e3.plans.find((p) => p.id === params.planId);
    const machine = ok.e3.machines.find((m) => m.id === plan?.machine.id);
    if (!plan || !machine) return notFound();
    const open = planView(ok.e3, plan).openOrder;
    if (open) return problem(409, "erp.invalid_status", `มีงานซ่อม ${open.mtNo} เปิดอยู่แล้ว`);
    const mt = newMt(ok, { machine, title: plan.title, kind: "preventive", priority: "normal", plan });
    return etagged(mtView(ok, mt), 201);
  }),

  // ------------------------------------------------------------------------------ documents
  http.get(`${BASE}/documents/folders`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_documents.read");
    if (ok instanceof Response) return ok;
    return HttpResponse.json(ok.e3.folders.map((f) => folderView(ok.e3, f)));
  }),
  http.post(`${BASE}/documents/folders`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_documents.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpSaveFolderDto"]>(request);
    const name = b.name?.trim();
    if (!name) return invalid("name", "ใส่ชื่อโฟลเดอร์");
    if (ok.e3.folders.some((f) => f.name.toLowerCase() === name.toLowerCase()))
      return problem(409, "erp.folder_exists", "มีโฟลเดอร์ชื่อนี้แล้ว");
    ok.e3.seq += 1;
    const folder: Folder = { id: mockId("edf", 100 + ok.e3.seq), name, parentId: b.parentId ?? null };
    ok.e3.folders.push(folder);
    return HttpResponse.json(folderView(ok.e3, folder), { status: 201 });
  }),
  http.patch(`${BASE}/documents/folders/:folderId`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_documents.manage");
    if (ok instanceof Response) return ok;
    const folder = ok.e3.folders.find((f) => f.id === params.folderId);
    if (!folder) return notFound();
    const b = await body<Schemas["ErpSaveFolderDto"]>(request);
    if (b.name?.trim()) folder.name = b.name.trim();
    return HttpResponse.json(folderView(ok.e3, folder));
  }),
  http.delete(`${BASE}/documents/folders/:folderId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_documents.manage");
    if (ok instanceof Response) return ok;
    const folder = ok.e3.folders.find((f) => f.id === params.folderId);
    if (!folder) return notFound();
    if (ok.e3.docs.some((d) => d.folder?.id === folder.id))
      return problem(409, "erp.folder_not_empty", "โฟลเดอร์ยังมีเอกสาร");
    ok.e3.folders = ok.e3.folders.filter((f) => f !== folder);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${BASE}/documents`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_documents.read");
    if (ok instanceof Response) return ok;
    const url = new URL(request.url);
    const sp = url.searchParams;
    const status = sp.get("status") ?? "active";
    const q = sp.get("q")?.toLowerCase();
    const rows = ok.e3.docs
      .map(docView)
      .filter(
        (d) =>
          d.status === status &&
          (!sp.get("folderId") || d.folder?.id === sp.get("folderId")) &&
          (!sp.get("category") || d.category === sp.get("category")) &&
          (!sp.get("expiry") || d.expiry === sp.get("expiry")) &&
          (!sp.get("linkType") || (d.link?.type === sp.get("linkType") && d.link?.id === sp.get("linkId"))) &&
          (!q || `${d.title} ${d.tags.join(" ")} ${d.link?.label ?? ""}`.toLowerCase().includes(q)),
      )
      .map(({ versions: _v, note: _n, remindDays: _r, version: _ver, ...summary }) => summary);
    return HttpResponse.json(paginate(rows, pageQuery(url)));
  }),
  http.post(`${BASE}/documents`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_documents.manage");
    if (ok instanceof Response) return ok;
    const b = await body<Schemas["ErpCreateDocDto"]>(request);
    if (!b.title?.trim()) return invalid("title", "ใส่ชื่อเอกสาร");
    const link = linkOf(ok, b.linkType, b.linkId);
    if (link === undefined) return notFound();
    const folder = b.folderId ? ok.e3.folders.find((f) => f.id === b.folderId) : null;
    ok.e3.seq += 1;
    const file = { id: b.fileId ?? "", name: `${b.title.trim()}.pdf`, mimeType: "application/pdf", sizeBytes: 100_000 };
    const doc: Doc = {
      id: mockId("edc", 100 + ok.e3.seq),
      title: b.title.trim(),
      category: b.category ?? "other",
      folder: folder ? folderView(ok.e3, folder) : null,
      link,
      tags: b.tags ?? [],
      expiresOn: b.expiresOn ?? null,
      remindDays: b.remindDays ?? 30,
      note: b.note ?? null,
      status: "active",
      currentVersion: 1,
      file,
      versions: [
        { id: mockId("edv", 100 + ok.e3.seq), version: 1, file, note: null, by: "ผู้ใช้จำลอง", createdAt: now() },
      ],
      updatedAt: now(),
      version: 1,
    };
    ok.e3.docs.unshift(doc);
    return etagged(docView(doc), 201);
  }),
  http.get(`${BASE}/documents/:docId`, ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_documents.read");
    if (ok instanceof Response) return ok;
    const doc = ok.e3.docs.find((d) => d.id === params.docId);
    return doc ? etagged(docView(doc)) : notFound();
  }),
  http.patch(`${BASE}/documents/:docId`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_documents.manage");
    if (ok instanceof Response) return ok;
    const doc = ok.e3.docs.find((d) => d.id === params.docId);
    if (!doc) return notFound();
    const b = await body<Schemas["ErpUpdateDocDto"]>(request);
    if (b.linkType !== undefined) {
      const link = linkOf(ok, b.linkType, b.linkId);
      if (link === undefined) return notFound();
      doc.link = link;
    }
    if (b.folderId !== undefined) {
      const folder = b.folderId ? ok.e3.folders.find((f) => f.id === b.folderId) : null;
      doc.folder = folder ? folderView(ok.e3, folder) : null;
    }
    for (const k of ["title", "category", "tags", "expiresOn", "remindDays", "note", "status"] as const)
      if (b[k] !== undefined) Object.assign(doc, { [k]: b[k] });
    doc.version += 1;
    doc.updatedAt = now();
    return etagged(docView(doc));
  }),
  http.post(`${BASE}/documents/:docId/versions`, async ({ request, params }) => {
    const ok = ctx(request, params.factoryId, "factory_documents.manage");
    if (ok instanceof Response) return ok;
    const doc = ok.e3.docs.find((d) => d.id === params.docId);
    if (!doc) return notFound();
    const b = await body<Schemas["ErpAddDocVersionDto"]>(request);
    const file = {
      id: b.fileId ?? "",
      name: `${doc.title}-v${doc.currentVersion + 1}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 100_000,
    };
    doc.currentVersion += 1;
    doc.file = file;
    doc.versions.unshift({
      id: mockId("edv", 200 + doc.currentVersion),
      version: doc.currentVersion,
      file,
      note: b.note ?? null,
      by: "ผู้ใช้จำลอง",
      createdAt: now(),
    });
    if (b.expiresOn) doc.expiresOn = b.expiresOn;
    doc.version += 1;
    doc.updatedAt = now();
    return etagged(docView(doc), 201);
  }),
];

export function resetErpE3(): void {
  states.clear();
}
