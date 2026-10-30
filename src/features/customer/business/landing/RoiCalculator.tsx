"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { formatTHB } from "@/i18n/format";
import { trackBusiness } from "@/lib/analytics/business";
import { Slider } from "@/ui/components/Slider";

import { roi, type RoiInput } from "./rules";

/** The demo's slider ranges and starting values — the visitor's numbers, not getpack's. */
const INPUTS = {
  quotesPerMonth: { min: 1, max: 40, step: 1, start: 8 },
  hoursPerQuote: { min: 0.5, max: 6, step: 0.5, start: 2 },
  approvalsPerMonth: { min: 0, max: 40, step: 1, start: 10 },
  hourlyCost: { min: 100, max: 1000, step: 50, start: 250 },
} as const;
type Key = keyof typeof INPUTS;

/**
 * "บริษัทของคุณประหยัดได้เท่าไร" (business pack Phase 1 item 5): four of the visitor's own numbers → hours and baht
 * back per year, with the formula and the assumption (15 minutes saved per approval) printed under the result.
 */
export function RoiCalculator() {
  const t = useTranslations("business.landing.roi");
  const format = useFormat();
  const [input, setInput] = useState<RoiInput>({
    quotesPerMonth: INPUTS.quotesPerMonth.start,
    hoursPerQuote: INPUTS.hoursPerQuote.start,
    approvalsPerMonth: INPUTS.approvalsPerMonth.start,
    hourlyCost: INPUTS.hourlyCost.start,
  });
  const result = roi(input);
  const reported = useRef(false);

  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      return;
    }
    const timer = window.setTimeout(
      () =>
        trackBusiness("biz_roi_change", {
          quotes: input.quotesPerMonth,
          hours: input.hoursPerQuote,
          approvals: input.approvalsPerMonth,
          hourly_cost: input.hourlyCost,
        }),
      600,
    );
    return () => window.clearTimeout(timer);
  }, [input]);

  const rows: { key: Key; label: string; value: string }[] = [
    { key: "quotesPerMonth", label: t("quotes"), value: t("quotesValue", { n: input.quotesPerMonth }) },
    { key: "hoursPerQuote", label: t("hours"), value: t("hoursValue", { n: format.number(input.hoursPerQuote) }) },
    { key: "approvalsPerMonth", label: t("approvals"), value: t("approvalsValue", { n: input.approvalsPerMonth }) },
    {
      key: "hourlyCost",
      label: t("cost"),
      value: formatTHB(String(input.hourlyCost), format.locale, { decimals: 0 }),
    },
  ];

  return (
    <div className="border-border bg-surface rounded-panel grid gap-5 border p-4 sm:p-6 xl:grid-cols-2">
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-2 text-[13.5px]">
            <div className="text-muted flex justify-between gap-3">
              <span id={`roi-${row.key}`}>{row.label}</span>
              <b className="text-fg font-semibold tabular-nums">{row.value}</b>
            </div>
            <Slider
              aria-labelledby={`roi-${row.key}`}
              min={INPUTS[row.key].min}
              max={INPUTS[row.key].max}
              step={INPUTS[row.key].step}
              value={[input[row.key]]}
              valueText={row.value}
              onValueChange={([value]) =>
                setInput((current) => ({ ...current, [row.key]: value ?? INPUTS[row.key].start }))
              }
            />
          </div>
        ))}
      </div>
      {/* Project A: the result on the pale brand tint, the figure in brand green — not a solid green panel. */}
      <div aria-live="polite" className="bg-primary-subtle text-fg rounded-panel flex flex-col gap-2.5 p-5.5">
        <span className="text-muted text-sm">{t("result")}</span>
        <b className="text-primary text-[clamp(1.875rem,4vw,2.75rem)] leading-none font-bold tracking-[-0.02em] tabular-nums">
          {t("resultValue", { hours: format.number(result.hours) })}
        </b>
        <dl className="border-border grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 border-t pt-2.5 text-sm tabular-nums">
          <dt>{t("rowQuotes")}</dt>
          <dd className="text-right font-semibold">{t("rowHours", { n: format.number(result.quoteHours) })}</dd>
          <dt>{t("rowApprovals")}</dt>
          <dd className="text-right font-semibold">{t("rowHours", { n: format.number(result.approvalHours) })}</dd>
          <dt>{t("rowMoney")}</dt>
          <dd className="text-right font-semibold">
            {t("perYear", { amount: formatTHB(String(result.baht), format.locale, { decimals: 0 }) })}
          </dd>
        </dl>
        <small className="text-muted text-[12.5px]">{t("formula")}</small>
        <small className="text-muted text-[12.5px]">{t("assumption")}</small>
      </div>
    </div>
  );
}
