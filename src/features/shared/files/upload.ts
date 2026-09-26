"use client";

import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import type { Zone } from "@/lib/zones";

export type UploadedFile = Schemas["FileDto"];
export type FilePurpose = Schemas["FilePurpose"];

/**
 * The file flow of api-conventions §3, for every zone: presign → PUT to storage → complete.
 *
 * The browser talks to object storage directly with the presigned URL (the BFF's 1 MB body cap
 * is for JSON, not artwork), so the only things that cross the BFF are the two small JSON calls.
 * Large files come back as multipart: each part is PUT and its `ETag` collected for `complete`.
 * `onProgress` reports bytes, for a progress bar.
 */
export async function uploadFile(
  zone: Zone,
  file: File,
  purpose: FilePurpose,
  options: { onProgress?: (sent: number, total: number) => void; signal?: AbortSignal; factoryId?: string } = {},
): Promise<UploadedFile> {
  const api = browserApi();
  const body: Schemas["PresignFileDto"] = {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    purpose,
    ...(options.factoryId ? { factoryId: options.factoryId } : {}),
  };

  const presigned =
    zone === "admin"
      ? (await api.POST("/v1/admin/files/presign", { body })).data
      : zone === "partner"
        ? (await api.POST("/v1/partner/files/presign", { body })).data
        : (await api.POST("/v1/store/files/presign", { body })).data;
  if (!presigned) throw new Error("presign returned no body");

  const headers = presigned.headers as Record<string, string>;
  let parts: Schemas["CompletedPartDto"][] | undefined;

  if (presigned.multipart) {
    parts = [];
    const { partSize } = presigned.multipart;
    for (const part of presigned.multipart.parts) {
      const start = (part.partNumber - 1) * partSize;
      const response = await fetch(part.url, {
        method: "PUT",
        body: file.slice(start, start + partSize),
        signal: options.signal,
      });
      if (!response.ok) throw new Error(`upload part ${part.partNumber} failed with ${response.status}`);
      parts.push({ partNumber: part.partNumber, etag: response.headers.get("etag") ?? "" });
      options.onProgress?.(Math.min(file.size, start + partSize), file.size);
    }
  } else if (presigned.uploadUrl) {
    const response = await fetch(presigned.uploadUrl, { method: "PUT", body: file, headers, signal: options.signal });
    if (!response.ok) throw new Error(`upload failed with ${response.status}`);
    options.onProgress?.(file.size, file.size);
  }

  const path = { params: { path: { fileId: presigned.fileId } }, body: parts ? { parts } : {} };
  const completed =
    zone === "admin"
      ? (await api.POST("/v1/admin/files/{fileId}/actions/complete", path)).data
      : zone === "partner"
        ? (await api.POST("/v1/partner/files/{fileId}/actions/complete", path)).data
        : (await api.POST("/v1/store/files/{fileId}/actions/complete", path)).data;
  if (!completed) throw new Error("complete returned no body");
  return completed;
}
