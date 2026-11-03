"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { PNL_ACTUAL_BASIS } from "@/domain/status";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { Tooltip } from "@/ui/components/Tooltip";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";
import { useGridNavigation } from "@/ui/lib/useGridNavigation";

import { adminBrowserApis, problemMessage } from "../../console";
import { LineTipContent } from "./CellTip";
import { usePnlFormat } from "./format";
import { GroupRow, LineLabel, MonthHeader } from "./Grid";
import {
  PNL_GROUPS,
  pnlKeys,
  SUBTOTAL_GROUPS,
  type PnlLineGroup,
  type PnlVariance,
  type PnlVarianceCell,
  type PnlVarianceLine,
} from "./resources";

type Row = { kind: "group"; group: PnlLineGroup } | { kind: "line"; line: PnlVarianceLine; subtotal: boolean };

/** The direction of a variance in words and shape — never judged good or bad: a higher cost and a higher revenue both read "สูงกว่าแผน". */
function direction(variance: string | null) {
  if (variance === null) return null;
  if (/^-?0+(\.0+)?$/.test(variance)) return { icon: "minus" as const, key: "even" as const };
  return variance.startsWith("-")
    ? { icon: "trend-down" as const, key: "below" as const }
    : { icon: "trend-up" as const, key: "above" as const };
}

/**
 * Plan vs actual (D-472): the locked baseline against what the ledger now says, month by month. Each cell leads with
 * the actual, the plan beneath it, then the variance (actual − plan) with its direction in words and shape; months
 * without an actual show the plan and "ยังไม่ถึงงวด". A finance note explains a variance — Enter on the cell (or a
 * click) writes it, also on a locked plan. The figures are the API's; nothing is subtracted here.
 */
