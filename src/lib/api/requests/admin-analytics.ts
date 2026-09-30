/**
 * The UX journey funnels (U5.0) — the one analytics request packio-api still has to build
 * (`admin.analytics-journeys`, U5.B6). The dashboards, the prospectus and the reports are on the
 * published contract (`admin.analytics.*`, `admin.reports.*`, U-F0.3).
 *
 * Whether a step's weekly drop is alarming is the API's judgement against a setting; nothing here
 * is computed in the browser.
 */

import { z } from "zod";

import { FUNNEL_EVENTS } from "@/lib/analytics/events";

import { date, dateTime, pct, request } from "./define";

const period = z.object({ from: date(), to: date() });

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

/* ----------------------------------------------------------------------------------- requests */

export const adminAnalyticsRequests = {
  "GET /v1/admin/analytics/journeys": request({
    request: "admin.analytics-journeys",
    summary: "One UX journey's funnel: sessions and conversion per step, week-over-week change, drop alerts",
    decisions: ["D-102"],
    query: periodQuery.extend({ journey: analyticsJourney }),
    response: analyticsJourneyFunnel,
  }),
} as const;
