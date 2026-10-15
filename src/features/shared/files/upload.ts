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
 * A part that fails is sent again (three tries, backing off) rather than the whole file — on a
 * phone connection that drops for a moment, a 200 MB artwork file resumes at the part it lost.
 * `onProgress` reports bytes, for a progress bar.
 */
const ATTEMPTS = 3;

async function putWithRetry(url: string, body: Blob, init: { headers?: Record<string, string>; signal?: AbortSignal }) {
  let last: unknown;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (init.signal?.aborted) throw new DOMException("aborted", "AbortError");
    try {
      const response = await fetch(url, { method: "PUT", body, headers: init.headers, signal: init.signal });
      if (response.ok) return response;
      // A client error will not get better by trying again.
      if (response.status < 500 && response.status !== 408 && response.status !== 429)
        throw new Error(`upload failed with ${response.status}`);
      last = new Error(`upload failed with ${response.status}`);
    } catch (error) {
      if ((error as Error).name === "AbortError" || /failed with 4/.test(String((error as Error).message))) throw error;
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
  }
  throw last instanceof Error ? last : new Error("upload failed");
}

export async function uploadFile(
  zone: Zone,
  file: File,
  purpose: FilePurpose,
  options: {
    onProgress?: (sent: number, total: number) => void;
    signal?: AbortSignal;
    factoryId?: string;
    /** A file uploaded for a B2B company (its brand assets, D-227). */
    companyId?: string;
    /**
     * Return only once the API has scanned the file (the default). Every call that *uses* a file
     * — a message attachment, a slip, a render — is refused with `file.not_ready` until then, and
     * the scan runs in the worker a moment after `complete`; waiting here is what every caller
     * would otherwise have to do itself. `false` returns right after `complete`, for a caller
     * that only stores the id for later.
     */
    waitForScan?: boolean;
  } = {},
): Promise<UploadedFile> {
  const api = browserApi();
  const body: Schemas["PresignFileDto"] = {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    purpose,
    ...(options.factoryId ? { factoryId: options.factoryId } : {}),
    ...(options.companyId ? { companyId: options.companyId } : {}),
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
      const response = await putWithRetry(part.url, file.slice(start, start + partSize), { signal: options.signal });
      parts.push({ partNumber: part.partNumber, etag: response.headers.get("etag") ?? "" });
      options.onProgress?.(Math.min(file.size, start + partSize), file.size);
    }
  } else if (presigned.uploadUrl) {
    await putWithRetry(presigned.uploadUrl, file, { headers, signal: options.signal });
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
  if (options.waitForScan === false || completed.scanStatus === "clean" || completed.scanStatus === "skipped")
    return completed;
  return waitUntilScanned(zone, completed.id, { signal: options.signal });
}

/**
 * Waits until the API has scanned an uploaded file. `complete` only *queues* the malware scan
 * (api-conventions §3); anything that then *uses* the file — a studio render, a print job — is
 * refused with `file.not_ready` until the worker marks it `clean`. Polls the file every half
 * second, up to `timeoutMs`; an infected file throws, so the caller never retries over it.
 */
export async function waitUntilScanned(
  zone: Zone,
  fileId: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<UploadedFile> {
  const api = browserApi();
  const deadline = Date.now() + (options.timeoutMs ?? 60_000);
  const read = async () => {
    const path = { params: { path: { fileId } } };
    const { data } =
      zone === "admin"
        ? await api.GET("/v1/admin/files/{fileId}", path)
        : zone === "partner"
          ? await api.GET("/v1/partner/files/{fileId}", path)
          : await api.GET("/v1/store/files/{fileId}", path);
    if (!data) throw new Error("file read returned no body");
    return data;
  };
  for (;;) {
    if (options.signal?.aborted) throw new DOMException("aborted", "AbortError");
    const file = await read();
    // `skipped` is a deployment with no scanner: the file is as ready as it will ever be.
    if (file.scanStatus === "clean" || file.scanStatus === "skipped") return file;
    if (file.scanStatus !== "pending") throw new Error(`file ${fileId} is ${file.scanStatus}`);
    if (Date.now() >= deadline) throw new Error(`file ${fileId} was not scanned in time`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
