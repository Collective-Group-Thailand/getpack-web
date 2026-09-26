/**
 * Price governance and the production floor, mocked: suggestions, simulations, index series and
 * the coverage map on the published B2.2 contract; the production board, inspections and
 * scorecards as contract requests (CONTRACT-REQUEST admin.production-board, admin.inspections,
 * admin.scorecards).
 *
 * Suggestions follow packio-api's pricing service: a material line is suggested from its index
 * series (then → now ratio), a process rate from the factory's own history, a new line from
 * peers (never naming them), a margin line has no method. The deviation is
 * (proposed − suggested) ÷ suggested × 100 on the primary column, computed here in the mock's
 * stand-in for the backend. Production rows come from the commerce mock's own jobs.
 */

import type { z } from "zod";

import { http, HttpResponse } from "msw";

import type { boardJob, inspection } from "@/lib/api/requests/admin-partners";
import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { PRODUCT_TYPES } from "./catalog";
import { FACTORY, orders } from "./commerce";
import { registerQueue } from "./console";
import { coverageOf, factoryTiers, proposals } from "./partners";
import { settingValue } from "./platform";

type Suggestion = Schemas["PriceLineSuggestionDto"];
type Simulation = Schemas["PriceSimulationDto"];
type Series = Schemas["IndexSeriesDto"];
type Point = Schemas["IndexPointDto"];
type Job = z.output<typeof boardJob>;
type Inspection = z.output<typeof inspection>;

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const month = (offset: number) => {
  const date = new Date(Date.now() + 7 * 3_600_000);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
};

/* ------------------------------------------------------------------------------ index series */

const SERIES: Series[] = [
  [
    "paper.art_card",
    "material",
    "ดัชนีราคากระดาษอาร์ตการ์ด",
    "Art card paper index",
    "จุดดัชนี",
    [100, 100.4, 101.1, 101.6, 102, 102.3],
  ],
  [
    "paper.kraft",
    "material",
    "ดัชนีราคากระดาษคราฟท์",
    "Kraft paper index",
    "จุดดัชนี",
    [100, 99.2, 98.8, 99.5, 100.1, 100.6],
  ],
  [
    "energy.electricity",
    "cost_driver",
    "ค่าไฟฟ้าอุตสาหกรรม",
    "Industrial electricity",
    "บาท/หน่วย",
    [4.18, 4.18, 4.18, 3.99, 3.99, 3.99],
  ],
  [
    "labour.min_wage",
    "cost_driver",
    "ค่าแรงขั้นต่ำ (กรุงเทพฯ)",
    "Minimum wage (Bangkok)",
    "บาท/วัน",
    [363, 363, 400, 400, 400, 400],
  ],
].map(([code, kind, nameTh, nameEn, unit], index) => ({
  id: mockId("ixs", index + 1),
  code: code as string,
  kind: kind as Series["kind"],
  materialFamilyId: kind === "material" ? "0192f3a0-7c1e-7d2a-9b1f-00000000d001" : null,
  nameTh: nameTh as string,
  nameEn: nameEn as string,
  unit: unit as string,
  source: "manual" as const,
  adapterKey: null,
  latestPoint: null,
  createdAt: bangkokIso(-60 * 24 * 200),
}));

const POINTS = new Map<string, Point[]>(
  SERIES.map((series, index) => {
    const values = [
      [100, 100.4, 101.1, 101.6, 102, 102.3],
      [100, 99.2, 98.8, 99.5, 100.1, 100.6],
      [4.18, 4.18, 4.18, 3.99, 3.99, 3.99],
      [363, 363, 400, 400, 400, 400],
    ][index]!;
    // The current month is left for someone to record.
    return [
      series.id,
      values.map((value, at) => ({
        period: month(at - 6),
        value: value.toFixed(6),
        sourceRef: index < 2 ? "สมาคมผู้ค้ากระดาษ (ข้อมูลจำลอง)" : "ประกาศทางราชการ (ข้อมูลจำลอง)",
        updatedAt: bangkokIso(-60 * 24 * (6 - at) * 30),
      })),
    ];
  }),
);

