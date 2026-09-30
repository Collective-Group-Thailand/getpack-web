"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Button, type ButtonProps } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, download, problemMessage } from "../console";

/**
 * Opens a file the API names by id (`admin.files.download`: a signed URL, five minutes). The
 * published shipment and claim carry file ids only — no names or thumbnails (CONTRACT-GAP
 * admin.shipments, admin.claims) — so each file is a button that fetches its URL when asked.
 */
export function useFileDownload() {
  const t = useTranslations("logistics.files");
  return useMutation({
    mutationFn: async (fileId: string) =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/files/{fileId}/download", {
          params: { path: { fileId } },
        })
      ).data!,
    onSuccess: (file) => download(file.url),
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
}

/** A labelled row of files (POD photos, claim evidence), opened one at a time. */
export function FileList({ fileIds, label, empty }: { fileIds: readonly string[]; label: string; empty?: string }) {
  const t = useTranslations("logistics.files");
  const file = useFileDownload();
  return (
    <div>
      <p className="text-muted mb-1 text-xs">{label}</p>
      {fileIds.length === 0 ? (
        <p className="text-muted text-sm">{empty ?? t("none")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {fileIds.map((fileId, index) => (
            <li key={fileId}>
              <Button
                size="sm"
                variant="secondary"
                iconStart="image"
                loading={file.isPending && file.variables === fileId}
                onClick={() => file.mutate(fileId)}
              >
                {t("file", { label, no: index + 1 })}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One document button (labels, packing list): disabled until the API has generated it. */
export function FileButton({
  fileId,
  children,
  ...props
}: { fileId: string | null; children: React.ReactNode } & Omit<ButtonProps, "onClick" | "loading" | "disabled">) {
  const file = useFileDownload();
  return (
    <Button
      {...props}
      disabled={!fileId}
      loading={file.isPending}
      onClick={() => (fileId ? file.mutate(fileId) : undefined)}
    >
      {children}
    </Button>
  );
}
