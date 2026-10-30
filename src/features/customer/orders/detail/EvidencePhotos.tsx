"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { trackAccount } from "@/lib/analytics/account";
import { CardImage } from "@/ui/components/CardImage";
import { Dialog } from "@/ui/components/Dialog";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon } from "@/ui/icons";

import { useFileUrl } from "../../files/files";

/**
 * Photos the team shared on an order step (account pack Phase 3 item 2): production close-ups of the product and the
 * proof-of-delivery picture — the files `store.files.download` lets the customer read (milestone photos shared with
 * the customer, D-442: metadata stripped, product only). Thumbnails; a click opens the picture large.
 */
export function EvidencePhotos({ fileIds, kind }: { fileIds: string[]; kind: "production" | "delivery" }) {
  const t = useTranslations("myOrders.detail.evidence");
  const [open, setOpen] = useState<string | null>(null);
  if (fileIds.length === 0) return null;
  return (
    <>
      <ul className="mt-2 flex flex-wrap gap-2">
        {fileIds.map((id, index) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => {
                setOpen(id);
                trackAccount("order_photo_open", { kind });
              }}
              className="border-border bg-surface-subtle focus-visible:ring-focus-ring rounded-control grid h-[4.5rem] w-24 place-items-center overflow-hidden border outline-none focus-visible:ring-2"
            >
              <Thumb fileId={id} alt={t(kind, { n: index + 1 })} />
            </button>
          </li>
        ))}
      </ul>
      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        title={t(`${kind}Title`)}
        closeLabel={t("close")}
        size="lg"
      >
        {open ? <Large fileId={open} alt={t(`${kind}Title`)} /> : null}
      </Dialog>
    </>
  );
}

function Thumb({ fileId, alt }: { fileId: string; alt: string }) {
  const url = useFileUrl(fileId);
  if (!url) return <Skeleton className="size-full" />;
  // A file that cannot be read shows a quiet photo mark, never the browser's broken image with its alt text.
  return (
    <CardImage
      src={url}
      alt={alt}
      className="size-full object-cover"
      loading="lazy"
      fallback={<Icon name="image" size={20} aria-hidden="true" className="text-muted" />}
    />
  );
}

function Large({ fileId, alt }: { fileId: string; alt: string }) {
  const url = useFileUrl(fileId);
  if (!url)
    return (
      <div className="bg-bg-subtle grid aspect-[4/3] place-items-center rounded-xl">
        <Icon name="image" aria-hidden="true" className="text-muted" />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL, not an optimisable asset
  return <img src={url} alt={alt} className="bg-bg-subtle max-h-[70vh] w-full rounded-xl object-contain" />;
}
