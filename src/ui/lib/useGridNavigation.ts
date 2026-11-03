"use client";

import { useCallback, useRef, useState } from "react";

export interface GridPosition {
  row: number;
  col: number;
}

export interface GridNavigationOptions {
  /** Rows a person can reach, in display order (hidden rows are left out by the caller). */
  rows: number;
  cols: number;
  /** How many rows PageUp / PageDown move. */
  pageSize?: number;
  /**
   * A key the grid does not handle itself (Enter, F2, Escape, a printable character …) on the cell at `at`. Return
   * true when it was handled, so the grid stops it.
   */
  onCellKey?: (at: GridPosition, event: React.KeyboardEvent<HTMLElement>) => boolean | void;
}

/**
 * The keyboard model of an ARIA data grid (WAI-ARIA APG "Data Grid"): one tab stop (roving `tabIndex`), arrows move
 * one cell, Home / End go to the row's ends, Ctrl+Home / Ctrl+End to the grid's corners, PageUp / PageDown move a
 * page of rows. Everything else is handed to `onCellKey` — editing is the caller's (Enter / F2 to edit, Escape to
 * cancel). Cells are found by `data-grid-row` / `data-grid-col` inside the element `gridRef` is attached to, so the
 * markup stays a real `<table role="grid">`.
 */
export function useGridNavigation({ rows, cols, pageSize = 8, onCellKey }: GridNavigationOptions) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState<GridPosition>({ row: 0, col: 0 });
  const clamp = (at: GridPosition): GridPosition => ({
    row: Math.max(0, Math.min(rows - 1, at.row)),
    col: Math.max(0, Math.min(cols - 1, at.col)),
  });
  const current = clamp(active);

  const focusCell = useCallback((at: GridPosition) => {
    setActive(at);
    // A row with one cell across the grid (a group's header) is reached at any column; the column is kept, so the
    // next row down lands where the reader was.
    const cell =
      containerRef.current?.querySelector<HTMLElement>(`[data-grid-row="${at.row}"][data-grid-col="${at.col}"]`) ??
      containerRef.current?.querySelector<HTMLElement>(`[data-grid-row="${at.row}"]`);
    cell?.focus();
    cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  const onKeyDown = (at: GridPosition, event: React.KeyboardEvent<HTMLElement>) => {
    // Keys pressed inside an editor in the cell belong to the editor.
    if (event.target !== event.currentTarget) return;
    const move = (to: GridPosition) => {
      event.preventDefault();
      focusCell(clamp(to));
    };
    const ctrl = event.ctrlKey || event.metaKey;
    const spanning = event.currentTarget.hasAttribute("data-grid-span");
    switch (event.key) {
      case "ArrowRight":
        if (spanning) return event.preventDefault();
        return move({ row: at.row, col: at.col + 1 });
      case "ArrowLeft":
        if (spanning) return event.preventDefault();
        return move({ row: at.row, col: at.col - 1 });
      case "ArrowDown":
        return move({ row: at.row + 1, col: at.col });
      case "ArrowUp":
        return move({ row: at.row - 1, col: at.col });
      case "Home":
        return move(ctrl ? { row: 0, col: 0 } : { row: at.row, col: 0 });
      case "End":
        return move(ctrl ? { row: rows - 1, col: cols - 1 } : { row: at.row, col: cols - 1 });
      case "PageDown":
        return move({ row: at.row + pageSize, col: at.col });
      case "PageUp":
        return move({ row: at.row - pageSize, col: at.col });
      default:
        if (onCellKey?.(at, event)) event.preventDefault();
    }
  };

  /**
   * Spread on every cell: its place, its tab stop and the keyboard model. `span` marks the one cell of a row that runs
   * across the grid: it holds the tab stop for any column of its row, and Left / Right stay put on it.
   */
  const cellProps = (row: number, col: number, span = false) => ({
    "data-grid-row": row,
    "data-grid-col": col,
    ...(span ? { "data-grid-span": "" } : {}),
    tabIndex: row === current.row && (span || col === current.col) ? 0 : -1,
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => onKeyDown({ row, col: span ? current.col : col }, event),
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (row !== current.row || (!span && col !== current.col)) setActive({ row, col: span ? current.col : col });
    },
  });

  /** A callback ref for the grid element. */
  const gridRef = useCallback((node: HTMLElement | null) => {
    containerRef.current = node;
  }, []);

  return { gridRef, active: current, focusCell, cellProps };
}
