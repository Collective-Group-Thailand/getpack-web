/**
 * Demand analytics, the partner prospectus and operational reports (F2 2.8) — packio-api B6.1
 * and B6.2, not published yet. The analytics read the nightly rollups (a star model of sessions,
 * quotes, RFQs, orders, jobs, shipments, claims); nothing here is computed in the browser.
 *
 * Privacy is the API's (D-044, D-102, PDPA): a breakdown with fewer than the minimum group is
 * suppressed and counted, never shown, and the prospectus holds only aggregated, anonymised
 * figures. The screen says how many groups were suppressed and at which threshold.
 */

import { z } from "zod";

import { FUNNEL_EVENTS } from "@/lib/analytics/events";

import { date, dateTime, money, pct, request, uuid } from "./define";

const period = z.object({ from: date(), to: date() });

/* -------------------------------------------------------------------------------- analytics */

export const funnelStep = z
  .enum(["visit", "configure", "quote", "cart", "checkout", "paid"])
  .meta({ id: "FunnelStep" });
export const demandDimension = z
  .enum(["product_type", "spec_band", "quantity_band", "province"])
  .meta({ id: "DemandDimension" });

export const analyticsOverview = z
  .object({
    period,
    kpis: z.object({
      sessions: z.number().int(),
      quotes: z.number().int(),
      rfqs: z.number().int(),
      paidOrders: z.number().int(),
      gmv: money(),
      aov: money(),
      conversionPct: pct(),
      repeatRatePct: pct(),
    }),
    /** The same KPIs over the previous period of equal length, for the change arrows. */
    previous: z.object({ gmv: money(), paidOrders: z.number().int(), conversionPct: pct() }),
    funnel: z.array(z.object({ step: funnelStep, count: z.number().int() })),
    trend: z.array(z.object({ date: date(), gmv: money(), paidOrders: z.number().int(), quotes: z.number().int() })),
    computedAt: dateTime(),
  })
  .meta({ id: "AnalyticsOverviewDto" });

export const demandRow = z.object({
  key: z.string(),
  label: z.string(),
  quotes: z.number().int(),
  rfqs: z.number().int(),
  paidOrders: z.number().int(),
  gmv: money(),
  conversionPct: pct(),
  /** Quotes shown but not taken further — the price and lead-time sensitivity signal (D-102). */
  abandonedAfterPricePct: pct(),
});

export const analyticsDemand = z
  .object({
    period,
    dimension: demandDimension,
    rows: z.array(demandRow),
    /** Groups below the minimum size, withheld (D-044). */
    suppressedGroups: z.number().int(),
    minGroupSize: z.number().int(),
  })
  .meta({ id: "AnalyticsDemandDto" });

export const analyticsUnmetDemand = z
  .object({
    period,
    reasons: z.array(z.object({ code: z.string(), label: z.string(), count: z.number().int() })),
    specs: z.array(
      z.object({
        productTypeCode: z.string(),
        productTypeName: z.string(),
        spec: z.string(),
        requests: z.number().int(),
      }),
    ),
    capacityLimited: z.array(
      z.object({
        week: z.string(),
        productTypeCode: z.string(),
        productTypeName: z.string(),
        requests: z.number().int(),
      }),
    ),
    rfqsDeclined: z.number().int(),
    rfqsExpired: z.number().int(),
  })
  .meta({ id: "AnalyticsUnmetDemandDto" });

export const analyticsFactories = z
  .object({
    period,
    rows: z.array(
      z.object({
        factory: z.object({ id: uuid(), code: z.string(), name: z.string() }),
        jobs: z.number().int(),
        utilisationPct: pct(),
        onTimePct: pct().nullable(),
      }),
    ),
  })
  .meta({ id: "AnalyticsFactoriesDto" });

export const analyticsCampaigns = z
  .object({
    period,
    rows: z.array(
      z.object({
        campaign: z.object({ id: uuid(), code: z.string(), name: z.string() }),
        redemptions: z.number().int(),
        paidOrders: z.number().int(),
        discountAmount: money(),
        revenueAmount: money(),
        newCustomers: z.number().int(),
      }),
    ),
  })
  .meta({ id: "AnalyticsCampaignsDto" });

/* ------------------------------------------------------------------- journey funnels (U5.0) */

/** The UX scorecard's journeys (`docs/ux/funnels.md`); each has a fixed list of steps. */
export const analyticsJourney = z
  .enum(["configurator", "checkout", "studio", "claims", "reorder"])
  .meta({ id: "AnalyticsJourney" });

export const analyticsJourneyFunnel = z
  .object({
    journey: analyticsJourney,
    period,
    /** The period of equal length before, which the conversions are compared with. */
    previousPeriod: period,
    steps: z.array(
      z.object({
        /** The funnel event that marks the step (`src/lib/analytics/events.ts`). */
        event: z.enum(FUNNEL_EVENTS).meta({ id: "AnalyticsFunnelEvent" }),
        /** Sessions that reached the step in the period. */
        sessions: z.number().int(),
        /** Share of the previous step's sessions that reached this one; `null` on the first step. */
        conversionPct: pct().nullable(),
        previousConversionPct: pct().nullable(),
        /** Relative change of the step's conversion, last complete week against the week before. */
        weekOverWeekPct: pct().nullable(),
        /** The API's judgement that the weekly drop is beyond `alertThresholdPct`. */
        alert: z.boolean(),
      }),
    ),
    /** The relative weekly drop that raises an alert — a setting (scorecard §4 proposes 15 %). */
    alertThresholdPct: pct(),
    computedAt: dateTime(),
  })
  .meta({ id: "AnalyticsJourneyFunnelDto" });

