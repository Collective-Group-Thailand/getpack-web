"use client";

import { useId, useRef, useState } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { useFieldGroupProps } from "./Field";

export interface FileDropzoneLabels {
  /** "ลากไฟล์มาวางที่นี่ หรือ" */
  prompt: string;
  /** "เลือกไฟล์" — the button text. */
  browse: string;
  /** Types and size, e.g. "xlsx ไม่เกิน 10 MB". */
  hint?: string;
  tooLarge: (fileName: string) => string;
  wrongType: (fileName: string) => string;
}

export interface FileDropzoneProps {
  /** An `accept` string: `.xlsx,application/pdf,image/*`. Checked here, and again by the API. */
  accept?: string;
  maxBytes?: number;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  labels: FileDropzoneLabels;
  className?: string;
}

function accepts(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  return accept.split(",").some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule);
    if (rule.endsWith("/*")) return file.type.startsWith(rule.slice(0, -1));
    return file.type === rule;
  });
}

/**
 * Pick or drop files (design-system.md §3 "FileDropzone"). Dragging is never the only way in —
 * the browse button is a real file input (WCAG 2.5.7). Type and size are checked client-side for
 * a fast answer; the presign endpoint is still the authority on what it accepts.
 */
export function FileDropzone({
  accept,
  maxBytes,
  multiple = false,
  disabled,
  onFiles,
  labels,
  className,
}: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const group = useFieldGroupProps();

  function take(list: FileList | null) {
    if (!list) return;
    const problems: string[] = [];
    const ok: File[] = [];
    for (const file of Array.from(list).slice(0, multiple ? undefined : 1)) {
      if (!accepts(file, accept)) problems.push(labels.wrongType(file.name));
      else if (maxBytes && file.size > maxBytes) problems.push(labels.tooLarge(file.name));
      else ok.push(file);
    }
    setErrors(problems);
    if (ok.length > 0) onFiles(ok);
  }

  return (
    <div className={className} {...group}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) take(event.dataTransfer.files);
        }}
        className={cn(
          "border-border-strong flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm",
          dragging && "border-primary bg-primary-subtle/40",
          disabled && "opacity-60",
        )}
      >
        <Icon name="upload" size={24} className="text-muted" />
        <p>
          {labels.prompt}{" "}
          <label
            htmlFor={inputId}
            className="text-primary cursor-pointer font-medium underline-offset-2 hover:underline"
          >
            {labels.browse}
          </label>
        </p>
        {labels.hint ? <p className="text-muted text-xs">{labels.hint}</p> : null}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            take(event.target.files);
            // Choosing the same file twice in a row must still fire a change.
            event.target.value = "";
          }}
        />
      </div>
      {errors.length > 0 ? (
        <div role="alert" className="text-danger mt-2 text-xs font-medium">
          <ul className="space-y-1">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
