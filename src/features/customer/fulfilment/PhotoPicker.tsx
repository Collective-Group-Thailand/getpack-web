"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { uploadFile, type FilePurpose } from "@/features/shared/files/upload";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { IconButton } from "@/ui/components/IconButton";
import { Icon } from "@/ui/icons";

export interface PickedPhoto {
  key: string;
  name: string;
  preview: string;
  fileId?: string;
  failed?: boolean;
}

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());

/**
 * Evidence photos for a claim (D-082): each uploads as it is added (with the purpose the claim form
 * names, `evidence`), shows a
 * preview from the device, and can be removed. The parent reads the uploaded ids.
 */
export function PhotoPicker({
  id,
  accept,
  maxBytes,
  max,
  purpose = "evidence",
  photos,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  accept: string;
  maxBytes: number;
  max: number;
  /** The purpose to presign with, as the claim form names it (one of the API's `FilePurpose`s). */
  purpose?: string;
  photos: PickedPhoto[];
  onChange: (update: (current: PickedPhoto[]) => PickedPhoto[]) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("fulfilment.photos");
  useEffect(() => () => photos.forEach((photo) => URL.revokeObjectURL(photo.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(files: File[]) {
    for (const file of files.slice(0, Math.max(0, max - photos.length))) {
      const entry: PickedPhoto = { key: newKey(), name: file.name, preview: URL.createObjectURL(file) };
      onChange((current) => [...current, entry]);
      try {
        const uploaded = await uploadFile("customer", file, purpose as FilePurpose);
        onChange((current) =>
          current.map((item) => (item.key === entry.key ? { ...item, fileId: uploaded.id } : item)),
        );
      } catch {
        onChange((current) => current.map((item) => (item.key === entry.key ? { ...item, failed: true } : item)));
      }
    }
  }

  return (
    <div id={id} className="flex flex-col gap-2" aria-invalid={invalid || undefined} aria-describedby={describedBy}>
      <FileDropzone
        multiple
        accept={accept}
        maxBytes={maxBytes}
        disabled={photos.length >= max}
        onFiles={(files) => void add(files)}
        labels={{
          prompt: t("drop"),
          browse: t("browse"),
          hint: t("hint", { max }),
          tooLarge: (name) => t("tooLarge", { name }),
          wrongType: (name) => t("wrongType", { name }),
        }}
      />
      {photos.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t("added")}>
          {photos.map((photo) => (
            <li key={photo.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (object URL) */}
              <img
                src={photo.preview}
                alt={photo.name}
                className={`size-20 rounded object-cover ${photo.failed ? "opacity-40" : ""}`}
              />
              <span className="bg-surface/90 absolute start-1 bottom-1 rounded px-1 text-[10px]" aria-live="polite">
                {photo.failed ? (
                  t("failed")
                ) : photo.fileId ? (
                  <Icon name="check" size={12} label={t("uploaded")} />
                ) : (
                  t("uploading")
                )}
              </span>
              <IconButton
                name="close"
                size="sm"
                variant="secondary"
                className="absolute -end-2 -top-2"
                label={t("remove", { name: photo.name })}
                onClick={() => onChange((current) => current.filter((item) => item.key !== photo.key))}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
