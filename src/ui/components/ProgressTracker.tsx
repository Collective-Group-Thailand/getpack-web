import { Icon } from "../icons";
import { cn } from "../lib/cn";

export type ProgressState = "done" | "current" | "upcoming" | "skipped";

export interface ProgressStage {
  key: string;
  title: React.ReactNode;
  state: ProgressState;
  /** When it happened, or what was promised — formatted by the caller (promised vs actual). */
  time?: React.ReactNode;
  detail?: React.ReactNode;
}

export interface ProgressTrackerProps {
  stages: readonly ProgressStage[];
  /** Accessible name of the list, e.g. "สถานะคำสั่งซื้อ". */
  label: string;
  /** Words for each state, read straight after the stage's title — so start with a separator (" · เสร็จแล้ว"). */
  stateLabels: Record<ProgressState, string>;
  className?: string;
}

/**
 * Where something stands, stage by stage (design-system.md §3 "OrderTracker"): across on a wide
 * screen, down on a narrow one. An ordered list with the current stage marked `aria-current`;
 * each stage says its state in words, so nothing rests on colour or the check mark alone.
 */
export function ProgressTracker({ stages, label, stateLabels, className }: ProgressTrackerProps) {
  return (
    <ol aria-label={label} className={cn("flex flex-col gap-0 md:flex-row", className)}>
      {stages.map((stage, index) => {
        const last = index === stages.length - 1;
        return (
          <li
            key={stage.key}
            aria-current={stage.state === "current" ? "step" : undefined}
            className="relative flex flex-1 gap-3 pb-5 md:flex-col md:gap-2 md:pe-3 md:pb-0"
          >
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute start-[0.875rem] top-8 bottom-0 w-0.5 md:start-8 md:end-0 md:top-[0.875rem] md:bottom-auto md:h-0.5 md:w-auto",
                  stage.state === "done" ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                stage.state === "done" && "border-primary bg-primary text-primary-fg",
                stage.state === "current" && "border-primary bg-surface text-primary ring-primary/20 ring-4",
                stage.state === "upcoming" && "border-border bg-surface text-subtle",
                stage.state === "skipped" && "border-border bg-surface-subtle text-subtle",
              )}
            >
              {stage.state === "done" ? (
                <Icon name="check" size={14} />
              ) : stage.state === "skipped" ? (
                <Icon name="minus" size={14} />
              ) : (
                <span className="text-xs font-semibold">{index + 1}</span>
              )}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-medium",
                  stage.state === "upcoming" && "text-muted",
                  stage.state === "skipped" && "text-muted line-through",
                )}
              >
                {stage.title}
                <span className="sr-only">{stateLabels[stage.state]}</span>
              </p>
              {stage.time ? <p className="text-muted text-xs">{stage.time}</p> : null}
              {stage.detail ? (
                <p className={cn("text-xs", stage.state === "current" ? "text-primary font-medium" : "text-muted")}>
                  {stage.detail}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
