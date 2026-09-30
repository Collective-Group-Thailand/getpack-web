"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

import { adminBrowserApis } from "../console/api";

export type ReportDefinition = Schemas["ReportDefinitionDto"];
export type ReportKey = Schemas["ReportKey"];
export type ReportGroup = "sales" | "finance" | "marketing" | "operations";

/**
 * Where each report sits in the menu. The catalogue carries no group (CONTRACT-GAP admin.reports,
 * packio-api U-B0.3 optional `group`), so the screen maps the key — presentation only.
 */
export const REPORT_GROUP: Record<ReportKey, ReportGroup> = {
  sales: "sales",
  orders: "sales",
  quotations: "sales",
  sales_tax: "finance",
  payments_by_channel: "finance",
  points_liability: "finance",
  ar_aging: "finance",
  ap_aging: "finance",
  payout_history: "finance",
  campaign_usage: "marketing",
  claims: "operations",
  factory_scorecards: "operations",
};

/** The reports whose data this person may read (`admin.reports.catalogue`, D-111). */
export function useReportCatalogue() {
  return useQuery({
    queryKey: queryKeys.list("admin", "report", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/reports")).data!,
  });
}
