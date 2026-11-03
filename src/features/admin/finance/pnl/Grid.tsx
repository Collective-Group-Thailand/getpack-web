"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { PNL_CELL_MODE, PNL_MONTH_KIND } from "@/domain/status";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { CellMark } from "@/ui/components/CellMark";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";
import { useGridNavigation } from "@/ui/lib/useGridNavigation";

import { adminBrowserApis, problemMessage } from "../../console";
import { usePnlFormat } from "./format";
import {
  PNL_GROUPS,
  pnlKeys,
  SUBTOTAL_GROUPS,
  type PnlCell,
  type PnlGrid,
  type PnlGridLine,
  type PnlLineGroup,
  type PnlMonth,
} from "./resources";

/** A row of the grid as drawn: a band's header, or a line. */
type Row =
  | { kind: "group"; group: PnlLineGroup; lines: number }
  | { kind: "line"; line: PnlGridLine; subtotal: boolean; detail: boolean };

/** What a person is editing: the cell, the draft value and the note when the first value of a manual cell needs one. */
interface Editing {
  lineKey: string;
  month: string;
  value: string;
  note: string;
  needsNote: boolean;
  error: string | null;
  busy: boolean;
}

const MONEY = /^-?\d{1,12}(\.\d{1,2})?$/;
/** The person's typing, back to the API's plain decimal: separators and spaces out, a typographic minus back to "-". */
const normalise = (text: string) => text.replace(/[,\s฿]/g, "").replace(/^−/, "-");

export interface PnlGridProps {
  grid: PnlGrid;
  /** `pnl.manage` on a draft: manual cells edit inline; system cells go through `onOverride`. */
  canEdit: boolean;
  /** An auto or overridden cell was asked to change — the reason dialog (D-472 item 4). */
  onOverride?: (line: PnlGridLine, cell: PnlCell) => void;
}

/**
 * The plan as a grid (D-472 item 2): the lines down, the months across with the year's total; grouped in the order a
 * statement reads, each band collapsible to its calculated lines, the memo band apart and out of the total. A real
 * `<table role="grid">` with one tab stop: arrows move, Enter (or F2, or typing a number) edits a cell a person may
 * fill, Escape cancels. The first column and the header stay put while the grid scrolls inside its own frame — the
 * page never scrolls sideways.
 *
 * Every cell carries its source mark by shape and words (ระบบ · คำนวณ · กรอกเอง · แก้ทับ); forecast months sit on a
 * tinted ground behind a rule and say so in the header, and open periods read "ยังไม่ปิดงวด". The web prints the API's
 * strings — no total, formula or variance is worked out here.
 */
