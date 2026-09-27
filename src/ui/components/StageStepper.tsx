import { Icon } from "../icons";
import { cn } from "../lib/cn";

export type StageState = "done" | "current" | "upcoming" | "skipped";

export interface Stage {
  key: string;
  title: React.ReactNode;
  state: StageState;
  /** A short line under the title: "ครบกำหนด 14:00", "ดี 5,120 · เสีย 48". */
  meta?: React.ReactNode;
  /** Shown only under the current stage: its one primary action and what it needs. */
  children?: React.ReactNode;
}

export interface StageStepperProps {
  stages: readonly Stage[];
  label: string;
  /** Spoken state of each stage, from `src/i18n` ("เสร็จแล้ว", "ขั้นปัจจุบัน"…). */
  stateLabels: Record<StageState, string>;
  className?: string;
}

/**
 * A job's milestones on the shop floor (design-system.md §3 "StageStepper (touch)"): every stage
 * in order, done ones ticked, the current one open with its single next action, later ones dim.
 * An ordered list with `aria-current="step"`; state is spoken, not only coloured.
 */
export function StageStepper({ stages, label, stateLabels, className }: StageStepperProps) {
  return (
    <ol aria-label={label} className={cn("flex flex-col", className)}>
      {stages.map((stage, index) => {
        const last = index === stages.length - 1;
        const current = stage.state === "current";
        return (
          <li key={stage.key} aria-current={current ? "step" : undefined} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-base font-semibold",
                  stage.state === "done" && "border-success bg-success text-success-fg",
                  current && "border-primary bg-primary text-primary-fg",
                  stage.state === "upcoming" && "border-border-strong bg-surface text-muted",
                  stage.state === "skipped" && "border-border bg-surface-subtle text-muted",
                )}
              >
                {stage.state === "done" ? <Icon name="check" size={20} /> : index + 1}
              </span>
              {last ? null : (
                <span
                  aria-hidden
                  className={cn("my-1 w-0.5 flex-1", stage.state === "done" ? "bg-success" : "bg-border")}
                />
              )}
            </div>
            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
              <p
                className={cn(
                  "flex min-h-10 flex-wrap items-center gap-x-2 font-medium",
                  stage.state === "upcoming" && "text-muted",
                )}
              >
                <span className={current ? "text-lg" : undefined}>{stage.title}</span>
                <span className="sr-only">{stateLabels[stage.state]}</span>
              </p>
              {stage.meta ? <div className="text-muted text-sm">{stage.meta}</div> : null}
              {current && stage.children ? <div className="mt-3 flex flex-col gap-3">{stage.children}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
