"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/** Opens the 50 ทวิ of a paid statement in a new tab (a short-lived link). */
export function CertificateButton({ statementId }: { statementId: string }) {
  const t = useTranslations("agent.statements");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      iconStart="download"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await browserApi().GET("/v1/store/agent/statements/{statementId}/wht-certificate", {
            params: { path: { statementId } },
          });
          if (data) window.open(data.url, "_blank", "noopener");
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : t("failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("certificate")}
    </Button>
  );
}
