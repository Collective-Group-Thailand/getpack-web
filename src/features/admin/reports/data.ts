"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

import { adminBrowserApis } from "../console/api";

export type ReportDefinition = Schemas["ReportDefinitionDto"];
export type ReportKey = Schemas["ReportKey"];
/** Where a report sits in the menu: the catalogue's own `group` (U-B0.3). */
export type ReportGroup = Schemas["ReportGroup"];

/** The groups in the order the menu shows them; each lists the reports the API put in it. */
export const REPORT_GROUPS: readonly ReportGroup[] = ["sales", "finance", "marketing", "operations"];

/** The reports whose data this person may read (`admin.reports.catalogue`, D-111). */
export function useReportCatalogue() {
  return useQuery({
    queryKey: queryKeys.list("admin", "report", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/reports")).data!,
  });
}
