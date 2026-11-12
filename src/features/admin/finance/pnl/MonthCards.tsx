"use client";

import { useTranslations } from "next-intl";

import { PNL_MONTH_KIND } from "@/domain/status";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { usePnlFormat } from "./format";
import type { PnlGrid, PnlLineKey, PnlVariance } from "./resources";

/** The lines a month card carries: the statement's four landmarks. */
const CARD_LINES: readonly PnlLineKey[] = ["net_revenue", "gross_margin", "ebit", "net_profit"];

/**
 * The plan on a phone (D-472 item 6): one card per month, read-only — the four landmark lines of the statement, the
 * month's standing (actual, forecast, period still open) and how many cells still wait for a person; with the
 * variance switch on, each figure shows the actual over the plan. Editing stays on a tablet or a computer.
 */
export function MonthCards({ grid, variance }: { grid: PnlGrid; variance: PnlVariance | undefined }) {
  const t = useTranslations("finance.pnl");
  const tStatus = useTranslations("status");
  const format = usePnlFormat();
  return (
    <section aria-labelledby="pnl-months" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="pnl-months" className="text-base font-semibold">
          {t("phone.months")}
        </h2>
        <p className="text-muted flex items-center gap-1.5 text-xs">
          <Icon name="eye" size={14} aria-hidden />
          {t("phone.readOnly")}
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {grid.months.map((month, at) => {
          const kind = PNL_MONTH_KIND[month.kind];
          const empty = grid.lines.filter(
            (row) => row.cells[at]?.mode === "manual" && row.cells[at]?.value === null,
          ).length;
          return (
            <li
              key={month.month}
              data-month-card={month.month}
              className={cn(
                "border-border rounded-card flex flex-col gap-3 border p-4",
                month.kind === "forecast" ? "bg-bg-subtle" : "bg-surface",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{format.month(month.month)}</h3>
                <span className="text-muted inline-flex items-center gap-1 text-xs">
                  <Icon name={month.periodOpen ? "hourglass" : kind.icon} size={12} aria-hidden />
                  {month.periodOpen ? t("grid.periodOpen") : tStatus(kind.labelKey)}
                </span>
              </div>
              <dl className="divide-border flex flex-col divide-y text-sm">
                {CARD_LINES.map((key) => {
                  const row = grid.lines.find((line) => line.line.key === key);
                  if (!row) return null;
                  const v = variance?.lines.find((line) => line.line.key === key)?.cells[at];
                  const hasActual = v && v.actualBasis !== "not_yet" && v.actualBasis !== "none";
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-baseline justify-between gap-3 py-1.5",
                        key === "net_profit" && "font-semibold",
                      )}
                    >
                      <dt className={cn(key !== "net_profit" && "text-muted")}>{format.label(row.line)}</dt>
                      <dd className="flex flex-col items-end tabular-nums">
                        <span>{format.value(row.line, hasActual ? v.actual : row.cells[at]?.value)}</span>
                        {hasActual ? (
                          <span className="text-muted text-xs font-normal">
                            {t("variance.plan")} {format.value(row.line, v.plan)}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {empty > 0 ? (
                <p className="text-primary-subtle-fg flex items-center gap-1.5 text-xs">
                  <Icon name="edit" size={12} aria-hidden />
                  {t("phone.empty", { count: empty })}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
