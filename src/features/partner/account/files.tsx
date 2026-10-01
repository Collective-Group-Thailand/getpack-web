"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

/** Opens a short-lived signed URL without leaving the page. */
function open(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  anchor.target = "_blank";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * A file the API names by id only (a claim photo, the factory's tax invoice, its own evidence): the
 * signed URL is asked for when the person wants it (`partner.files.download`, five minutes), so the
 * page never holds one that has expired.
 */
export function PartnerFileButton({
  fileId,
  label,
  ...props
}: { fileId: string; label: string } & Omit<ButtonProps, "onClick" | "loading" | "children">) {
  const t = useTranslations("partnerAccount.files");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="lg"
      variant="secondary"
      iconStart="download"
      {...props}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await browserApi().GET("/v1/partner/files/{fileId}/download", {
            params: { path: { fileId } },
          });
          open(data!.url);
        } catch (error) {
          toast.error(problemMessage(error, t("failed")));
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

/** A labelled row of files, opened one at a time (claim photos, the factory's evidence). */
export function PartnerFileList({ fileIds, label }: { fileIds: readonly string[]; label: string }) {
  const t = useTranslations("partnerAccount.files");
  if (!fileIds.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-sm">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {fileIds.map((fileId, index) => (
          <li key={fileId}>
            <PartnerFileButton fileId={fileId} label={t("file", { label, no: index + 1 })} iconStart="image" />
          </li>
        ))}
      </ul>
    </div>
  );
}
