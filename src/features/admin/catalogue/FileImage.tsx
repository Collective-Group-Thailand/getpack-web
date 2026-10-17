"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis } from "../console";

/**
 * An image the API names by file id, drawn through `admin.files.download` (a signed URL, five
 * minutes) — so curation sees the photo it is about to replace or remove, not a button named
 * "open". A file the browser cannot draw (still scanning, a PDF) is a quiet placeholder.
 */
export function FileImage({ fileId, alt, className }: { fileId: string; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const url = useQuery({
    queryKey: queryKeys.related("admin", "files", fileId, "download"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/files/{fileId}/download", {
          params: { path: { fileId } },
        })
      ).data!.url,
    staleTime: 4 * 60_000,
  }).data;
  return url && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL on the API's file host
    <img src={url} alt={alt} className={cn("object-cover", className)} onError={() => setBroken(true)} />
  ) : (
    <span
      className={cn("bg-bg-subtle text-muted flex items-center justify-center", className)}
      aria-hidden={url ? undefined : "true"}
      role={url ? "img" : undefined}
      aria-label={url ? alt : undefined}
    >
      {url ? <Icon name="image" size={20} aria-hidden="true" /> : null}
    </span>
  );
}
