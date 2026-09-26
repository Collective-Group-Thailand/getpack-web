"use client";

import { useTranslations } from "next-intl";

import { statusMeta, type StatusMeta } from "@/domain/status";
import { StatusBadge } from "@/ui/components/StatusBadge";

/**
 * A status from `src/domain/status`, labelled from the shared `status` namespace — the one way a
 * back-office screen shows one. A value the map does not know renders as "unknown" rather than
 * crashing or going blank.
 */
export function StatusChip<T extends string>({
  map,
  value,
  size = "sm",
}: {
  map: Record<T, StatusMeta>;
  value: string;
  size?: "sm" | "md";
}) {
  const t = useTranslations("status");
  const meta = statusMeta(map, value);
  return <StatusBadge size={size} meta={meta} label={t(meta.labelKey)} />;
}