export function PnlGridView({ grid, canEdit, onOverride }: PnlGridProps) {
  const t = useTranslations("finance.pnl.grid");
  const tEdit = useTranslations("finance.pnl.edit");
  const tStatus = useTranslations("status");
  const format = usePnlFormat();
  const queryClient = useQueryClient();
  const titleId = useId();
  const [collapsed, setCollapsed] = useState<ReadonlySet<PnlLineGroup>>(new Set());
  const [editing, setEditing] = useState<Editing | null>(null);
  const months = grid.months;
  const firstForecast = months.findIndex((month) => month.kind === "forecast");

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const group of PNL_GROUPS) {
      const lines = grid.lines.filter((row) => row.line.group === group);
      if (lines.length === 0) continue;
      if (SUBTOTAL_GROUPS.has(group)) {
        for (const line of lines) out.push({ kind: "line", line, subtotal: true, detail: false });
        continue;
      }
      out.push({ kind: "group", group, lines: lines.length });
      for (const line of lines) {
        // Collapsed, a band keeps its calculated lines (net revenue, the tax estimate) and folds the inputs away.
        if (collapsed.has(group) && line.line.calc === "source") continue;
        out.push({ kind: "line", line, subtotal: false, detail: line.line.calc === "source" });
      }
    }
    return out;
  }, [grid.lines, collapsed]);

  const memoStart = rows.findIndex((row) => row.kind === "group" && row.group === "memo");
  const cols = months.length + 2;
  const at = (row: number, col: number) => {
    const r = rows[row];
    if (!r || r.kind !== "line" || col < 1 || col > months.length) return null;
    return { line: r.line, cell: r.line.cells[col - 1]! };
  };

  const startEdit = (line: PnlGridLine, cell: PnlCell, seed?: string) => {
    if (!canEdit || !line.line.editable) return false;
    if (cell.mode !== "manual") {
      onOverride?.(line, cell);
      return Boolean(onOverride);
    }
    setEditing({
      lineKey: line.line.key,
      month: cell.month,
      value: seed ?? (cell.value === null ? "" : format.plain(cell.value).replace(/−/, "-")),
      note: "",
      needsNote: cell.value === null && !cell.note,
      error: null,
      busy: false,
    });
    return true;
  };

  const nav = useGridNavigation({
    rows: rows.length,
    cols,
    onCellKey: (position, event) => {
      const row = rows[position.row];
      if (row?.kind === "group" && (event.key === "Enter" || event.key === " ")) {
        toggle(row.group);
        return true;
      }
      const target = at(position.row, position.col);
      if (!target) return false;
      if (event.key === "Enter" || event.key === "F2") return startEdit(target.line, target.cell);
      if (/^[0-9.-]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey)
        return target.cell.mode === "manual" ? startEdit(target.line, target.cell, event.key) : false;
      return false;
    },
  });

  const toggle = (group: PnlLineGroup) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  const close = (focus: { row: number; col: number } | null) => {
    setEditing(null);
    if (focus) requestAnimationFrame(() => nav.focusCell(focus));
  };

  const save = async (line: PnlGridLine, cell: PnlCell, position: { row: number; col: number }) => {
    if (!editing) return;
    const raw = normalise(editing.value);
    if (raw !== "" && !MONEY.test(raw)) return setEditing({ ...editing, error: tEdit("invalid") });
    const note = editing.note.trim();
    if (raw !== "" && editing.needsNote && note.length < 3)
      return setEditing({ ...editing, error: tEdit("noteRequired") });
    setEditing({ ...editing, busy: true, error: null });
    try {
      const { data } = await adminBrowserApis().contract.PUT(
        "/v1/admin/finance/pnl/plans/{planId}/cells/{lineKey}/{month}",
        {
          params: {
            path: { planId: grid.plan.id, lineKey: line.line.key, month: cell.month },
            header: { "If-Match": cell.etag },
          },
          body: { value: raw === "" ? null : raw, ...(note ? { note } : {}) },
        },
      );
      queryClient.setQueryData(pnlKeys.grid(grid.plan.id), data);
      void queryClient.invalidateQueries({ queryKey: pnlKeys.plans() });
      toast.success(raw === "" ? tEdit("cleared") : tEdit("saved"));
      close(position);
    } catch (error) {
      if (isApiError(error) && error.status === 412) {
        await queryClient.invalidateQueries({ queryKey: pnlKeys.grid(grid.plan.id) });
        toast.error(tEdit("stale"));
        return close(position);
      }
      setEditing((current) => current && { ...current, busy: false, error: problemMessage(error, tEdit("failed")) });
    }
  };

  return (
    <section aria-labelledby={titleId} className="border-border bg-surface rounded-card flex min-w-0 flex-col border">
      <header className="border-border flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-3">
        <h2 id={titleId} className="text-base font-semibold">
          {t("label", { name: grid.plan.name })}
          <span className="text-muted ms-2 text-sm font-normal">{t("unit")}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="sr-only">{t("legend")}</span>
          {(["auto", "calculated", "manual", "override"] as const).map((mode) => (
            <CellMark
              key={mode}
              variant="chip"
              icon={PNL_CELL_MODE[mode].icon}
              tone={toneOf(mode)}
              label={tStatus(PNL_CELL_MODE[mode].labelKey)}
            />
          ))}
        </div>
      </header>
      <p className="text-muted border-border border-b px-4 py-1.5 text-xs" id={`${titleId}-keys`}>
        <Icon name="keyboard" size={14} className="me-1.5 inline align-[-2px]" aria-hidden />
        {canEdit ? t("keys") : t("keysReadOnly")}
      </p>

      <div
        className="max-h-[calc(100dvh-9rem)] min-h-64 overflow-auto overscroll-contain"
        data-testid="pnl-grid-scroll"
      >
        <table
          ref={(node) => {
            nav.containerRef.current = node;
          }}
          role="grid"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-keys`}
          aria-readonly={!canEdit || undefined}
          aria-rowcount={rows.length + 1}
          className="w-max min-w-full border-separate border-spacing-0 text-sm tabular-nums"
        >
          <thead>
            <tr role="row">
              <th
                scope="col"
                className="bg-surface border-border sticky top-0 left-0 z-30 min-w-60 border-e border-b px-4 py-2 text-start align-bottom text-xs font-medium sm:min-w-72"
              >
                <span className="text-muted">{t("line")}</span>
              </th>
              {months.map((month, index) => (
                <MonthHeader key={month.month} month={month} forecastEdge={index === firstForecast} />
              ))}
              <th
                scope="col"
                className="bg-surface-subtle border-border-strong sticky top-0 z-20 min-w-36 border-s border-b px-3 py-2 text-end align-bottom text-xs font-semibold"
              >
                {t("total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              if (row.kind === "group")
                return (
                  <GroupRow
                    key={`g-${row.group}`}
                    group={row.group}
                    expanded={!collapsed.has(row.group)}
                    memo={r === memoStart}
                    colSpan={cols}
                    onToggle={() => toggle(row.group)}
                    cellProps={nav.cellProps(r, 0, true)}
                  />
                );
              const { line } = row;
              return (
                <tr
                  key={line.line.key}
                  role="row"
                  data-line={line.line.key}
                  className={cn(row.subtotal && "font-semibold", line.line.key === "net_profit" && "text-base")}
                >
                  <th
                    scope="row"
                    role="rowheader"
                    {...nav.cellProps(r, 0)}
                    className={cn(
                      "bg-surface border-border sticky left-0 z-10 border-e px-4 py-2 text-start font-normal outline-none",
                      "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:ring-inset",
                      row.subtotal && "border-border-strong border-t font-semibold",
                      line.line.key === "net_profit" && "bg-surface-subtle border-t-2",
                      row.detail && "ps-8",
                    )}
                  >
                    <LineLabel line={line} />
                  </th>
                  {line.cells.map((cell, c) => {
                    const position = { row: r, col: c + 1 };
                    const isEditing = editing?.lineKey === line.line.key && editing.month === cell.month;
                    return (
                      <td
                        key={cell.month}
                        role="gridcell"
                        {...nav.cellProps(r, c + 1)}
                        aria-readonly={!canEdit || !line.line.editable || undefined}
                        data-mode={cell.mode}
                        data-month={cell.month}
                        onDoubleClick={() => startEdit(line, cell)}
                        onClick={() => {
                          if (!isEditing && cell.mode === "manual" && cell.value === null) startEdit(line, cell);
                        }}
                        className={cell_({
                          forecast: months[c]?.kind === "forecast",
                          edge: c === firstForecast,
                          subtotal: row.subtotal,
                          netProfit: line.line.key === "net_profit",
                          editing: isEditing,
                        })}
                      >
                        {isEditing && editing ? (
                          <CellEditor
                            editing={editing}
                            label={t("cellName", { line: format.label(line.line), month: format.month(cell.month) })}
                            howToFill={format.text(line.line.howToFill)}
                            onChange={(patch) => setEditing({ ...editing, ...patch, error: null })}
                            onSave={() => void save(line, cell, position)}
                            onCancel={() => close(position)}
                          />
                        ) : (
                          <CellValue line={line} cell={cell} canEdit={canEdit} />
                        )}
                      </td>
                    );
                  })}
                  <td
                    role="gridcell"
                    {...nav.cellProps(r, months.length + 1)}
                    aria-readonly
                    className={cn(
                      "bg-surface-subtle border-border-strong border-s px-3 py-2 text-end font-medium whitespace-nowrap outline-none",
                      "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:ring-inset",
                      row.subtotal && "border-t",
                      line.line.key === "net_profit" && "border-t-2",
                    )}
                  >
                    {format.value(line.line, line.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const toneOf = (mode: PnlCell["mode"]) =>
  mode === "manual" ? "primary" : mode === "override" ? "warning" : ("neutral" as const);

function cell_({
  forecast,
  edge,
  subtotal,
  netProfit,
  editing,
}: {
  forecast: boolean;
  edge: boolean;
  subtotal: boolean;
  netProfit: boolean;
  editing: boolean;
}) {
  return cn(
    "border-border relative h-11 px-3 py-1.5 text-end align-middle whitespace-nowrap outline-none",
    "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:ring-inset",
    forecast && "bg-bg-subtle",
    edge && "border-border-strong border-s border-dashed",
    subtotal && "border-border-strong border-t",
    netProfit && "border-t-2",
    editing && "z-20 p-0",
  );
}

/** A month's header: the month, then actual or forecast in words with its shape, and "ยังไม่ปิดงวด" for an open period. */
function MonthHeader({ month, forecastEdge }: { month: PnlMonth; forecastEdge: boolean }) {
  const t = useTranslations("finance.pnl.grid");
  const tStatus = useTranslations("status");
  const format = usePnlFormat();
  const kind = PNL_MONTH_KIND[month.kind];
  return (
    <th
      scope="col"
      data-month={month.month}
      data-kind={month.kind}
      className={cn(
        "border-border sticky top-0 z-20 min-w-32 border-b px-3 py-2 text-end align-bottom font-medium",
        month.kind === "forecast" ? "bg-bg-subtle" : "bg-surface",
        forecastEdge && "border-border-strong border-s border-dashed",
      )}
    >
      <span className="block text-sm">{format.month(month.month)}</span>
      <span className="text-muted mt-0.5 flex items-center justify-end gap-1 text-xs font-normal">
        <Icon name={month.periodOpen ? "hourglass" : kind.icon} size={12} aria-hidden />
        {month.periodOpen ? t("periodOpen") : tStatus(kind.labelKey)}
      </span>
    </th>
  );
}

/** A band's header: its name with a disclosure, the only cell of its row. */
function GroupRow({
  group,
  expanded,
  memo,
  colSpan,
  onToggle,
  cellProps,
}: {
  group: PnlLineGroup;
  expanded: boolean;
  memo: boolean;
  colSpan: number;
  onToggle: () => void;
  cellProps: ReturnType<ReturnType<typeof useGridNavigation>["cellProps"]>;
}) {
  const t = useTranslations("finance.pnl.grid");
  const name = t(`groups.${group}`);
  return (
    <tr role="row" data-group={group}>
      <th
        scope="colgroup"
        role="rowheader"
        colSpan={colSpan}
        aria-expanded={expanded}
        {...cellProps}
        onClick={onToggle}
        className={cn(
          "border-border cursor-pointer px-0 pt-3 pb-1 text-start outline-none select-none",
          "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:ring-inset",
          memo && "border-border-strong border-t-4 pt-5",
        )}
      >
        <span className="bg-surface sticky left-0 inline-flex items-center gap-1.5 px-4 text-xs font-semibold tracking-wide">
          <Icon
            name="chevron-down"
            size={14}
            aria-hidden
            className={cn("text-muted transition-transform duration-150", !expanded && "-rotate-90")}
          />
          <span>{name}</span>
          <span className="sr-only">{expanded ? t("collapse", { group: name }) : t("expand", { group: name })}</span>
          {memo ? <span className="text-muted ms-2 font-normal">{t("memoNote")}</span> : null}
        </span>
      </th>
    </tr>
  );
}

/** A line's name in the first column; the tax estimate always says "ประมาณการ". */
function LineLabel({ line }: { line: PnlGridLine }) {
  const t = useTranslations("finance.pnl.grid");
  const format = usePnlFormat();
  return (
    <span className="flex items-center gap-2">
      <span className="min-w-0">{format.label(line.line)}</span>
      {line.line.unit !== "money" ? (
        <span className="text-muted text-xs font-normal">{t(`unit_${line.line.unit}`)}</span>
      ) : null}
    </span>
  );
}

/**
 * A cell's figure with its source mark. An override prints both values — the person's, and the system's beside it
 * struck through with its label; an empty manual cell invites "กรอกค่า" to someone who may fill it.
 */
export function CellValue({ line, cell, canEdit }: { line: PnlGridLine; cell: PnlCell; canEdit: boolean }) {
  const t = useTranslations("finance.pnl.grid");
  const tStatus = useTranslations("status");
  const format = usePnlFormat();
  const meta = PNL_CELL_MODE[cell.mode];
  const mark = <CellMark icon={meta.icon} tone={toneOf(cell.mode)} label={tStatus(meta.labelKey)} />;

  if (cell.mode === "manual" && cell.value === null)
    return (
      <span className="flex items-center justify-between gap-2">
        {mark}
        {canEdit && line.line.editable ? (
          <span className="border-primary/50 text-primary-subtle-fg bg-primary-subtle/40 rounded-sm border border-dashed px-1.5 py-0.5 text-xs font-medium">
            {t("fill")}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </span>
    );
  if (cell.value === null && cell.sourceRef?.["status"] === "not_set")
    return (
      <span className="flex items-center justify-between gap-2">
        {mark}
        <span className="text-muted text-xs">{t("notSet")}</span>
      </span>
    );
  return (
    <span className="flex items-center justify-between gap-2">
      {mark}
      <span className="flex flex-col items-end leading-tight">
        <span className={cn(cell.mode === "override" && "font-medium")}>{format.value(line.line, cell.value)}</span>
        {cell.mode === "override" && cell.autoValue !== null ? (
          <span className="text-muted text-[0.6875rem] font-normal" data-auto-value>
            {tStatus(PNL_CELL_MODE.auto.labelKey)} <s>{format.value(line.line, cell.autoValue)}</s>
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * The inline editor of a manual cell: the value in the cell, and under it a small panel with the note the first value
 * needs (D-472: a manual line's first entry says where the number comes from), Save and Cancel. Enter saves, Escape
 * cancels; focus returns to the cell.
 */
function CellEditor({
  editing,
  label,
  howToFill,
  onChange,
  onSave,
  onCancel,
}: {
  editing: Editing;
  label: string;
  howToFill: string | null;
  onChange: (patch: Partial<Editing>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("finance.pnl.edit");
  const input = useRef<HTMLInputElement>(null);
  const noteId = useId();
  const errorId = useId();
  useEffect(() => {
    input.current?.focus();
    const length = input.current?.value.length ?? 0;
    input.current?.setSelectionRange(length, length);
  }, []);
  const keys = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };
  return (
    <div onKeyDown={keys}>
      <input
        ref={input}
        aria-label={label}
        aria-invalid={Boolean(editing.error) || undefined}
        aria-describedby={editing.error ? errorId : undefined}
        inputMode="decimal"
        autoComplete="off"
        value={editing.value}
        disabled={editing.busy}
        onChange={(event) => onChange({ value: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !editing.needsNote) {
            event.preventDefault();
            onSave();
          }
        }}
        className="border-primary bg-surface ring-focus-ring h-11 w-full border-2 px-3 text-end tabular-nums outline-none focus:ring-2"
      />
      <div
        className="border-border bg-surface-raised shadow-overlay rounded-card absolute end-0 top-full z-30 mt-1 flex w-80 flex-col gap-2 border p-3 text-start text-sm font-normal whitespace-normal"
        role="group"
        aria-label={label}
      >
        {editing.needsNote ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={noteId} className="font-medium">
              {t("note")}
            </label>
            <Textarea
              id={noteId}
              rows={2}
              maxLength={1000}
              value={editing.note}
              disabled={editing.busy}
              placeholder={howToFill ?? undefined}
              onChange={(event) => onChange({ note: event.target.value })}
              aria-describedby={`${noteId}-hint`}
            />
            <p id={`${noteId}-hint`} className="text-muted text-xs">
              {t("noteHint")}
            </p>
          </div>
        ) : howToFill ? (
          <p className="text-muted text-xs">{howToFill}</p>
        ) : null}
        {editing.error ? (
          <p id={errorId} role="alert" className="text-danger text-xs">
            {editing.error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={editing.busy}>
            {t("cancel")}
          </Button>
          <Button type="button" size="sm" onClick={onSave} loading={editing.busy}>
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
