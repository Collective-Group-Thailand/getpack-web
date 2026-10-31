"use client";

import { cn } from "../lib/cn";
import { IconButton } from "./IconButton";
import { NativeSelect } from "./NativeSelect";

export interface PaginationLabels {
  /** Accessible name of the whole control, e.g. "เลื่อนหน้า". */
  nav: string;
  previous: string;
  next: string;
  /** "แสดง 26–50 จาก 1,234 รายการ" — the caller formats the numbers. */
  range: (from: number, to: number, total: number) => string;
  /** "หน้า 2 จาก 50". */
  pageOf: (page: number, pages: number) => string;
  perPage: string;
}

export interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  /** 25/50/100 by default (F2 A.3). The API caps `perPage` at 100 (api-conventions §3). */
  pageSizes?: readonly number[];
  labels: PaginationLabels;
  className?: string;
}

/**
 * Page controls for a server list. Previous/next rather than numbered pages: staff move
 * through a queue, they do not jump to page 37, and fewer controls means fewer tab stops.
 * The range text is a live region so a screen reader hears where the page landed.
 */
export function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  pageSizes = [25, 50, 100],
  labels,
  className,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  // A list whose default page is 10 or 20 still shows its size, not an empty select (admin audit: blank per-page).
  const sizes = pageSizes.includes(perPage) ? pageSizes : [...pageSizes, perPage].sort((a, b) => a - b);

  return (
    <nav aria-label={labels.nav} className={cn("flex flex-wrap items-center justify-between gap-3 text-sm", className)}>
      <p className="text-muted tabular-nums" aria-live="polite">
        {labels.range(from, to, total)}
      </p>
      <div className="flex items-center gap-2">
        {onPerPageChange ? (
          // Native: its value shows from the first paint (the Radix trigger stayed blank until its list had mounted).
          <NativeSelect
            aria-label={labels.perPage}
            value={String(perPage)}
            onValueChange={(value) => onPerPageChange(Number(value))}
            options={sizes.map((size) => ({ value: String(size), label: String(size) }))}
            className="h-9 w-20 text-sm"
          />
        ) : null}
        <IconButton
          name="chevron-left"
          size="sm"
          variant="secondary"
          label={labels.previous}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span className="text-muted min-w-24 text-center tabular-nums">{labels.pageOf(page, pages)}</span>
        <IconButton
          name="chevron-right"
          size="sm"
          variant="secondary"
          label={labels.next}
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </nav>
  );
}
