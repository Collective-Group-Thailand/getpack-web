"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { formatTHB } from "@/i18n/format";
import { Meter } from "@/ui/components/Meter";
import { Slider } from "@/ui/components/Slider";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { budgetState } from "./rules";
import type { PricedProduct } from "./samples.server";

/** The visitor's own budget inputs (not business values): whole baht, slider ranges of the demo. */
const BUDGET = { min: 10_000, max: 200_000, step: 5_000, start: 50_000 };

/**
 * "ควบคุมการสั่งซื้อ" (business pack Phase 1 item 4): how the company catalogue and the budgets will work — both
 * Phase 4 features, labelled "เร็ว ๆ นี้" from `storefront.roadmap`. Nothing here is sample data: the catalogue rows
 * are real products with their real prices per quantity (the pricing service's tiers; the stepper walks those
 * quantities, no amount is added up), and the budget uses only numbers the visitor enters.
 */
export function ControlDemo({
  products,
  soonLabel,
  catalogueSoon,
  budgetsSoon,
}: {
  products: PricedProduct[];
  soonLabel: string;
  catalogueSoon: boolean;
  budgetsSoon: boolean;
}) {
  const t = useTranslations("business.landing.control");
  const format = useFormat();
  // Index into each product's priced quantities; -1 = not chosen.
  const [chosen, setChosen] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((product, index) => [product.slug, index === 0 ? 0 : -1])),
  );
  const [budget, setBudget] = useState(BUDGET.start);
  const [spent, setSpent] = useState(Math.round((BUDGET.start * 0.6) / BUDGET.step) * BUDGET.step);
  const { pct, state } = budgetState(budget, spent);
  const baht = (value: number) => formatTHB(String(value), format.locale, { decimals: 0 });
  const lines = products.filter((product) => (chosen[product.slug] ?? -1) >= 0);
  const pieces = lines.reduce((sum, product) => sum + product.steps[chosen[product.slug]!]!.quantity, 0);
  const soon = (on: boolean) =>
    on ? (
      <span className="bg-instant-subtle text-instant-subtle-fg rounded-control px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
        {soonLabel}
      </span>
    ) : null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      {products.length > 0 ? (
        <section
          aria-labelledby="ctl-catalogue"
          className="border-border bg-surface rounded-panel flex flex-col gap-3 border p-5.5"
        >
          <h3 id="ctl-catalogue" className="flex flex-wrap items-center justify-between gap-2.5 text-lg font-semibold">
            {t("catalogue.title")}
            <span className="flex gap-1.5">
              {soon(catalogueSoon)}
              <span className="border-border text-subtle rounded-control border border-dashed px-2 py-0.5 text-[11px] font-medium">
                {t("demo")}
              </span>
            </span>
          </h3>
          <p className="text-muted -mt-1 text-sm">{t("catalogue.body")}</p>
          <ul>
            {products.map((product) => {
              const at = chosen[product.slug] ?? -1;
              const step = at >= 0 ? product.steps[at]! : null;
              const move = (by: number) =>
                setChosen((current) => ({
                  ...current,
                  [product.slug]: Math.max(-1, Math.min(product.steps.length - 1, (current[product.slug] ?? -1) + by)),
                }));
              return (
                <li
                  key={product.slug}
                  className="border-border grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 border-t py-2.5 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto]"
                >
                  <span className="bg-surface-subtle text-subtle rounded-thumb grid h-10 place-items-center">
                    <Icon name="box" size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-sm font-semibold">{product.name}</b>
                    <small className="text-subtle block text-[12.5px] tabular-nums">
                      {step
                        ? t("catalogue.line", { qty: format.number(step.quantity), amount: format.thb(step.amount) })
                        : t("catalogue.linePlain")}
                    </small>
                  </span>
                  <span className="border-border-strong rounded-control col-start-2 inline-flex h-9 items-stretch self-start overflow-hidden border sm:col-start-auto sm:self-center">
                    <button
                      type="button"
                      onClick={() => move(-1)}
                      disabled={at < 0}
                      aria-label={t("catalogue.less", { name: product.name })}
                      className="hover:bg-bg-subtle grid w-9 place-items-center disabled:opacity-40"
                    >
                      <Icon name="minus" size={16} aria-hidden="true" />
                    </button>
                    <span
                      className="grid min-w-16 place-items-center px-2 text-sm font-semibold tabular-nums"
                      aria-live="polite"
                    >
                      {step ? format.number(step.quantity) : "0"}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(1)}
                      disabled={at >= product.steps.length - 1}
                      aria-label={t("catalogue.more", { name: product.name })}
                      className="hover:bg-bg-subtle grid w-9 place-items-center disabled:opacity-40"
                    >
                      <Icon name="plus" size={16} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
            <b className="font-semibold tabular-nums">
              {t("catalogue.total", { count: lines.length, qty: format.number(pieces) })}
            </b>
            <span className="text-subtle text-[13px]">{t("catalogue.hint")}</span>
          </div>
          <p className="text-subtle text-xs">{t("catalogue.priceNote")}</p>
        </section>
      ) : null}
      <section
        aria-labelledby="ctl-budget"
        className="border-border bg-surface rounded-panel flex flex-col gap-3 border p-5.5"
      >
        <h3 id="ctl-budget" className="flex flex-wrap items-center justify-between gap-2.5 text-lg font-semibold">
          {t("budget.title")}
          <span className="flex gap-1.5">
            {soon(budgetsSoon)}
            <span className="border-border text-subtle rounded-control border border-dashed px-2 py-0.5 text-[11px] font-medium">
              {t("demo")}
            </span>
          </span>
        </h3>
        <p className="text-muted -mt-1 text-sm">{t("budget.body")}</p>
        <div className="border-border flex flex-col gap-3 border-t pt-3 text-[13.5px]">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between gap-3">
              <span id="ctl-budget-amount">{t("budget.budget")}</span>
              <b className="font-semibold tabular-nums">{baht(budget)}</b>
            </div>
            <Slider
              aria-labelledby="ctl-budget-amount"
              min={BUDGET.min}
              max={BUDGET.max}
              step={BUDGET.step}
              value={[budget]}
              valueText={baht(budget)}
              onValueChange={([value]) => setBudget(value ?? BUDGET.start)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between gap-3">
              <span id="ctl-budget-spent">{t("budget.spent")}</span>
              <b className="font-semibold tabular-nums">{baht(spent)}</b>
            </div>
            <Slider
              aria-labelledby="ctl-budget-spent"
              min={0}
              max={Math.round((budget * 1.2) / BUDGET.step) * BUDGET.step}
              step={BUDGET.step / 5}
              value={[Math.min(spent, budget * 1.2)]}
              valueText={baht(spent)}
              onValueChange={([value]) => setSpent(value ?? 0)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3">
              <b className="font-semibold">{t("budget.unit")}</b>
              <span className="tabular-nums">
                {baht(spent)} / {baht(budget)}
              </span>
            </div>
            <Meter
              value={pct}
              label={t("budget.unit")}
              valueText={t("budget.meter", { pct })}
              tone={state === "over" ? "danger" : state === "warn" ? "warning" : "success"}
              marker={80}
            />
            <small
              aria-live="polite"
              className={cn(
                "text-[12.5px]",
                state === "over" && "text-danger-subtle-fg",
                state === "warn" && "text-warning-subtle-fg",
                state === "ok" && "text-success-subtle-fg",
              )}
            >
              {state === "over" ? t("budget.over") : state === "warn" ? t("budget.warn", { pct }) : t("budget.ok")}
            </small>
          </div>
          <p className="text-subtle inline-flex items-center gap-2 text-xs">
            <Icon name="spreadsheet" size={15} aria-hidden="true" />
            {t("budget.report")}
          </p>
        </div>
      </section>
    </div>
  );
}
