import type { IconName } from "@/ui/icons";

/**
 * Status presentation, single-sourced (CLAUDE.md: "Status labels/tones/icons only from
 * `src/domain/status`").
 *
 * A status is never rendered from a colour alone (design-system.md §2) — every entry carries a
 * tone, an icon *and* a translation key, so it reads in greyscale, under a screen reader, and
 * in the high-contrast theme.
 */

/** The six semantic tones the token set defines. */
export type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export interface StatusMeta {
  tone: StatusTone;
  icon: IconName;
  /**
   * Key inside the `status` message namespace, e.g. `order.awaitingPayment`. A key rather than
   * a string, because the same status is rendered in Thai to a customer and in English in an
   * export from the same map.
   */
  labelKey: string;
  /** Optional one-line explanation key, for a "?" popover beside the badge. */
  descriptionKey?: string;
}

/**
 * Builds a status map that the compiler checks for completeness.
 *
 * In F1 the type argument becomes a generated contract enum —
 * `defineStatusMap<Schemas["OrderStatus"]>({ … })` — and a new value on the backend then fails
 * the frontend build until it has a tone, an icon and a label (00-master-plan.md §5). Until
 * `src/lib/api/schema.d.ts` exists, callers pass their own string union, which gives the same
 * exhaustiveness guarantee against a hand-written union.
 */
export function defineStatusMap<TStatus extends string>(map: Record<TStatus, StatusMeta>): Record<TStatus, StatusMeta> {
  return map;
}

/** Falls back visibly rather than crashing when the API sends a status the UI has not met. */
export const UNKNOWN_STATUS: StatusMeta = {
  tone: "neutral",
  icon: "help",
  labelKey: "unknown",
};

export function statusMeta<TStatus extends string>(map: Record<TStatus, StatusMeta>, status: string): StatusMeta {
  return (map as Record<string, StatusMeta | undefined>)[status] ?? UNKNOWN_STATUS;
}
