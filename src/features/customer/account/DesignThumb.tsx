"use client";

import { useFileUrl } from "@/features/customer/files/files";

/** A design's thumbnail through a signed URL (`store.files.download`), or the words for none. */
export function DesignThumb({ fileId, empty }: { fileId: string | null; empty: string }) {
  const url = useFileUrl(fileId);
  return url ? (
    // A signed URL next/image cannot optimise; the design's title beside it is the label.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-full w-full object-contain" loading="lazy" />
  ) : (
    <span className="text-muted flex h-full items-center justify-center text-xs">{empty}</span>
  );
}
