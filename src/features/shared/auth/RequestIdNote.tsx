"use client";

import { useTranslations } from "next-intl";

/**
 * The request id, shown small beside an error so support can trace it.
 *
 * design-system.md §4: "error codes shown small for support". It is selectable text rather
 * than a copy button because someone reading it out on the phone is the common case.
 */
export function RequestIdNote({ requestId }: { requestId: string }) {
  const t = useTranslations("common");

  return (
    <span className="text-muted mt-1 block font-mono text-xs">
      {t("errors.requestId")}: <span className="select-all">{requestId}</span>
    </span>
  );
}
