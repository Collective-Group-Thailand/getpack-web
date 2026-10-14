"use client";

import { useId, useRef } from "react";

import { Button, type ButtonProps } from "@/ui/components/Button";
import type { IconName } from "@/ui/icons";

/**
 * A button that opens the file picker (or the camera on a phone with `capture`), in the app's own words — the
 * browser's bare "Choose Files / No file chosen" is English and unstyled. The chosen files go to `onFiles`.
 */
export function FilePickButton({
  label,
  accept,
  multiple = false,
  capture,
  disabled,
  loading,
  icon = "upload",
  variant = "secondary",
  onFiles,
}: {
  label: string;
  accept?: string;
  multiple?: boolean;
  capture?: "environment" | "user";
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  variant?: ButtonProps["variant"];
  onFiles: (files: File[]) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        id={id}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        accept={accept}
        multiple={multiple}
        {...(capture ? { capture } : {})}
        disabled={disabled}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <Button type="button" variant={variant} iconStart={icon} disabled={disabled} loading={loading} onClick={() => input.current?.click()}>
        {label}
      </Button>
    </>
  );
}