export function VarianceGridView({ variance, canNote }: { variance: PnlVariance; canNote: boolean }) {
  const t = useTranslations("finance.pnl.grid");
  const tV = useTranslations("finance.pnl.variance");
  const format = usePnlFormat();
  const titleId = useId();
  const [collapsed, setCollapsed] = useState<ReadonlySet<PnlLineGroup>>(new Set());
  const [noting, setNoting] = useState<{ line: PnlVarianceLine; cell: PnlVarianceCell; at: number[] } | null>(null);
  const months = variance.months;
  const firstForecast = months.findIndex((month) => month.kind === "forecast");

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const group of PNL_GROUPS) {
      const lines = variance.lines.filter((row) => row.line.group === group);
      if (!lines.length) continue;
      if (SUBTOTAL_GROUPS.has(group)) {
        for (const line of lines) out.push({ kind: "line", line, subtotal: true });
        continue;
      }
      out.push({ kind: "group", group });
      for (const line of lines)
        if (!(collapsed.has(group) && line.line.calc === "source")) out.push({ kind: "line", line, subtotal: false });
    }
    return out;
  }, [variance.lines, collapsed]);
  const memoStart = rows.findIndex((row) => row.kind === "group" && row.group === "memo");
  const toggle = (group: PnlLineGroup) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  const openNote = (r: number, c: number) => {
    const row = rows[r];
    if (!canNote || row?.kind !== "line" || c < 1 || c > months.length) return false;
    const cell = row.line.cells[c - 1]!;
    if (cell.actualBasis === "not_yet") return false;
    setNoting({ line: row.line, cell, at: [r, c] });
    return true;
  };
  const { gridRef, cellProps, focusCell } = useGridNavigation({
    rows: rows.length,
    cols: months.length + 2,
    onCellKey: (position, event) => {
      const row = rows[position.row];
      if (row?.kind === "group" && (event.key === "Enter" || event.key === " ")) {
        toggle(row.group);
        return true;
      }
      if (event.key === "Enter") return openNote(position.row, position.col);
      return false;
    },
  });

  return (
    <section aria-labelledby={titleId} className="border-border bg-surface rounded-card flex min-w-0 flex-col border">
      <header className="border-border flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-3">
        <h2 id={titleId} className="text-base font-semibold">
          {t("varianceLabel", { name: variance.plan.name })}
          <span className="text-muted ms-2 text-sm font-normal">{t("unit")}</span>
        </h2>
        <p className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>
            <span className="text-fg font-semibold">{tV("actual")}</span> · {tV("plan")} · {tV("diff")}
          </span>
          <span>{tV("asOf", { at: format.dateTime(variance.asOf) })}</span>
        </p>
      </header>
      <p className="text-muted border-border border-b px-4 py-1.5 text-xs" id={`${titleId}-keys`}>
        <Icon name="keyboard" size={14} className="me-1.5 inline align-[-2px]" aria-hidden />
        {canNote ? tV("keys") : tV("keysReadOnly")} · {tV("totalsNote")}
      </p>
      <div
        className="max-h-[calc(100dvh-9rem)] min-h-64 overflow-auto overscroll-contain"
        data-testid="pnl-grid-scroll"
      >
        <table
          ref={gridRef}
          role="grid"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-keys`}
          aria-readonly
          className="w-max min-w-full border-separate border-spacing-0 text-sm tabular-nums"
          data-view="variance"
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
                    colSpan={months.length + 2}
                    onToggle={() => toggle(row.group)}
                    cellProps={cellProps(r, 0, true)}
                  />
                );
              return (
                <VarianceLineRow
                  key={row.line.line.key}
                  line={row.line}
                  subtotal={row.subtotal}
                  r={r}
                  months={months}
                  firstForecast={firstForecast}
                  canNote={canNote}
                  cellProps={cellProps}
                  onNote={openNote}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {noting ? (
        <VarianceNoteDialog
          planId={variance.plan.id}
          line={noting.line}
          cell={noting.cell}
          onClose={() => {
            const [row, col] = noting.at as [number, number];
            setNoting(null);
            requestAnimationFrame(() => focusCell({ row, col }));
          }}
        />
      ) : null}
    </section>
  );
}

/** One line of the variance grid: its name, a cell per month, and the year's figures over the months with actuals. */
function VarianceLineRow({
  line,
  subtotal,
  r,
  months,
  firstForecast,
  canNote,
  cellProps,
  onNote,
}: {
  line: PnlVarianceLine;
  subtotal: boolean;
  r: number;
  months: PnlVariance["months"];
  firstForecast: number;
  canNote: boolean;
  cellProps: ReturnType<typeof useGridNavigation>["cellProps"];
  onNote: (row: number, col: number) => boolean;
}) {
  const tV = useTranslations("finance.pnl.variance");
  const format = usePnlFormat();
  const row = { subtotal };
  return (
    <tr key={line.line.key} role="row" data-line={line.line.key} className={cn(row.subtotal && "font-semibold")}>
      <Tooltip side="right" align="start" contentClassName="max-w-80" content={<LineTipContent line={line.line} />}>
        <th
          scope="row"
          role="rowheader"
          {...cellProps(r, 0)}
          className={cn(
            "bg-surface border-border sticky left-0 z-10 border-e px-4 py-2 text-start font-normal outline-none",
            "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:ring-inset",
            row.subtotal && "border-border-strong border-t font-semibold",
            line.line.calc === "source" && !row.subtotal && "ps-8",
          )}
        >
          <LineLabel line={line} />
        </th>
      </Tooltip>
      {line.cells.map((cell, c) => (
        <Tooltip key={cell.month} contentClassName="max-w-80" content={<VarianceTip line={line} cell={cell} />}>
          <td
            role="gridcell"
            {...cellProps(r, c + 1)}
            data-month={cell.month}
            data-basis={cell.actualBasis}
            onClick={() => onNote(r, c + 1)}
            className={cn(
              "border-border relative px-3 py-1.5 text-end align-top whitespace-nowrap outline-none",
              "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:ring-inset",
              months[c]?.kind === "forecast" && "bg-bg-subtle",
              c === firstForecast && "border-border-strong border-s border-dashed",
              row.subtotal && "border-border-strong border-t",
              canNote && cell.actualBasis !== "not_yet" && "cursor-pointer",
            )}
          >
            <VarianceValue line={line} cell={cell} />
          </td>
        </Tooltip>
      ))}
      <td
        role="gridcell"
        {...cellProps(r, months.length + 1)}
        className={cn(
          "bg-surface-subtle border-border-strong border-s px-3 py-1.5 text-end align-top whitespace-nowrap outline-none",
          "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:ring-inset",
          row.subtotal && "border-t",
        )}
      >
        <span className="block font-medium">{format.value(line.line, line.totalActual)}</span>
        <span className="text-muted block text-xs">
          {tV("plan")} {format.value(line.line, line.totalPlan)}
        </span>
        {line.totalVariance !== null ? (
          <span className="text-muted block text-xs">
            {signed(format.value(line.line, line.totalVariance))}
            {line.totalVariancePct !== null ? ` (${signed(format.percent(line.totalVariancePct))})` : ""}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

/** A positive variance carries its plus sign, so "+12,000.00" and "−12,000.00" read alike. */
const signed = (text: string) =>
  text === "—" || text.startsWith("−") || /^0(\.0+)?%?$/.test(text) ? text : `+${text}`;

function VarianceValue({ line, cell }: { line: PnlVarianceLine; cell: PnlVarianceCell }) {
  const t = useTranslations("finance.pnl.variance");
  const tStatus = useTranslations("status");
  const format = usePnlFormat();
  const dir = direction(cell.variance);
  if (cell.actualBasis === "not_yet" || cell.actualBasis === "none")
    return (
      <>
        <span className="text-muted block">{format.value(line.line, cell.plan)}</span>
        <span className="text-muted block text-xs">{tStatus(PNL_ACTUAL_BASIS[cell.actualBasis].labelKey)}</span>
      </>
    );
  return (
    <>
      <span className="flex items-center justify-end gap-1.5 font-medium">
        {cell.note ? <Icon name="chat" size={12} className="text-muted" label={t("hasNote")} /> : null}
        {format.value(line.line, cell.actual)}
      </span>
      <span className="text-muted block text-xs">
        {t("plan")} {format.value(line.line, cell.plan)}
      </span>
      {dir ? (
        <span className="text-muted flex items-center justify-end gap-1 text-xs" data-variance={dir.key}>
          <Icon name={dir.icon} size={12} label={t(dir.key)} />
          {signed(format.value(line.line, cell.variance))}
          {cell.variancePct !== null ? ` (${signed(format.percent(cell.variancePct))})` : ""}
        </span>
      ) : null}
    </>
  );
}

function VarianceTip({ line, cell }: { line: PnlVarianceLine; cell: PnlVarianceCell }) {
  const t = useTranslations("finance.pnl.variance");
  const tStatus = useTranslations("status");
  const tGrid = useTranslations("finance.pnl.grid");
  const format = usePnlFormat();
  const basis = PNL_ACTUAL_BASIS[cell.actualBasis];
  return (
    <span className="flex max-w-80 flex-col gap-1 py-1 text-start leading-snug">
      <span className="font-semibold">
        {tGrid("cellName", { line: format.label(line.line), month: format.month(cell.month) })}
      </span>
      <span>
        {t("plan")} {format.value(line.line, cell.plan)} · {t("actual")} {format.value(line.line, cell.actual)}
      </span>
      {cell.variance !== null ? (
        <span>
          {t("diff")} {signed(format.value(line.line, cell.variance))}
          {cell.variancePct !== null ? ` (${signed(format.percent(cell.variancePct))})` : ""}
        </span>
      ) : null}
      <span className="opacity-90">{tStatus(basis.labelKey)}</span>
      {cell.note ? (
        <span>
          <span className="opacity-75">{t("note")}: </span>
          {cell.note}
          {cell.noteBy ? (
            <span className="block opacity-75">
              {t("noteBy", { name: cell.noteBy.displayName, at: format.dateTime(cell.noteUpdatedAt) })}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/** A finance note on a variance (D-472 `admin.pnl.setVarianceNote`), allowed on a locked plan. */
function VarianceNoteDialog({
  planId,
  line,
  cell,
  onClose,
}: {
  planId: string;
  line: PnlVarianceLine;
  cell: PnlVarianceCell;
  onClose: () => void;
}) {
  const t = useTranslations("finance.pnl.variance");
  const tCommon = useTranslations("common");
  const format = usePnlFormat();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(cell.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (note.trim().length < 3) return setError(t("noteRequired"));
    setBusy(true);
    try {
      const { data } = await adminBrowserApis().contract.PUT(
        "/v1/admin/finance/pnl/plans/{planId}/variance-notes/{lineKey}/{month}",
        { params: { path: { planId, lineKey: line.line.key, month: cell.month } }, body: { note: note.trim() } },
      );
      queryClient.setQueryData(pnlKeys.variance(planId), data);
      toast.success(t("noteSaved"));
      onClose();
    } catch (failure) {
      setError(problemMessage(failure, t("noteFailed")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("noteTitle")}
      description={t("noteDescription", { line: format.label(line.line), month: format.month(cell.month) })}
      closeLabel={t("cancel")}
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <p className="border-border bg-surface-subtle rounded-card border px-4 py-3 text-sm tabular-nums">
          {t("plan")} {format.value(line.line, cell.plan)} · {t("actual")} {format.value(line.line, cell.actual)} ·{" "}
          {t("diff")} {signed(format.value(line.line, cell.variance))}
        </p>
        {error ? (
          <Callout tone="danger" live>
            {error}
          </Callout>
        ) : null}
        <Field label={t("note")} hint={t("noteHint")} required requiredLabel={tCommon("state.required")}>
          <Textarea rows={4} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={busy} iconStart="save">
            {t("noteSave")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
