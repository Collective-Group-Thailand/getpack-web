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

/** A file reference field: the current file's id, a way to clear it, and an upload that sets it. */
export function FileField({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
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
            // The contract names no image purpose yet; `document` is the closest (open question).
            onChange((await uploadFile("admin", file, "document")).id);
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