/** A preset the API resolves in Asia/Bangkok, or `custom` with both dates; the period comes back. */
export const analyticsRange = z.enum(["7d", "30d", "90d", "custom"]).meta({ id: "AnalyticsRange" });
const periodQuery = z.object({ range: analyticsRange, from: date().optional(), to: date().optional() });

/* ---------------------------------------------------------------------------------- reports */

export const reportKey = z
  .enum([
    "sales",
    "sales_tax",
    "payments",
    "orders_quotations",
    "promotion_usage",
    "points_liability",
    "claims",
    "payout_history",
    "ar_aging",
    "ap_aging",
  ])
  .meta({ id: "ReportKey" });
export const reportColumnType = z
  .enum(["text", "code", "money", "number", "pct", "date", "datetime"])
  .meta({ id: "ReportColumnType" });

export const reportDefinition = z
  .object({
    key: reportKey,
    group: z.enum(["sales", "finance", "marketing", "operations"]),
    /** Extra filters beyond the period, by name; their options come with the report. */
    filters: z.array(
      z.object({ key: z.string(), options: z.array(z.object({ value: z.string(), label: z.string() })) }),
    ),
    /** Point-in-time reports (aging, liability) take an "as of" date instead of a period. */
    asOf: z.boolean(),
  })
  .meta({ id: "ReportDefinitionDto" });

export const reportResult = z
  .object({
    key: reportKey,
    columns: z.array(z.object({ key: z.string(), type: reportColumnType, total: z.boolean() })),
    rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
    totals: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).nullable(),
    meta: z.object({ page: z.number().int(), perPage: z.number().int(), total: z.number().int() }),
    generatedAt: dateTime(),
  })
  .meta({ id: "ReportResultDto" });

/* ----------------------------------------------------------------------------------- requests */

export const adminAnalyticsRequests = {
  "GET /v1/admin/analytics/overview": request({
    request: "admin.analytics",
    summary: "KPIs, the funnel (visit → configure → quote → cart → paid) and the daily trend for a period",
    decisions: ["D-102"],
    query: periodQuery,
    response: analyticsOverview,
  }),
  "GET /v1/admin/analytics/demand": request({
    request: "admin.analytics",
    summary: "Quotes, RFQs, orders and GMV by product type, spec band, quantity band or province",
    decisions: ["D-102", "D-044"],
    query: periodQuery.extend({ dimension: demandDimension, productType: z.string().optional() }),
    response: analyticsDemand,
  }),
  "GET /v1/admin/analytics/unmet-demand": request({
    request: "admin.analytics",
    summary: "Declined and expired RFQs by reason, specs no factory makes, capacity-limited weeks",
    decisions: ["D-102", "D-100"],
    query: periodQuery,
    response: analyticsUnmetDemand,
  }),
  "GET /v1/admin/analytics/factories": request({
    request: "admin.analytics",
    summary: "Factory utilisation and on-time rate",
    decisions: ["D-102", "D-155"],
    query: periodQuery,
    response: analyticsFactories,
  }),
  "GET /v1/admin/analytics/campaigns": request({
    request: "admin.analytics",
    summary: "Campaign performance: redemptions, orders, discount given, revenue, new customers",
    decisions: ["D-102", "D-154"],
    query: periodQuery,
    response: analyticsCampaigns,
  }),
  "GET /v1/admin/analytics/journeys": request({
    request: "admin.analytics-journeys",
    summary: "One UX journey's funnel: sessions and conversion per step, week-over-week change, drop alerts",
    decisions: ["D-102"],
    query: periodQuery.extend({ journey: analyticsJourney }),
    response: analyticsJourneyFunnel,
  }),
  "POST /v1/admin/analytics/prospectus": request({
    request: "admin.prospectus",
    summary: "The partner prospectus (PDF or XLSX): aggregated and anonymised only (D-102, D-044)",
    decisions: ["D-102", "D-044"],
    body: periodQuery.extend({ format: z.enum(["pdf", "xlsx"]) }),
    response: z.object({
      url: z.string(),
      expiresAt: dateTime(),
      minGroupSize: z.number().int(),
      suppressedGroups: z.number().int(),
    }),
  }),
  "GET /v1/admin/reports": request({
    request: "admin.reports",
    summary: "The operational reports this role may run",
    response: z.array(reportDefinition),
  }),
  "GET /v1/admin/reports/{reportKey}": request({
    request: "admin.reports",
    summary: "One report for a period (or as of a date): typed columns, rows, and the totals row",
    query: z.object({
      from: date().optional(),
      to: date().optional(),
      asOf: date().optional(),
      page: z.coerce.number().int().min(1).optional(),
      perPage: z.coerce.number().int().min(1).max(200).optional(),
      filter: z.string().optional(),
      value: z.string().optional(),
    }),
    response: reportResult,
  }),
} as const;
