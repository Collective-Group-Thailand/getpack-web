"use client";

import type { ProgressState } from "@/ui/components/ProgressTracker";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export interface StageListItem {
  key: string;
  label: string;
  state: ProgressState;
}

/**
 * A record's stages down a rail card — done, the current one, what is still to come — each saying
 * its state in words as well as by its mark (UX audit: the order's and the RFQ's five-step rails).
 */
export function StageList({
  title,
  stages,
  stateLabels,
}: {
  title: string;
  stages: readonly StageListItem[];
  stateLabels: Record<ProgressState, string>;
}) {
  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <ol className="flex flex-col">
        {stages.map((stage, index) => (
          <li
            key={stage.key}
            className="relative flex gap-3 pb-4 last:pb-0"
            aria-current={stage.state === "current" ? "step" : undefined}
          >
            {index < stages.length - 1 ? (
              <span aria-hidden="true" className="bg-border absolute start-[0.6875rem] top-6 bottom-0 w-px" />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative grid size-6 shrink-0 place-items-center rounded-full border-2",
                stage.state === "done" && "border-primary bg-primary text-primary-fg",
                stage.state === "current" && "border-warning bg-surface",
                (stage.state === "upcoming" || stage.state === "skipped") && "border-border-strong bg-surface",
              )}
            >
              {stage.state === "done" ? <Icon name="check" size={12} /> : null}
              {stage.state === "current" ? <span className="bg-warning size-2.5 rounded-full" /> : null}
            </span>
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", stage.state === "upcoming" && "text-muted")}>{stage.label}</p>
              <p className="text-muted text-xs">{stateLabels[stage.state]}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
