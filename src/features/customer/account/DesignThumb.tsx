"use client";

import { useState } from "react";

import { useFileUrl } from "@/features/customer/files/files";

/**
 * A design's thumbnail, or the words for none. Prefer `url`: the API's own signed URL, ready for
 * an `<img>` (`LaunchpadDesignDto.thumbnailUrl`, 5 minutes) — the web no longer resolves the file
 * itself there. Without one, `fileId` goes through a signed URL (`store.files.download`). An image
 * that fails to load shows the same words, never a broken-image icon.
 */
export function DesignThumb({ url, fileId, empty }: { url?: string | null; fileId?: string | null; empty: string }) {
  const resolved = useFileUrl(url ? null : (fileId ?? null));
  const [failed, setFailed] = useState<string | null>(null);
  const src = url ?? resolved;
  return src && failed !== src ? (
    // A signed URL next/image cannot optimise; the design's title beside it is the label.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-full w-full object-contain" loading="lazy" onError={() => setFailed(src)} />
  ) : (
    <span className="text-muted flex h-full items-center justify-center text-xs">{empty}</span>
  );
}
