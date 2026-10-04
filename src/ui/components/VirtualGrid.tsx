"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "../lib/cn";

export interface VirtualGridProps<T> {
  items: readonly T[];
  /** A stable key per item. */
  itemKey: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** The narrowest a column may be, in CSS pixels: the grid fits as many as the width allows. */
  minColumnWidth: number;
  /** Gap between cells, in CSS pixels (the grid's `gap`). */
  gap?: number;
  /** A row's height before one has been measured. */
  estimatedRowHeight: number;
  /**
   * Cells rendered on the server and before measuring, in a CSS grid with the same column rule
   * (`auto-fill`, `minColumnWidth`), so the switch to measured rows moves nothing (CLS).
   */
  initialItems?: number;
  /** Rows kept rendered beyond the viewport, each way. */
  overscan?: number;
  /** The list's accessible name. */
  label: string;
  className?: string;
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A grid that renders only the rows near the viewport (U3.5 §4: a library of a thousand cards
 * stays light), scrolled with the page rather than inside a box of its own — a phone's scroll and
 * the browser's find-in-page keep working for what is on screen.
 *
 * Columns follow the width (`minColumnWidth`); rows are measured from the first one rendered and
 * are assumed equal, which a grid of same-shaped cards is. The first `initialItems` render on the
 * server, so the page has content before any script runs. It is a list (`role="list"`) and each
 * cell says where it sits in the whole (`aria-posinset` / `aria-setsize`), so a screen reader
 * hears "12 of 105" though the other cells are not in the document.
 */
export function VirtualGrid<T>({
  items,
  itemKey,
  renderItem,
  minColumnWidth,
  gap = 16,
  estimatedRowHeight,
  initialItems = 12,
  overscan = 3,
  label,
  className,
}: VirtualGridProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [rowHeight, setRowHeight] = useState(estimatedRowHeight);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [measured, setMeasured] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      setColumns(Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap))));
      // Before the switch, the auto-fill grid's first cell gives the row height; after it, the first row.
      const sample = rowRef.current ?? (el.firstElementChild as HTMLElement | null);
      if (sample) setRowHeight(sample.getBoundingClientRect().height || estimatedRowHeight);
      setMeasured(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [gap, minColumnWidth, estimatedRowHeight]);

  const rows = Math.ceil(items.length / columns);
  const stride = rowHeight + gap;

  useEffect(() => {
    if (!measured) return;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const first = Math.max(0, Math.floor(-top / stride) - overscan);
      const last = Math.min(rows, Math.ceil((window.innerHeight - top) / stride) + overscan);
      setRange((current) => (current[0] === first && current[1] === last ? current : [first, last]));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [measured, stride, rows, overscan]);

  const cell = (item: T, index: number) => (
    <div key={itemKey(item)} role="listitem" aria-posinset={index + 1} aria-setsize={items.length} className="min-w-0">
      {renderItem(item, index)}
    </div>
  );

  if (!measured)
    return (
      <div
        ref={ref}
        role="list"
        aria-label={label}
        className={cn("grid", className)}
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${minColumnWidth}px, 100%), 1fr))`, gap }}
      >
        {items.slice(0, initialItems).map(cell)}
      </div>
    );

  const [first, last] = range;
  const cells: React.ReactNode[] = [];
  for (let row = first; row < Math.min(last, rows); row++) {
    cells.push(
      <div
        key={row}
        ref={row === first ? rowRef : undefined}
        role="presentation"
        className="absolute grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap, insetInline: 0, top: row * stride }}
      >
        {items.slice(row * columns, row * columns + columns).map((item, i) => cell(item, row * columns + i))}
      </div>,
    );
  }

  return (
    <div
      ref={ref}
      role="list"
      aria-label={label}
      className={cn("relative", className)}
      style={{ height: Math.max(0, rows * stride - gap) }}
    >
      {cells}
    </div>
  );
}
