"use client";

import { useId } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";

export type StepStatus = "complete" | "current" | "upcoming" | "error";

export interface StepperStep {
  id: string;
  label: React.ReactNode;
  /** The answer so far, shown under the label once there is one ("กล่องฝาเสียบ · 120 × 80 × 60 มม."). */
  summary?: React.ReactNode;
  status: StepStatus;
  /** Rendered while the step is open. */
  content: React.ReactNode;
}

export interface StepperLabels {
  /** "เสร็จแล้ว" — announced after a complete step's label. */
  complete: string;
  /** "ต้องแก้ไข" — announced after a step with an error. */
  error: string;
  /** "ขั้นที่ 2 จาก 7". */
  stepOf: (index: number, total: number) => string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** The open step. */
  current: string;
  onSelect: (id: string) => void;
  labels: StepperLabels;
  /** Accessible name of the list. */
  "aria-label": string;
  className?: string;
}

/**
 * A vertical stepper whose steps are also an accordion (design-system.md §3 "Stepper"): the
 * configurator's size → material → printing → … → quantity, one open at a time, each closed step
 * showing its answer so the whole configuration reads top to bottom.
 *
 * Every step can be reopened from its header — the order guides, it does not lock — because a
 * customer comparing materials should not have to walk back through three screens. Each header
 * is a button with `aria-expanded`, and the open step is `aria-current="step"`; status is an
 * icon **and** words, never colour alone.
 */
export function Stepper({ steps, current, onSelect, labels, className, ...props }: StepperProps) {
  const baseId = useId();

  return (
    <ol aria-label={props["aria-label"]} className={cn("flex flex-col", className)}>
      {steps.map((step, index) => {
        const open = step.id === current;
        const headerId = `${baseId}-${step.id}-header`;
        const panelId = `${baseId}-${step.id}-panel`;
        const last = index === steps.length - 1;
        return (
          <li key={step.id} aria-current={open ? "step" : undefined} className="relative flex gap-3">
            {/* The rail: a line joining the markers, so the steps read as one sequence. */}
            {!last ? <span aria-hidden className="bg-border absolute start-[0.9375rem] top-9 bottom-0 w-px" /> : null}
            <span
              aria-hidden
              className={cn(
                "relative mt-2 flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums",
                step.status === "complete" && "border-success bg-success-subtle text-success-subtle-fg",
                step.status === "error" && "border-danger bg-danger-subtle text-danger-subtle-fg",
                open && step.status !== "error" && "border-primary bg-primary text-primary-fg",
                !open && step.status === "upcoming" && "border-border-strong text-muted bg-surface",
                open && step.status === "complete" && "border-primary bg-primary text-primary-fg",
              )}
            >
              {step.status === "complete" && !open ? (
                <Icon name="check" size={16} />
              ) : step.status === "error" ? (
                <Icon name="warning" size={16} />
              ) : (
                index + 1
              )}
            </span>

            <div className={cn("min-w-0 flex-1", !last && "pb-4")}>
              <h3 className="m-0">
                <button
                  type="button"
                  id={headerId}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => onSelect(step.id)}
                  className="hover:bg-bg-subtle flex min-h-12 w-full flex-col items-start justify-center rounded-lg px-2 py-1.5 text-start"
                >
                  <span className="sr-only">{labels.stepOf(index + 1, steps.length)} </span>
                  <span className={cn("text-base font-semibold", !open && step.status === "upcoming" && "text-muted")}>
                    {step.label}
                    {step.status === "complete" ? <span className="sr-only"> — {labels.complete}</span> : null}
                    {step.status === "error" ? <span className="sr-only"> — {labels.error}</span> : null}
                  </span>
                  {step.summary && !open ? (
                    <span className="text-muted mt-0.5 line-clamp-2 text-sm">{step.summary}</span>
                  ) : null}
                </button>
              </h3>
              <div id={panelId} role="region" aria-labelledby={headerId} hidden={!open} className="px-2 pt-2 pb-2">
                {open ? step.content : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
