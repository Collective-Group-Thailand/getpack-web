"use client";

import { useState } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";

/**
 * The short form of a request id, for people: `PK-` and its last six characters, upper-cased.
 *
 * The last characters rather than the first: packio-api's ids may be UUIDv7, whose leading
 * characters are a timestamp and barely differ between two requests made the same afternoon.
 * Support finds the request by this suffix; the full id is what the copy button puts on the
 * clipboard, so it is never shown and never has to be read out (UX audit: "ไม่โชว์ UUID").
 */
export function shortReference(id: string): string {
  const compact = id.replace(/[^0-9a-z]/gi, "");
  return `PK-${compact.slice(-6).toUpperCase()}`;
}

export interface ReferenceCodeProps {
  /** The full request id (UUID). Copied, never displayed. */
  id: string;
  /** "รหัสอ้างอิง" — resolved by the caller, which keeps `src/ui` free of i18n. */
  label?: string;
  copyLabel?: string;
  copiedLabel?: string;
  className?: string;
}

/** "รหัสอ้างอิง PK-88F013" with a copy button, shown small beside an error (design-system.md §4). */
export function ReferenceCode({
  id,
  label = "Ref",
  copyLabel = "Copy reference",
  copiedLabel = "Copied",
  className,
}: ReferenceCodeProps) {
  const [copied, setCopied] = useState(false);
  const short = shortReference(id);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${short} (${id})`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an insecure origin, a denied permission): the short code is on screen.
    }
  }

  return (
    <span className={cn("text-muted inline-flex items-center gap-1.5 text-xs", className)}>
      {label} <span className="text-fg font-mono font-medium select-all">{short}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? copiedLabel : copyLabel}
        title={copied ? copiedLabel : copyLabel}
        className="hover:text-fg focus-visible:outline-primary inline-flex size-6 items-center justify-center rounded-md focus-visible:outline-2"
      >
        <Icon name={copied ? "check" : "copy"} size={14} aria-hidden="true" />
      </button>
    </span>
  );
}
