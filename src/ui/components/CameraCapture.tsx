"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "../icons";
import { exifDateTimeOriginal, exifToIso } from "../lib/exif";
import { cn } from "../lib/cn";

export interface CapturedPhoto {
  id: string;
  /** The compressed JPEG, ready to upload. */
  file: File;
  /** When the shutter fired: EXIF `DateTimeOriginal`, else the file's `lastModified` (Bangkok). */
  capturedAt: string;
  previewUrl: string;
}

export interface CameraCaptureLabels {
  /** The button that opens the camera: "ถ่ายรูป". */
  take: string;
  /** Once there is a photo: "ถ่ายเพิ่ม". */
  more: string;
  /** A thumbnail's alt text: "รูปที่ 2". */
  photo: (index: number) => string;
  remove: (index: number) => string;
  /** "3 รูป", for the live region. */
  count: (count: number) => string;
  processing: string;
}

export interface CameraCaptureProps {
  photos: CapturedPhoto[];
  onChange: (photos: CapturedPhoto[]) => void;
  labels: CameraCaptureLabels;
  max?: number;
  /** The longest edge after compression, in pixels. */
  maxEdge?: number;
  disabled?: boolean;
  className?: string;
}

const bangkokIso = (ms: number) => `${new Date(ms + 7 * 3_600_000).toISOString().slice(0, 19)}+07:00`;

/**
 * Downscales a photo to a JPEG whose longest edge is `maxEdge`. A phone camera's 12 MP original is
 * 4–6 MB; at 1600 px it is ~300 KB, which matters on the shop floor's 4G. Where the browser cannot
 * draw it (no canvas, an unsupported format), the original is kept — evidence over bytes.
 */
async function compress(file: File, maxEdge: number): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

/**
 * Multi-shot photo evidence from the phone's camera (design-system.md §3 "CameraCapture"): the
 * rear camera opens straight away (`capture="environment"`), each shot is compressed in the
 * browser and keeps the time it was taken, and thumbnails can be removed before anything is
 * uploaded. A plain file input underneath, so a tablet without a camera can pick files instead.
 */
export function CameraCapture({
  photos,
  onChange,
  labels,
  max = 10,
  maxEdge = 1600,
  disabled = false,
  className,
}: CameraCaptureProps) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);

  // Object URLs are released when the component goes away; removed ones are released on removal.
  useEffect(() => () => latest.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), []);

  async function take(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const room = Math.max(0, max - photos.length);
    const added: CapturedPhoto[] = [];
    for (const original of [...files].slice(0, room)) {
      const head = new Uint8Array(await original.slice(0, 128 * 1024).arrayBuffer());
      const exif = exifDateTimeOriginal(head);
      const file = await compress(original, maxEdge);
      added.push({
        id: `${original.name}-${original.lastModified}-${added.length}-${photos.length}`,
        file,
        capturedAt: exif ? exifToIso(exif) : bangkokIso(original.lastModified || Date.now()),
        previewUrl: URL.createObjectURL(file),
      });
    }
    onChange([...photos, ...added]);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {photos.length ? (
        <ul className="grid grid-cols-3 gap-2 md:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset */}
              <img
                src={photo.previewUrl}
                alt={labels.photo(index + 1)}
                className="aspect-square w-full rounded-lg object-cover"
              />
              <button
                type="button"
                aria-label={labels.remove(index + 1)}
                onClick={() => {
                  URL.revokeObjectURL(photo.previewUrl);
                  onChange(photos.filter((item) => item.id !== photo.id));
                }}
                className="bg-surface text-fg absolute end-1 top-1 flex size-12 items-center justify-center rounded-full shadow"
              >
                <Icon name="close" size={20} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {busy ? labels.processing : labels.count(photos.length)}
      </p>
      <label
        htmlFor={id}
        className={cn(
          "border-border-strong bg-surface hover:bg-surface-subtle flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-base font-medium",
          (disabled || photos.length >= max) && "pointer-events-none opacity-50",
        )}
      >
        <Icon name={busy ? "spinner" : "image"} size={20} className={busy ? "animate-spin" : undefined} />
        {busy ? labels.processing : photos.length ? labels.more : labels.take}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        disabled={disabled || photos.length >= max}
        className="sr-only"
        onChange={(event) => void take(event.target.files)}
      />
    </div>
  );
}
