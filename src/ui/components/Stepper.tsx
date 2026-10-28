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
  /** A complete step whose answer is still the starting value nobody confirmed or changed ("ค่าเริ่มต้น"). */
  defaulted?: boolean;
  /** Rendered while the step is open. */
  content: React.ReactNode;
}

export interface StepperLabels {
  /** "เสร็จแล้ว" — announced after a complete step's label. */
  complete: string;
  /** "ค่าเริ่มต้น" — shown (and announced) instead of the done state while a step still holds its starting value. */
  defaulted?: string;
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
  /** The steps' heading level under the page's own headings (default 3). */
  headingLevel?: 2 | 3;
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
export function Stepper({ steps, current, onSelect, labels, headingLevel = 3, className, ...props }: StepperProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
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
                step.status === "complete" &&
                  !step.defaulted &&
                  "border-success bg-success-subtle text-success-subtle-fg",
                step.status === "error" && "border-danger bg-danger-subtle text-danger-subtle-fg",
                open && step.status !== "error" && "border-primary bg-primary text-primary-fg",
                !open &&
                  (step.status === "upcoming" || (step.status === "complete" && step.defaulted)) &&
                  "border-border-strong text-muted bg-surface",
                open && step.status === "complete" && "border-primary bg-primary text-primary-fg",
              )}
            >
              {step.status === "complete" && !step.defaulted && !open ? (
                <Icon name="check" size={16} />
              ) : step.status === "error" ? (
                <Icon name="warning" size={16} />
              ) : (
                index + 1
              )}
            </span>

            <div className={cn("min-w-0 flex-1", !last && "pb-4")}>
              <Heading className="m-0">
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
                    {step.status === "complete" && !step.defaulted ? (
                      <span className="sr-only"> — {labels.complete}</span>
                    ) : null}
                    {step.status === "complete" && step.defaulted && labels.defaulted ? (
                      <span className="bg-bg-subtle text-muted rounded-control ms-2 px-2 py-0.5 align-middle text-xs font-normal">
                        {labels.defaulted}
                      </span>
                    ) : null}
                    {step.status === "error" ? <span className="sr-only"> — {labels.error}</span> : null}
                  </span>
                  {step.summary && !open ? (
                    <span className="text-muted mt-0.5 line-clamp-2 text-sm">{step.summary}</span>
                  ) : null}
                </button>
              </Heading>
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
