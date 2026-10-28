"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { isApiError } from "@/lib/api/problem";

import { adminBrowserApis, ConfirmAction, problemMessage, useCan } from "../console";

/** The shortest reason the API accepts for a Superadmin's download of a customer file (D-449 (1)). */
const REASON_MIN_LENGTH = 10;

/**
 * A stored file, downloaded through a short-lived signed URL (`admin.files.download`): asked for on
 * click, then opened by a second, explicit click — a tab opened after an await is a pop-up to the
 * browser, and blocked.
 *
 * D-449 (1): a customer's original / artwork is closed to Superadmin's ordinary download; when it is refused and the
 * signed-in person may read customer files with a reason (Superadmin only), a dialog asks why, and the reason is
 * logged with the access (`admin.files.downloadWithReason`).
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
  const [askReason, setAskReason] = useState(false);
  const canReadWithReason = useCan("customer_files.read_with_reason");
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
              if (canReadWithReason && isApiError(error) && (error.status === 404 || error.status === 403))
                setAskReason(true);
              else toast.error(problemMessage(error, t("downloadFailed")));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("download")}
        </Button>
      )}
      {fileId ? (
        <ConfirmAction
          open={askReason}
          onOpenChange={(open) => (open ? undefined : setAskReason(false))}
          title={t("reasonDialog.title")}
          description={t("reasonDialog.body", { name })}
          confirmLabel={t("reasonDialog.confirm")}
          reason={{
            label: t("reasonDialog.reason"),
            required: true,
            minLength: REASON_MIN_LENGTH,
            hint: t("reasonDialog.hint", { min: REASON_MIN_LENGTH }),
          }}
          onConfirm={async ({ reason }) => {
            try {
              const { data } = await adminBrowserApis().contract.POST(
                "/v1/admin/files/{fileId}/actions/download-with-reason",
                { params: { path: { fileId } }, body: { reason: reason.trim() } },
              );
              setUrl(data!.url);
            } catch (error) {
              toast.error(problemMessage(error, t("downloadFailed")));
              throw error;
            }
          }}
        />
      ) : null}
    </span>
  );
}
