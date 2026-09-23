import type { StatusMeta } from "@/domain/status";

import { Badge, type BadgeProps } from "./Badge";

export interface StatusBadgeProps extends Omit<BadgeProps, "tone" | "icon" | "children"> {
  /** From `src/domain/status` — never a locally built object. */
  meta: StatusMeta;
  /**
   * The translated label. The caller resolves `meta.labelKey` through `useTranslations`,
   * which keeps this component free of i18n and usable in Storybook and in exports.
   */
  label: React.ReactNode;
}

/**
 * A status, rendered the one way the product renders statuses: tone, icon and words together
 * (design-system.md §2 — never colour alone).
 *
 * It takes a `StatusMeta` rather than a status string so the mapping stays in `src/domain`,
 * where the contract enum makes it exhaustive.
 */
export function StatusBadge({ meta, label, ...props }: StatusBadgeProps) {
  return (
    <Badge tone={meta.tone} icon={meta.icon} {...props}>
      {label}
    </Badge>
  );
}
