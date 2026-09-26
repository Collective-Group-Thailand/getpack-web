"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { browserRequests } from "@/lib/api/requests/browser";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

import { problemMessage } from "./QueryError";

/**
 * Export the list as it is filtered now (F2 §2 "xlsx export button"). The API writes the file —
 * it holds the rows and the permissions — and answers with a five-minute signed URL
 * (CONTRACT-REQUEST `admin.exports`, shaped like the audit export that already exists).
 */
export function ExportButton({ resource, query }: { resource: string; query: Record<string, string> }) {
  const t = useTranslations("console.export");

  const exportFile = useMutation({
    mutationFn: (format: "xlsx" | "csv") =>
      browserRequests().call("POST /v1/admin/exports", { body: { resource, format, query } }),
    onSuccess: (file) => {
      if (file.truncated) toast.warning(t("truncated", { rows: file.rows }));
      download(file.url);
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

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

/** Starts a download without leaving the page. */
export function download(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  anchor.download = "";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
