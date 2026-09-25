"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { useFormat } from "@/features/shared/format";

/** "เหลือ 2 ชม. 15 นาที" / "เกิน 45 นาที" — the `format` every `SlaTimer` in the console takes. */
export function useSlaFormat() {
  const t = useTranslations("console.sla");
  const format = useFormat();
  return useCallback(
    (distance: number, overdue: boolean) =>
      t(overdue ? "overdue" : "remaining", { duration: format.duration(distance) }),
    [format, t],
  );
}
