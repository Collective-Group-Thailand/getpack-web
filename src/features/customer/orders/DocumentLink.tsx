"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/**
 * A document downloaded through a short-lived signed URL (api-conventions §3): asked for on
 * click, then opened by a second, explicit click — a tab opened after an await is a pop-up to the
 * browser, and blocked.
 */
export function DocumentLink({ documentId, number }: { documentId: string; number: string }) {
  const t = useTranslations("myOrders.documents");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (url) {
    return (
      <Button asChild size="sm" iconStart="external">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {t("open")}
          <span className="sr-only"> {number}</span>
        </a>
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      iconStart="download"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          // `store.documents.pdf`: 409 until the PDF is rendered.
          const { data: signed } = await browserApi().GET("/v1/store/documents/{documentId}/pdf", {
            params: { path: { documentId } },
          });
          setUrl(signed!.url);
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : t("failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("download")}
      <span className="sr-only"> {number}</span>
    </Button>
  );
}
