"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export interface LadderRow {
  quantity: number;
  /** The API's price per unit (VAT-inclusive, D-220); null while it loads, or when the quantity is quote-only. */
  unitPrice: string | null;
  /** The API's saving against the smallest row, in percent; null on the smallest. */
  savingPct: string | number | null;
  /** Priced by quotation, not instantly. */
  quoteOnly?: boolean;
}

/**
 * "สั่งมากขึ้น ราคาต่อใบลดลง" (loyalty P1.5, STITCH-NOTES §c; prototype `p15-pdp-ladder.html`): the quantity ladder
 * of the calculation the page already priced — no new pricing. From 768 px a table whose rows are buttons that set
 * the quantity (the current one tinted, with a 2 px `primary` rule and "ที่เลือกอยู่"); below, tiles that scroll inside
 * their own frame, a "กำหนดเอง" tile, and "ดูราคาทุกจำนวน" for the table. One savings format: "ประหยัด x%" against the
 * smallest row, from the API.
 */
export function VolumeLadder({
  rows,
  selected,
  unit,
  onSelect,
  pending = false,
  customHref,
  className,
}: {
  rows: readonly LadderRow[];
  selected: number;
  /** The sales unit in the reader's language ("ใบ"). */
  unit: string;
  onSelect: (quantity: number) => void;
  /** A new price is on its way: the figures are the last ones, dimmed. */
  pending?: boolean;
  /** Where "กำหนดเอง" goes (the configurator's quantity step). */
  customHref?: string;
  className?: string;
}) {
  const t = useTranslations("deals.ladder");
  const format = useFormat();
  const id = useId();
  const [table, setTable] = useState(false);
  if (rows.length === 0) return null;
  const base = rows[0]!;
  const qty = (quantity: number) => t("qty", { qty: format.number(quantity), unit });
  const price = (row: LadderRow) => (row.quoteOnly ? t("quote") : row.unitPrice ? format.thb(row.unitPrice) : null);
  const saving = (row: LadderRow) =>
    row.savingPct !== null && row.savingPct !== undefined && String(row.savingPct) !== "0"
      ? t("saving", { pct: format.percent(String(row.savingPct)) })
      : null;
  const next = rows.find((row) => row.quantity > selected && row.unitPrice && !row.quoteOnly) ?? null;
  const b = (chunks: React.ReactNode) => <b className="text-fg font-semibold">{chunks}</b>;

  const tableNode = (
    <div className="border-border rounded-card overflow-hidden border">
      <table aria-labelledby={`${id}-title`} className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-subtle border-border border-b">
            <th scope="col" className="text-muted px-3.5 py-2 text-start text-[0.78125rem] font-medium">
              {t("quantity")}
            </th>
            <th scope="col" className="text-muted px-3.5 py-2 text-end text-[0.78125rem] font-medium">
              {t("price", { unit })}
            </th>
            <th scope="col" className="text-muted px-3.5 py-2 text-end text-[0.78125rem] font-medium">
              {t("against", { qty: format.number(base.quantity), unit })}
            </th>
          </tr>
        </thead>
        <tbody className={cn(pending && "opacity-60")}>
          {rows.map((row) => {
            const current = row.quantity === selected;
            return (
              <tr
                key={row.quantity}
                className={cn(
                  "border-border border-t first:border-t-0",
                  current ? "bg-primary-subtle shadow-[inset_2px_0_0_var(--color-primary)]" : "hover:bg-surface-subtle",
                )}
              >
                <th scope="row" className="p-0 text-start font-medium">
                  <button
                    type="button"
                    aria-pressed={current}
                    aria-label={
                      price(row)
                        ? t("choose", { qty: format.number(row.quantity), unit, price: price(row)! })
                        : qty(row.quantity)
                    }
                    onClick={() => onSelect(row.quantity)}
                    className={cn(
                      "focus-visible:ring-focus-ring flex min-h-11 w-full items-center gap-2 px-3.5 text-start tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-inset",
                      current && "text-primary-subtle-fg font-semibold",
                    )}
                  >
                    {qty(row.quantity)}
                    {current ? (
                      <span className="text-primary-subtle-fg text-xs font-medium">{t("selected")}</span>
                    ) : null}
                  </button>
                </th>
                <td className="px-3.5 text-end tabular-nums">
                  {price(row) ?? (
                    <span className="bg-bg-subtle inline-block h-3 w-12 animate-pulse rounded-sm align-middle" />
                  )}
                </td>
                {/* On the chosen row's tint the success green falls under 4.5:1; the deeper success ink keeps it readable. */}
                <td className={cn("px-3.5 text-end tabular-nums", current ? "text-success-subtle-fg" : "text-success")}>
                  {saving(row) ?? <span className="text-muted">{t("none")}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-[0.8125rem]">
        <span id={`${id}-title`} className="font-semibold">
          {t("title", { unit })}
        </span>
        <small className="text-muted text-xs">{t("note", { unit })}</small>
      </div>

      <div className="hidden md:block">{tableNode}</div>

      <div className="md:hidden">
        <div className="border-border bg-surface rounded-card border p-3">
          <div
            role="group"
            aria-labelledby={`${id}-title`}
            className="-m-0.5 flex snap-x snap-mandatory [scrollbar-width:none] gap-2 overflow-x-auto p-0.5 [&::-webkit-scrollbar]:hidden"
          >
            {rows.map((row) => {
              const current = row.quantity === selected;
              return (
                <button
                  key={row.quantity}
                  type="button"
                  aria-pressed={current}
                  onClick={() => onSelect(row.quantity)}
                  className={cn(
                    "rounded-control focus-visible:ring-focus-ring flex w-28 shrink-0 snap-start flex-col items-start gap-0.5 border px-3 py-2.5 text-start outline-none focus-visible:ring-2",
                    current
                      ? "border-primary bg-primary-subtle ring-primary ring-1 ring-inset"
                      : "border-border-strong bg-surface",
                  )}
                >
                  <b className="text-sm font-semibold tabular-nums">{qty(row.quantity)}</b>
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      current ? "text-primary-subtle-fg" : "text-muted",
                      pending && "opacity-60",
                    )}
                  >
                    {price(row) ?? "—"}
                  </span>
                  <small
                    className={cn(
                      "text-xs",
                      !saving(row) ? "text-muted" : current ? "text-success-subtle-fg" : "text-success",
                    )}
                  >
                    {saving(row) ?? t("start")}
                  </small>
                </button>
              );
            })}
            {customHref ? (
              <Link
                href={customHref}
                className="rounded-control border-border-strong focus-visible:ring-focus-ring flex w-28 shrink-0 snap-start items-center justify-center border border-dashed px-3 text-sm font-medium outline-none focus-visible:ring-2"
              >
                {t("custom")}
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            aria-expanded={table}
            onClick={() => setTable((open) => !open)}
            className="text-primary mt-2.5 inline-flex min-h-11 items-center gap-1 text-sm font-medium"
          >
            {table ? t("hideAll") : t("showAll")}
            <Icon name={table ? "chevron-up" : "chevron-down"} size={16} aria-hidden="true" />
          </button>
        </div>
        {table ? <div className="mt-3">{tableNode}</div> : null}
      </div>

      {next ? (
        <p className="text-muted m-0 mt-2.5 text-[0.84375rem]">
          {t.rich("nudge", { qty: format.number(next.quantity), unit, price: format.thb(next.unitPrice), b })}
        </p>
      ) : null}
    </div>
  );
}