const withLatest = (series: Series): Series => ({ ...series, latestPoint: POINTS.get(series.id)?.at(-1) ?? null });

/* ------------------------------------------------------------------------------ suggestions */

const scale = (value: unknown, ratio: number) => (Number(value) * ratio).toFixed(6);

function suggestFor(proposalId: string): Suggestion[] {
  const item = proposals.find((candidate) => candidate.id === proposalId);
  if (!item) return [];
  const art = POINTS.get(SERIES[0]!.id)!;
  const then = art.at(-4)!;
  const now = art.at(-1)!;
  const ratio = Number(now.value) / Number(then.value);
  return item.lines.map((line): Suggestion => {
    const proposed = (line.proposedValues ?? {}) as Record<string, unknown>;
    const current = (line.currentValues ?? {}) as Record<string, unknown>;
    const base = {
      lineId: line.id,
      component: line.component,
      lineKey: line.lineKey,
      computedAt: bangkokIso(-30),
    };
    const deviation = (column: string, suggested: Record<string, unknown>) =>
      proposed[column] !== undefined && Number(suggested[column])
        ? (((Number(proposed[column]) - Number(suggested[column])) / Number(suggested[column])) * 100).toFixed(4)
        : null;
    switch (line.component) {
      case "material_prices": {
        const suggested = { ...current, rate: scale(current.rate, ratio) };
        return {
          ...base,
          group: "materials",
          method: "material_index",
          suggestedValues: suggested,
          basis: {
            group: "materials",
            primaryColumn: "rate",
            index: {
              series: SERIES[0]!.code,
              then: { period: then.period, value: then.value },
              now: { period: now.period, value: now.value },
              ratio: ratio.toFixed(4),
            },
          },
          deviationPct: deviation("rate", suggested),
          flags: [],
        };
      }
      case "print_prices": {
        const suggested = {
          ...current,
          setup: (Number(current.setup) * 1.03).toFixed(2),
          perSheet: scale(current.perSheet, 1.03),
        };
        return {
          ...base,
          group: "process_rates",
          method: "own_history_driver",
          suggestedValues: suggested,
          basis: {
            group: "process_rates",
            primaryColumn: "perSheet",
            driver: { series: "energy.electricity", weight: "0.40" },
            lastApproved: current,
          },
          deviationPct: deviation("perSheet", suggested),
          flags: [],
        };
      }
      case "finish_prices":
        return {
          ...base,
          group: "process_rates",
          method: "peer_benchmark",
          suggestedValues: { ...proposed, perSqm: "5.900000" },
          basis: {
            group: "process_rates",
            primaryColumn: "perSqm",
            peers: { count: 4, p25: "5.400000", median: "5.900000", p75: "6.600000" },
          },
          deviationPct: deviation("perSqm", { perSqm: "5.900000" }),
          flags: [],
        };
      default:
        return {
          ...base,
          group: "commercial_terms",
          method: "none",
          suggestedValues: null,
          basis: { group: "commercial_terms" },
          deviationPct: null,
          flags: ["impact_only"],
        };
    }
  });
}

const simulations = new Map<string, Simulation>();

/* ----------------------------------------------------------------------- production & QC */

function boardJobs(): Job[] {
  return orders.flatMap((order) =>
    order.jobs
      .filter((job) => job.status === "in_progress" || job.status === "accepted" || job.status === "released")
      .map((job): Job => {
        // A released job the factory has not accepted has no milestones yet: it waits at the first step.
        const current = job.milestones.find((milestone) => milestone.status !== "completed") ??
          job.milestones.at(-1) ?? {
            key: "step_1",
            name: "รับงาน",
            status: "pending" as const,
            dueAt: job.acceptDueAt,
          };
        return {
          id: job.id,
          jobNo: job.jobNo,
          order: { id: order.id, orderCode: order.orderCode },
          factory: job.factory ?? FACTORY,
          productType: order.productType,
          quantity: order.quantity,
          status: job.status,
          milestone: { key: current.key, name: current.name, status: current.status, dueAt: current.dueAt },
          promisedShipDate: job.promisedShipDate ?? order.promisedShipDate ?? bangkokIso().slice(0, 10),
          predictedFinishOn: job.atRisk ? bangkokIso(60 * 24 * 3).slice(0, 10) : null,
          atRisk: job.atRisk,
          riskReason: job.atRisk ? "งานพิมพ์ช้ากว่าแผน 2 วัน" : null,
          inspectionRequired: Number(order.grossAmount) >= 100_000,
        };
      }),
  );
}

