"use client";

import { useTranslations } from "next-intl";

import { statusMeta, type StatusMeta } from "@/domain/status";
import { StatusBadge } from "@/ui/components/StatusBadge";

/**
 * The shared status chip, said to the factory reading it. Every zone shares one wording per status
 * (`status` namespace) — but a few name the factory in the third person ("รอโรงงานรับงาน"), which
 * the owner reads as someone else's job. Those few have a second-person line in
 * `partner.status.<labelKey>` ("รอคุณรับงาน"); every other status keeps the shared words.
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
  const tFactory = useTranslations("partner.status");
  const meta = statusMeta(map, value);
  const label = tFactory.has(meta.labelKey) ? tFactory(meta.labelKey) : t(meta.labelKey);
  return <StatusBadge size={size} meta={meta} label={label} />;
}
