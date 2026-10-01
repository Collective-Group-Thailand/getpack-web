"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { adminBrowserApis, problemMessage } from "../console";

/**
 * A stored file, downloaded through a short-lived signed URL (`admin.files.download`): asked for on
 * click, then opened by a second, explicit click — a tab opened after an await is a pop-up to the
 * browser, and blocked.
 */
export function FileItem({
  fileId,
  name,
  sizeBytes,
}: {
  fileId: string | null;
  name: string;
  sizeBytes?: number | null;
}) {
  const t = useTranslations("prepress.detail");
  const format = useFormat();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
      <Icon name="paperclip" size={16} />
      <span className="truncate">{name}</span>
      {sizeBytes ? <span className="text-muted text-xs whitespace-nowrap">{format.bytes(sizeBytes)}</span> : null}
      {!fileId ? null : url ? (
        <Button asChild size="sm" variant="ghost" iconStart="external">
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label={t("openFile", { name })}>
            {t("open")}
          </a>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          iconStart="download"
          loading={busy}
          aria-label={t("downloadFile", { name })}
          onClick={async () => {
            setBusy(true);
            try {
              const { data } = await adminBrowserApis().contract.GET("/v1/admin/files/{fileId}/download", {
                params: { path: { fileId } },
              });
              setUrl(data!.url);
            } catch (error) {
              toast.error(problemMessage(error, t("downloadFailed")));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("download")}
        </Button>
      )}
    </span>
  );
}
