"use client";

import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/**
 * A file downloaded through a short-lived signed URL (`store.files.download`): asked for on click,
 * then opened by a second, explicit click — a tab opened after an await is a pop-up to the browser,
 * and blocked. The same two steps as an order's documents.
 */
export function FileLink({
  fileId,
  label,
  openLabel,
  failed,
  size = "sm",
}: {
  fileId: string;
  label: string;
  openLabel: string;
  failed: string;
  size?: "sm" | "md";
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (url) {
    return (
      <Button asChild size={size} iconStart="external">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {openLabel}
        </a>
      </Button>
    );
  }
  return (
    <Button
      size={size}
      variant="secondary"
      iconStart="download"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await browserApi().GET("/v1/store/files/{fileId}/download", {
            params: { path: { fileId } },
          });
          setUrl(data!.url);
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : failed);
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}
