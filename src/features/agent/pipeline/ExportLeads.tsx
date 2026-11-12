"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { useProblemText } from "./problem";

/**
 * "ส่งออก CSV" (`store.agentLeads.export`): the API writes the file (formula-safe, UTF-8 with BOM so Excel reads Thai)
 * and answers with a five-minute link; the browser downloads it. Nothing is built here.
 */
export function ExportLeads({ className }: { className?: string }) {
  const t = useTranslations("agentSales.list");
  const problemText = useProblemText();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      iconStart="download"
      loading={busy}
      className={cn("max-sm:hidden", className)}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await browserApi().GET("/v1/store/agent/leads/export");
          if (!data) throw new Error("no link");
          const link = document.createElement("a");
          link.href = data.url;
          link.download = "getpack-leads.csv";
          link.rel = "noopener";
          document.body.append(link);
          link.click();
          link.remove();
          toast.success(t("exported"));
        } catch (error) {
          toast.error(problemText(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("export")}
    </Button>
  );
}
