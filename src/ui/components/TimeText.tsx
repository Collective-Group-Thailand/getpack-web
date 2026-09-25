"use client";

import { Tooltip } from "./Tooltip";

export interface TimeTextProps {
  /** The ISO instant, for `<time dateTime>`. */
  dateTime: string;
  /** What is shown — usually relative ("5 นาทีที่แล้ว"). */
  children: React.ReactNode;
  /** The absolute date and time, in a tooltip and to assistive technology. */
  absolute: string;
}

/**
 * A relative time with its absolute value one hover or focus away (design-system.md §4:
 * "relative times with absolute tooltip"). Focusable, so a keyboard user can read the tooltip
 * too; the absolute time is also the accessible name, so nobody has to.
 */
export function TimeText({ dateTime, children, absolute }: TimeTextProps) {
  return (
    <Tooltip content={absolute}>
      <time dateTime={dateTime} tabIndex={0} aria-label={absolute} className="rounded-sm whitespace-nowrap">
        {children}
      </time>
    </Tooltip>
  );
}
