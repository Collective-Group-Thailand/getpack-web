"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export interface UploadProgress {
  key: string;
  name: string;
  sent: number;
  total: number;
  failed?: string | null;
}

/**
 * The drop zone (upload redesign Phase 1 item 2): the whole card takes files — dropped, or chosen with the
 * keyboard (Enter / Space on the card) or the button; several at once, each one variant of the same order. Only PDF
 * and AI, within the size the API checks automatically; progress per file while it uploads (resumable parts,
 * `uploadFile`). Imports from cloud drives, links and e-mail are not offered until their accounts exist (C9 report).
 */
export function DropZone({
  maxBytes,
  onFiles,
  uploads,
  compact = false,
}: {
  maxBytes: number | null;
  onFiles: (files: File[], source: "drop" | "picker") => void;
  uploads: UploadProgress[];
  compact?: boolean;
}) {
  const t = useTranslations("studio.upload.drop");
  const format = useFormat();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const open = () => input.current?.click();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("aria")}
      onClick={open}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const files = [...event.dataTransfer.files];
        if (files.length) onFiles(files, "drop");
      }}
      className={cn(
        "rounded-card bg-surface focus-visible:ring-focus-ring grid cursor-pointer place-items-center border-2 border-dashed px-6 py-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        compact ? "min-h-0" : "min-h-[21rem]",
        over ? "border-primary bg-primary-subtle" : "border-border-strong hover:border-primary",
      )}
    >
      <div className="max-w-[34rem]">
        <span className="bg-primary-subtle text-primary rounded-card mx-auto mb-4 grid size-16 place-items-center">
          <Icon name="upload" size={30} aria-hidden="true" />
        </span>
        <h2 className="text-[1.375rem] leading-tight font-semibold">{t("title")}</h2>
        <p className="text-muted mt-2 text-[0.90625rem]">{t("body")}</p>
        <p className="mt-4 flex flex-wrap justify-center gap-1.5 text-xs">
          {["PDF", "PDF/X-4", "AI"].map((type) => (
            <span key={type} className="bg-bg-subtle text-muted rounded-control px-2.5 py-1 font-medium">
              {type}
            </span>
          ))}
          {maxBytes ? (
            <span className="bg-bg-subtle text-muted rounded-control px-2.5 py-1 font-medium tabular-nums">
              {t("max", { size: format.bytes(maxBytes) })}
            </span>
          ) : null}
        </p>
        <div className="mt-5 flex justify-center">
          <Button
            iconStart="document"
            onClick={(event) => {
              event.stopPropagation();
              open();
            }}
            tabIndex={-1}
          >
            {t("choose")}
          </Button>
        </div>
        {uploads.length ? (
          <ul className="mt-5 grid gap-2 text-start text-sm" aria-live="polite">
            {uploads.map((upload) => {
              const pct = upload.total ? Math.round((upload.sent / upload.total) * 100) : 0;
              return (
                <li key={upload.key} className="grid gap-1">
                  <span className="flex justify-between gap-3">
                    <span className="truncate">{upload.name}</span>
                    <span className={cn("tabular-nums", upload.failed ? "text-danger" : "text-muted")}>
                      {upload.failed ?? t("progress", { pct })}
                    </span>
                  </span>
                  <span className="bg-bg-subtle block h-1.5 overflow-hidden">
                    <span
                      className={cn("block h-full", upload.failed ? "bg-danger" : "bg-primary")}
                      style={{ width: `${upload.failed ? 100 : pct}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        <p className="text-muted mt-5 flex items-center justify-center gap-1.5 text-xs">
          <Icon name="lock" size={14} aria-hidden="true" />
          {t("privacy")}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept=".pdf,.ai,application/pdf,application/postscript,application/illustrator"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length) onFiles(files, "picker");
        }}
      />
    </div>
  );
}
