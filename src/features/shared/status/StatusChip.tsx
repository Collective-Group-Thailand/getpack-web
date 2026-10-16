"use client";

import { useTranslations } from "next-intl";

import { statusMeta, type StatusMeta } from "@/domain/status";
import { useZone } from "@/features/shared/zone";
import { StatusBadge } from "@/ui/components/StatusBadge";

/**
 * A status from `src/domain/status`, labelled from the shared `status` namespace — the one way any
 * zone shows one, so a customer and the CS agent read the same words for the same row. The few
 * labels written from the desk's side ("awaiting customer", "Proof") have a customer reading under
 * `status.customer.*`, used in the customer zone (glossary §4.5: customers read แบบตัวอย่าง). A
 * value the map does not know renders as "unknown" rather than crashing or going blank.
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
  const zone = useZone();
  const meta = statusMeta(map, value);
  const customerKey = `customer.${meta.labelKey}`;
  const label = zone === "customer" && t.has(customerKey) ? t(customerKey) : t(meta.labelKey);
  return <StatusBadge size={size} meta={meta} label={label} />;
}
