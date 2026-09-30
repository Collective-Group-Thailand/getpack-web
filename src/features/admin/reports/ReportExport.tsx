"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, download, pollUntil, problemMessage } from "../console";

type Format = Schemas["ReportFormat"];

/**
 * Export the whole report with the filters on screen (`admin.reports.export`, D-111, D-033): the
 * worker writes the file, the screen reads the run until it is done, then downloads it through a
 * five-minute signed URL (`admin.reports.runFile`, audited). The preview shows the first rows
 * only; the file holds all of them.
 */
export function ReportExport({
  reportKey,
  formats,
  filters,
  disabled,
}: {
  reportKey: string;
  formats: readonly Format[];
  filters: Schemas["ReportFiltersDto"];
  disabled?: boolean;
}) {
  const t = useTranslations("reports.export");

  const exportFile = useMutation({
    mutationFn: async (format: Format) => {
      const { contract } = adminBrowserApis();
      // No Idempotency-Key: the published operation does not take one.
      const queued = (
        await contract.POST("/v1/admin/reports/{reportKey}/exports", {
          params: { path: { reportKey } },
          body: { format, filters },
        })
      ).data!;
      const run = await pollUntil(
        async () =>
          (await contract.GET("/v1/admin/report-runs/{runId}", { params: { path: { runId: queued.id } } })).data!,
        (item) => item.status === "succeeded" || item.status === "failed",
      );
      if (run.status === "failed") throw new Error(run.error ?? "report.failed");
      return (await contract.GET("/v1/admin/report-runs/{runId}/file", { params: { path: { runId: run.id } } })).data!;
    },
    onSuccess: (file) => download(file.url),
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  return (
    <DropdownMenu
      label={t("label")}
      align="end"
      items={formats.map((format) => ({
        id: format,
        label: t(format),
        icon: format === "xlsx" ? ("spreadsheet" as const) : ("document" as const),
        onSelect: () => exportFile.mutate(format),
      }))}
      trigger={
        <Button variant="secondary" size="sm" iconStart="download" loading={exportFile.isPending} disabled={disabled}>
          {t("label")}
        </Button>
      }
    />
  );
}
