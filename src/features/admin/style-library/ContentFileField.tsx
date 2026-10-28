"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { Button } from "@/ui/components/Button";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { FileImage } from "../catalogue/FileImage";
import { problemMessage } from "../console";
import {
  DOCUMENT_PREFIX,
  documentPath,
  type DocumentSource,
  documentSourceOf,
  fileIdOf,
  IMAGE_PREFIX,
  imagePath,
} from "./content-form";

const MiB = 1024 * 1024;
const PICTURES = "image/png,image/jpeg,image/webp";
const DOCUMENTS = `application/pdf,${PICTURES}`;

/** A labelled group around a composite control, with the same label / hint / error layout as `Field`. */
function Slot({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={[error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined}
      className="flex min-w-0 flex-col gap-1.5"
    >
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="text-danger ms-1" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-danger text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The file the field holds: its name when uploaded in this session, else the short id the API gave it. */
function FileName({ fileId, name }: { fileId: string; name: string | undefined }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <Icon name="paperclip" size={16} aria-hidden="true" className="text-muted shrink-0" />
      <span className="truncate">{name ?? <span className="tabular-nums">{fileId.slice(0, 8)}</span>}</span>
    </span>
  );
}

/**
 * C1e (DECISIONS-STAGE-A §13.3): a picture of the trust section — production photo, customer logo —
 * uploaded through the file service (purpose `image`, PNG / JPEG / WebP) and stored as its public
 * path; the storefront serves it only while the published content references it. No typed links.
 */
export function ContentImageField({
  value,
  onChange,
  label,
  alt,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  alt: string;
  error?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("styleLibrary.content.files");
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const fileId = fileIdOf(value, IMAGE_PREFIX);
  return (
    <Slot label={label} hint={t("imageHint")} error={error} required>
      {fileId ? (
        <div className="flex items-center gap-3" data-file={fileId}>
          <FileImage fileId={fileId} alt={alt} className="h-16 w-24 shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-col gap-1">
            <FileName fileId={fileId} name={names[fileId]} />
            {!disabled ? (
              <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => onChange("")}>
                {t("removeImage")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : value.trim() ? (
        // A link typed before C1e: shown so staff know to replace it with an upload.
        <p className="text-warning text-xs break-all">{t("legacyLink", { url: value })}</p>
      ) : null}
      {!disabled && !fileId ? (
        <FileDropzone
          accept={PICTURES}
          maxBytes={20 * MiB}
          disabled={busy}
          onFiles={async ([file]) => {
            if (!file) return;
            setBusy(true);
            try {
              const uploaded = await uploadFile("admin", file, "image");
              setNames((n) => ({ ...n, [uploaded.id]: file.name }));
              onChange(imagePath(uploaded.id));
            } catch (e) {
              toast.error(problemMessage(e, t("failed")));
            } finally {
              setBusy(false);
            }
          }}
          labels={{
            prompt: busy ? t("uploading") : t("dropImage"),
            browse: t("browse"),
            tooLarge: (name) => t("tooLarge", { name, mb: 20 }),
            wrongType: (name) => t("wrongTypeImage", { name }),
          }}
        />
      ) : null}
    </Slot>
  );
}

/**
 * C1e (§13.3): a certificate or food-grade document — an uploaded file (PDF, or a picture of it)
 * served by `store.styleLibrary.getDocument` while published, or, for documents only, an external
 * https link. Optional. C1f (§14.3, D-451): a PDF goes up as purpose `published_document`, whose
 * metadata the API strips like a published picture's; a picture as `image`.
 */
export function ContentDocumentField({
  value,
  onChange,
  label,
  error,
  disabled,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  error?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("styleLibrary.content.files");
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [source, setSource] = useState<DocumentSource>(() => documentSourceOf(value));
  const fileId = fileIdOf(value, DOCUMENT_PREFIX);
  const choose = (next: DocumentSource) => {
    if (next === source) return;
    setSource(next);
    // Switching drops what the other way held: a file is not a link, and the reverse.
    onChange(null);
  };
  return (
    <Slot label={label} hint={source === "link" ? t("linkHint") : t("documentHint")} error={error}>
      {!disabled ? (
        <SegmentedControl
          label={t("sourceLabel")}
          options={[
            { value: "file", label: t("sourceFile") },
            { value: "link", label: t("sourceLink") },
          ]}
          value={source}
          onValueChange={choose}
        />
      ) : null}
      {source === "link" ? (
        <Input
          type="url"
          inputMode="url"
          aria-label={t("linkLabel")}
          placeholder={t("linkPlaceholder")}
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
        />
      ) : fileId ? (
        <div className="flex flex-wrap items-center gap-2" data-file={fileId}>
          <FileName fileId={fileId} name={names[fileId]} />
          {!disabled ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
              {t("removeDocument")}
            </Button>
          ) : null}
        </div>
      ) : !disabled ? (
        <FileDropzone
          accept={DOCUMENTS}
          maxBytes={50 * MiB}
          disabled={busy}
          onFiles={async ([file]) => {
            if (!file) return;
            setBusy(true);
            try {
              const purpose = file.type === "application/pdf" ? "published_document" : "image";
              const uploaded = await uploadFile("admin", file, purpose);
              setNames((n) => ({ ...n, [uploaded.id]: file.name }));
              onChange(documentPath(uploaded.id));
            } catch (e) {
              toast.error(problemMessage(e, t("failed")));
            } finally {
              setBusy(false);
            }
          }}
          labels={{
            prompt: busy ? t("uploading") : t("dropDocument"),
            browse: t("browse"),
            tooLarge: (name) => t("tooLarge", { name, mb: 50 }),
            wrongType: (name) => t("wrongTypeDocument", { name }),
          }}
        />
      ) : (
        <p className="text-muted text-sm">{t("none")}</p>
      )}
    </Slot>
  );
}
