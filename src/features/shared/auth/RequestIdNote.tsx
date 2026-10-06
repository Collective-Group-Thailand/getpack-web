"use client";

import { useTranslations } from "next-intl";

import { ReferenceCode } from "@/ui/components/ReferenceCode";

/**
 * The request id beside an error, so support can trace it: a short reference (`PK-88F013`) and a
 * copy button that carries the full id (design-system.md §4; UX audit: never show the UUID).
 */
export function RequestIdNote({ requestId }: { requestId: string }) {
  const t = useTranslations("common");

  return (
    <ReferenceCode
      id={requestId}
      label={t("errors.reference")}
      copyLabel={t("errors.copyReference")}
      copiedLabel={t("errors.referenceCopied")}
      className="mt-1 flex"
    />
  );
}
