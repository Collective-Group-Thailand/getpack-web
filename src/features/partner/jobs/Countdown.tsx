"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { cn } from "@/ui/lib/cn";

/**
 * Time left to accept a job (D-074: one business day, computed by the API) — "รับงานภายใน 3 ชม.
 * 12 นาที", or how long ago it ran out. Large on the job screen, where it decides what to do.
 */
export function Countdown({ dueAt, large = false }: { dueAt: string | null; large?: boolean }) {
  const t = useTranslations("partnerJobs.countdown");
  const format = useFormat();
  return (
    <SlaTimer
      dueAt={dueAt}
      absolute={dueAt ? format.dateTime(dueAt) : undefined}
      format={(distance, overdue) => t(overdue ? "overdue" : "left", { duration: format.duration(distance) })}
      className={cn(large && "text-base")}
    />
  );
}
