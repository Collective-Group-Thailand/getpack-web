"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { PhotoGrid, signedUrl, useViewerLabels } from "@/features/partner/viewer";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { MediaViewer } from "@/ui/components/MediaViewer";

/**
 * A file the API names by id only (the factory's tax invoice, its own evidence): the signed URL is
 * asked for when the person opens it (`partner.files.download`, five minutes), and it opens full
 * screen in the page — a photo to zoom, a PDF in the browser's viewer — not in a new tab.
 */
export function PartnerFileButton({
  fileId,
  label,
  ...props
}: { fileId: string; label: string } & Omit<ButtonProps, "onClick" | "loading" | "children">) {
  const labels = useViewerLabels();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" variant="secondary" iconStart="eye" {...props} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <MediaViewer
        items={[{ title: label, resolve: () => signedUrl(fileId) }]}
        index={open ? 0 : null}
        onIndexChange={() => undefined}
        onClose={() => setOpen(false)}
        labels={labels}
      />
    </>
  );
}

/** A labelled set of photos (claim photos, the factory's evidence): thumbnails, full screen on a tap. */
export function PartnerFileList({ fileIds, label }: { fileIds: readonly string[]; label: string }) {
  const t = useTranslations("partnerAccount.files");
  if (!fileIds.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-sm">{label}</p>
      <PhotoGrid items={fileIds.map((fileId, index) => ({ fileId, title: t("file", { label, no: index + 1 }) }))} />
    </div>
  );
}