const INSPECTOR = PERSONAS.find((persona) => persona.key === "partner_manager")!;
const inspections: Inspection[] = boardJobs()
  .slice(0, 4)
  .map((job, index): Inspection => {
    const status = (["planned", "in_progress", "passed", "failed"] as const)[index]!;
    return {
      id: mockId("isp", index + 1),
      job: { id: job.id, jobNo: job.jobNo },
      order: job.order,
      factory: job.factory,
      productType: job.productType,
      reasons:
        index === 0
          ? ["value_100_pct"]
          : index === 1
            ? ["value_band_sample", "special_finish_or_food"]
            : ["trial_factory"],
      lotSize: job.quantity,
      sampleSize: job.quantity >= 3201 ? 200 : job.quantity >= 1201 ? 125 : 80,
      aql: { critical: "0", major: "2.5", minor: "4.0" },
      acceptNumbers:
        job.quantity >= 3201
          ? { critical: 0, major: 10, minor: 14 }
          : job.quantity >= 1201
            ? { critical: 0, major: 7, minor: 10 }
            : { critical: 0, major: 5, minor: 7 },
      found:
        status === "passed"
          ? { critical: 0, major: 2, minor: 3 }
          : status === "failed"
            ? { critical: 1, major: 3, minor: 2 }
            : null,
      status,
      inspector: status === "planned" ? null : { id: INSPECTOR.id, displayName: INSPECTOR.displayName },
      scheduledAt: bangkokIso(60 * 24 * (index === 0 ? 2 : -1)),
      resultAt: ["passed", "failed"].includes(status) ? bangkokIso(-60 * 5) : null,
      notes: status === "failed" ? "พบรอยพิมพ์เหลื่อมที่ฝากล่อง" : null,
    };
  });

