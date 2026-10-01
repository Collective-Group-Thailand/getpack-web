"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { toast } from "@/ui/components/Toast";

import { useCan } from "./actor";
import { adminBrowserApis } from "./api";
import { download } from "./download";
import { problemMessage } from "./QueryError";

export type ListExportResource = Schemas["ListExportResource"];

/**
 * Export the list as it is filtered now (F2 §2 "xlsx export button") through `admin.exports.create`
 * (U-B0.3): orders, customers, companies, shipments and claims. The API writes the file — it holds
 * the rows and the permissions, and leaves contact details out — and answers with a five-minute
 * signed URL. Offered to whoever holds `reports.export`; the list's own read permission is the
 * API's to check.
 */
export function ExportButton({ resource, query }: { resource: ListExportResource; query: Record<string, string> }) {
  const t = useTranslations("console.export");
  const allowed = useCan("reports.export");

  const exportFile = useMutation({
    mutationFn: async (format: Schemas["ReportFormat"]) =>
      (await adminBrowserApis().contract.POST("/v1/admin/exports", { body: { resource, format, query } })).data!,
    onSuccess: (file) => {
      if (file.truncated) toast.warning(t("truncated", { rows: file.rows }));
      download(file.url);
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  if (!allowed) return null;

  return (
    <DropdownMenu
      label={t("label")}
      align="end"
      items={[
        { id: "xlsx", label: t("xlsx"), icon: "spreadsheet", onSelect: () => exportFile.mutate("xlsx") },
        { id: "csv", label: t("csv"), icon: "document", onSelect: () => exportFile.mutate("csv") },
      ]}
      trigger={
        <Button variant="secondary" size="sm" iconStart="download" loading={exportFile.isPending}>
          {t("label")}
        </Button>
      }
    />
  );
}
