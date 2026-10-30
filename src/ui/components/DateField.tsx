"use client";

import { cn } from "../lib/cn";
import { Input, type InputProps } from "./Input";

export interface DateFieldProps extends Omit<InputProps, "type"> {
  /** `date` (YYYY-MM-DD) or `month` (YYYY-MM): the value stays ISO, what the reader sees is `display`. */
  type?: "date" | "month";
  /**
   * The value as the reader's calendar writes it ("31 ต.ค. 2569"), or the placeholder when empty ("เลือกวันที่").
   * Formatted by the caller from `src/i18n` — `src/ui` never formats dates itself.
   */
  display: string;
}

/**
 * A native date (or month) field that reads in the page's language. The browser draws a date field in its own
 * locale ("mm/dd/yyyy", "January 2026" on a Thai page); at rest this field shows `display` over it instead — the
 * Thai date, Buddhist year — and the native segments come back only while the field has focus, where the picker
 * and the keyboard work as usual. The value sent is the ISO date either way.
 */
export function DateField({ type = "date", display, className, value, defaultValue, ...props }: DateFieldProps) {
  const empty = !(value ?? defaultValue);
  return (
    <span className="relative block min-w-0">
      <Input
        type={type}
        value={value}
        defaultValue={defaultValue}
        className={cn(
          "peer",
          // The browser's own text hides at rest; its calendar button stays.
          "[&:not(:focus)::-webkit-datetime-edit]:opacity-0",
          className,
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 start-0 end-10 flex items-center truncate px-3 tabular-nums peer-focus:hidden",
          empty ? "text-subtle" : "text-fg",
        )}
      >
        {display}
      </span>
    </span>
  );
}