registerQueue("qc.inspect", () => {
  const open = inspections.filter((item) => item.status === "planned" || item.status === "in_progress");
  return {
    key: "production.inspections",
    path: "/admin/production/inspections",
    count: open.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});
registerQueue("production.read", () => {
  const risky = boardJobs().filter((job) => job.atRisk);
  return {
    key: "production.at_risk",
    path: "/admin/production?atRisk=true",
    count: risky.length,
    overdueCount: risky.length,
    nextDueAt: null,
  };
});

/* --------------------------------------------------------------------------------- handlers */

export const governanceHandlers = [
  http.get("*/v1/admin/price-proposals/:proposalId/suggestions", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "price_suggestions.read")) return forbidden();
    const proposalId = String(params.proposalId);
    if (!proposals.some((item) => item.id === proposalId)) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
    return HttpResponse.json<Schemas["PriceSuggestionsDto"]>({
      proposalId,
      computedAt: bangkokIso(-30),
      lines: suggestFor(proposalId),
    });
  }),
  http.post("*/v1/admin/price-proposals/:proposalId/suggestions/actions/recompute", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "price_suggestions.read")) return forbidden();
    const proposalId = String(params.proposalId);
    return HttpResponse.json<Schemas["PriceSuggestionsDto"]>({
      proposalId,
      computedAt: bangkokIso(),
      lines: suggestFor(proposalId),
    });
  }),
  http.post("*/v1/admin/price-proposals/:proposalId/simulations", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "price_suggestions.read")) return forbidden();
    const item = proposals.find((candidate) => candidate.id === params.proposalId);
    if (!item) return problem(404, "http.not_found", "ไม่พบข้อเสนอราคานี้");
    // The worker has finished by the first poll, in the mock; the window is a setting.
    const days = settingValue<number>("partners.impact_simulation_window_days");
    const simulation: Simulation = {
      id: mockId("sim", simulations.size + 1),
      proposalId: item.id,
      status: "succeeded",
      windowFrom: bangkokIso(-60 * 24 * days),
      windowTo: bangkokIso(),
      result: {
        quotesInWindow: 38,
        priceChangePct: "4.2100",
        marginChangePct: "-0.8000",
        selectionShareChangePct: "-3.5000",
      },
      error: null,
      createdAt: bangkokIso(),
      completedAt: bangkokIso(),
    };
    simulations.set(simulation.id, simulation);
    return HttpResponse.json(simulation, { status: 202 });
  }),
  http.get("*/v1/admin/price-proposals/:proposalId/simulations/:simulationId", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "price_suggestions.read")) return forbidden();
    const simulation = simulations.get(String(params.simulationId));
    return simulation ? HttpResponse.json(simulation) : problem(404, "http.not_found", "ไม่พบการจำลองนี้");
  }),
  http.get("*/v1/admin/index-series", ({ request }) => {
    if (!can(staffPersonaOf(request), "partners.read")) return forbidden();
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = SERIES.filter((series) => !kind || series.kind === kind)
      .filter((series) => matchesQuery(q, series.code, series.nameTh, series.nameEn))
      .map(withLatest);
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),
  http.post("*/v1/admin/index-series", async ({ request }) => {
    if (!can(staffPersonaOf(request), "index_series.manage")) return forbidden();
    const body = (await request.json()) as Schemas["CreateIndexSeriesDto"];
    if (SERIES.some((series) => series.code === body.code))
      return problem(409, "index.duplicate_code", "มีดัชนีรหัสนี้แล้ว", [
        { path: "code", code: "unique", message: "ซ้ำกับที่มีอยู่" },
      ]);
    const created: Series = {
      id: mockId("ixs", 100 + SERIES.length),
      code: body.code,
      kind: body.kind,
      materialFamilyId: body.materialFamilyId ?? null,
      nameTh: body.nameTh,
      nameEn: body.nameEn,
      unit: body.unit,
      source: body.source ?? "manual",
      adapterKey: body.adapterKey ?? null,
      latestPoint: null,
      createdAt: bangkokIso(),
    };
    SERIES.push(created);
    POINTS.set(created.id, []);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.get("*/v1/admin/index-series/:seriesId", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "partners.read")) return forbidden();
    const series = SERIES.find((item) => item.id === params.seriesId);
    return series ? HttpResponse.json(withLatest(series)) : problem(404, "http.not_found", "ไม่พบดัชนีนี้");
  }),
  http.get("*/v1/admin/index-series/:seriesId/points", ({ params, request }) => {
    if (!can(staffPersonaOf(request), "partners.read")) return forbidden();
    const points = POINTS.get(String(params.seriesId));
    return points ? HttpResponse.json(points) : problem(404, "http.not_found", "ไม่พบดัชนีนี้");
  }),
  http.put("*/v1/admin/index-series/:seriesId/points/:period", async ({ params, request }) => {
    if (!can(staffPersonaOf(request), "index_series.manage")) return forbidden();
    const points = POINTS.get(String(params.seriesId));
    if (!points) return problem(404, "http.not_found", "ไม่พบดัชนีนี้");
    const period = String(params.period);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
      return problem(422, "validation.failed", "เดือนไม่ถูกต้อง", [
        { path: "period", code: "pattern", message: "YYYY-MM" },
      ]);
    const body = (await request.json()) as Schemas["SetIndexPointDto"];
    const point: Point = {
      period,
      value: Number(body.value).toFixed(6),
      sourceRef: body.sourceRef ?? null,
      updatedAt: bangkokIso(),
    };
    const at = points.findIndex((item) => item.period === point.period);
    if (at >= 0) points[at] = point;
    else points.push(point);
    points.sort((a, b) => a.period.localeCompare(b.period));
    return HttpResponse.json(point);
  }),
  http.get("*/v1/admin/partners/coverage", ({ request }) => {
    if (!can(staffPersonaOf(request), "partners.read")) return forbidden();
    const productTypeId = new URL(request.url).searchParams.get("productTypeId");
    const types = PRODUCT_TYPES.filter((type) => type.status === "active")
      .filter((type) => !productTypeId || type.id === productTypeId)
      .sort((a, b) => a.code.localeCompare(b.code));
    if (productTypeId && types.length === 0) return problem(404, "http.not_found", "ไม่พบประเภทสินค้านี้");
    return HttpResponse.json(types.map(coverageOf));
  }),
  mockRequest("GET /v1/admin/production-board", ({ query, request }) => {
    if (!can(staffPersonaOf(request), "production.read")) return forbidden();
    const jobs = boardJobs()
      .filter((job) => !query.factoryId || job.factory.id === query.factoryId)
      .filter((job) => !query.productType || job.productType.code === query.productType)
      .filter((job) => !query.atRisk || job.atRisk);
    // The product type's route (D-075); the commerce mock's jobs all follow this one.
    const route = ["รับงาน", "เตรียมวัตถุดิบ", "พิมพ์", "ไดคัท", "ตรวจคุณภาพ", "แพ็ก"];
    return {
      columns: route.map((name, index) => {
        const key = `step_${index + 1}`;
        const rows = jobs.filter((job) => job.milestone.key === key);
        return { key, name, total: rows.length, atRisk: rows.filter((job) => job.atRisk).length, jobs: rows };
      }),
    };
  }),
  mockRequest("GET /v1/admin/inspections", ({ query, request }) => {
    const who = staffPersonaOf(request);
    if (!can(who, "qc.inspect") && !can(who, "production.read")) return forbidden();
    return paginate(
      inspections
        .filter((item) => !query.status || item.status === query.status)
        .filter((item) => !query.factoryId || item.factory.id === query.factoryId),
      query,
    );
  }),
  mockRequest("POST /v1/admin/inspections/{inspectionId}/actions/record", ({ params, body, request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "qc.inspect")) return forbidden();
    const item = inspections.find((candidate) => candidate.id === params.inspectionId);
    if (!item) return problem(404, "http.not_found", "ไม่พบงานตรวจนี้");
    if (!["planned", "in_progress"].includes(item.status))
      return problem(409, "inspection.closed", "บันทึกผลงานตรวจนี้ไปแล้ว");
    const failed =
      body.found.critical > item.acceptNumbers.critical ||
      body.found.major > item.acceptNumbers.major ||
      body.found.minor > item.acceptNumbers.minor;
    Object.assign(item, {
      found: body.found,
      notes: body.notes ?? null,
      status: failed ? "failed" : "passed",
      resultAt: bangkokIso(),
      inspector: { id: who.id, displayName: who.displayName },
    });
    return item;
  }),
  mockRequest("GET /v1/admin/scorecards", ({ query, request }) => {
    if (!can(staffPersonaOf(request), "partners.read")) return forbidden();
    const chosen = query.month ?? month(-1);
    return {
      month: chosen,
      data: factoryTiers()
        .filter((entry) => ["active", "trial", "suspended"].includes(entry.status))
        .map((entry, index) => ({
          factory: entry.factory,
          month: chosen,
          onTimeAcceptancePct: (98 - index * 3.5).toFixed(4),
          onTimeShippingPct: (95 - index * 4.25).toFixed(4),
          qcFirstPassPct: (97 - index * 2).toFixed(4),
          claimRatePct: (0.8 + index * 0.9).toFixed(4),
          onTimeUpdatesPct: (92 - index * 6).toFixed(4),
          jobsCount: 40 - index * 8,
          computedAt: bangkokIso(-60 * 24 * 2),
        })),
    };
  }),
];
