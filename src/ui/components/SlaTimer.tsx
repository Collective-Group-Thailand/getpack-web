"use client";

import { useEffect, useState } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";

export type SlaState = "on_track" | "at_risk" | "breached";

export interface SlaTimerProps {
  /** The deadline the API computed on the business calendar (never computed here). */
  dueAt: string | null;
  /**
   * The API's own judgement, when it sends one. Without it the timer can only say "due" or
   * "overdue" — it does not invent an "at risk" threshold, which would be a business rule.
   */
  state?: SlaState;
  /** "เหลือ 2 ชม. 15 นาที" / "เกิน 45 นาที", given the distance in ms and whether it is past. */
  format: (distanceMs: number, overdue: boolean) => string;
  /** The absolute deadline, for the tooltip and accessible name. */
  absolute?: string;
  /** Shown when there is no deadline. */
  none?: React.ReactNode;
  className?: string;
}

/** Re-renders at most twice a minute: an SLA timer in a queue is minutes, not seconds. */
function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Time left on an SLA (F2 §4 "SLA timers visible in queues"). Text and icon carry the state;
 * colour only reinforces them.
 */
export function SlaTimer({ dueAt, state, format, absolute, none = "—", className }: SlaTimerProps) {
  const now = useNow();
  if (!dueAt) return <span className="text-subtle">{none}</span>;

  const distance = Date.parse(dueAt) - now;
  const overdue = state ? state === "breached" : distance < 0;
  const tone = overdue ? "danger" : state === "at_risk" ? "warning" : "neutral";

  return (
    <span
      title={absolute}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular-nums",
        tone === "danger" && "text-danger",
        tone === "warning" && "text-warning",
        tone === "neutral" && "text-muted",
        className,
      )}
    >
      <Icon name={overdue ? "warning" : "timer"} size={14} />
      {format(distance, overdue)}
    </span>
  );
}
