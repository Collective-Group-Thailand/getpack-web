"use client";

import { cn } from "../lib/cn";
import { Tooltip } from "./Tooltip";

export interface FigureTipProps {
  /** The figure as the reader sees it (already formatted: "฿12,400.00", "18.20%"). */
  children: React.ReactNode;
  /** What the figure is, in one sentence. */
  definition: React.ReactNode;
  /** How it is worked out, in words ("ยอดขายหลังส่วนลด − ต้นทุนโรงงาน …"). */
  formula?: React.ReactNode;
  /** Where it comes from: a record name and, when there is one, the link to it. */
  source?: { label: React.ReactNode; href?: string | null };
  /** "ข้อมูล ณ …" — when the figure was true. */
  asOf?: React.ReactNode;
  labels: { formula: string; source: string; asOf: string };
  className?: string;
}

/**
 * A number that explains itself (D-470, "every number has a tooltip"): definition, formula, source and as-of time on
 * hover and on keyboard focus. The figure is a focusable span with a dotted underline so a reader can tell it has more
 * to say. Supplementary only: the record the source names is always linked elsewhere on the page too (a tooltip is
 * not reachable on touch).
 */
export function FigureTip({ children, definition, formula, source, asOf, labels, className }: FigureTipProps) {
  return (
    <Tooltip
      content={
        <span className="flex max-w-60 flex-col gap-1 py-0.5 text-start leading-snug">
          <span>{definition}</span>
          {formula ? (
            <span>
              <span className="opacity-75">{labels.formula}: </span>
              {formula}
            </span>
          ) : null}
          {source ? (
            <span>
              <span className="opacity-75">{labels.source}: </span>
              {source.href ? (
                <a href={source.href} className="underline underline-offset-2">
                  {source.label}
                </a>
              ) : (
                source.label
              )}
            </span>
          ) : null}
          {asOf ? (
            <span className="opacity-75">
              {labels.asOf} {asOf}
            </span>
          ) : null}
        </span>
      }
    >
      <span
        // A real focus stop, so keyboard users get the same explanation as a mouse.
        tabIndex={0}
        className={cn(
          "decoration-border-strong focus-visible:ring-focus-ring cursor-help rounded-sm underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2",
          className,
        )}
      >
        {children}
      </span>
    </Tooltip>
  );
}
