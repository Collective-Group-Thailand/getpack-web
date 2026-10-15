"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { Button } from "@/ui/components/Button";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { problemMessage } from "../console";
import { NONE } from "./form-model";

type Purpose = "image" | "document" | "design_asset";

/**
 * What an upload is kept as (D-415): a published picture as `image` (standard retention), a font
 * or SVG as `design_asset`, anything else — a PDF — as `document`. A signed or legal file passes
 * `purpose="document"` so it keeps the financial-record retention.
 */
export function purposeOf(file: File): Purpose {
  if (/^image\/(png|jpeg|webp)$/.test(file.type)) return "image";
  if (file.type.startsWith("font/") || /\.(ttf|otf|woff2?)$/i.test(file.name) || file.type === "image/svg+xml")
    return "design_asset";
  return "document";
}

/** A file reference field: the current file's id, a way to clear it, and an upload that sets it. */
export function FileField({
  value,
  onChange,
  purpose,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  purpose?: Purpose;
}) {
  const t = useTranslations("catalogue.file");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      {typeof value === "string" && value && value !== NONE ? (
        <p className="flex items-center gap-2 text-sm">
          <Icon name="paperclip" size={16} />
          <span className="font-mono text-xs">{value.slice(0, 8)}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
            {t("remove")}
          </Button>
        </p>
      ) : null}
      <FileDropzone
        accept="image/*,application/pdf,font/*,.ttf,.otf,.woff2"
        maxBytes={20 * 1024 * 1024}
        disabled={busy}
        onFiles={async ([file]) => {
          if (!file) return;
          setBusy(true);
          try {
            onChange((await uploadFile("admin", file, purpose ?? purposeOf(file))).id);
            toast.success(t("uploaded", { name: file.name }));
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
          } finally {
            setBusy(false);
          }
        }}
        labels={{
          prompt: busy ? t("uploading") : t("drop"),
          browse: t("browse"),
          tooLarge: (name) => t("tooLarge", { name }),
          wrongType: (name) => t("wrongType", { name }),
        }}
      />
    </div>
  );
}
