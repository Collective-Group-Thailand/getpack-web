"use client";

import { useTranslations } from "next-intl";

import { SALES_AUTHORITY_LEVEL, SALES_FLOOR_CHECK } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { BridgeChart, type BridgeStep } from "@/ui/components/BridgeChart";
import { cn } from "@/ui/lib/cn";

import { StatusChip } from "../../console";
import { Figure, useFigureText } from "../figure";
import type { FullWaterfall, MarginWaterfall, Waterfall } from "../resources";

/** A decimal string the API sent, parsed for drawing only (bar geometry). */
const n = (value: string | null | undefined) => (value ? Number(value) : 0);
/** "-128.40" → "128.40": a sign moved into the words, not arithmetic. */
const unsigned = (value: string) => value.replace(/^-/, "");

export interface WaterfallContext {
  /** Who is looking (the watermark, D-470). */
  viewer: string;
  /** The quote's code and the link to it — the source every figure names. */
  source: { label: string; href?: string | null };
  /** When the API worked the figures out. */
  asOf: string;
}

/**
 * The waterfall in exactly the tier the API sent (D-470 field-level RBAC): a full bridge (`full`), the percentages
 * against the floor (`margin_pct`), or the authority colour alone (`authority`). It switches on `visibility` and
 * draws what is in the payload — nothing is hidden here, because nothing that is not allowed ever arrives.
 */
export function WaterfallView({
  waterfall,
  context,
  compact = false,
}: {
  waterfall: Waterfall;
  context: WaterfallContext;
  compact?: boolean;
}) {
  switch (waterfall.visibility) {
    case "full":
      return <FullBridge waterfall={waterfall} context={context} compact={compact} />;
    case "margin_pct":
      return <MarginView waterfall={waterfall} context={context} />;
    default:
      return <AuthorityView waterfall={waterfall} />;
  }
}

function AuthorityView({ waterfall }: { waterfall: Extract<Waterfall, { visibility: "authority" }> }) {
  const t = useTranslations("sales.waterfall");
  return (
    <div className="bg-surface-subtle rounded-card flex flex-col items-start gap-2 p-4" data-tier="authority">
      <StatusChip map={SALES_AUTHORITY_LEVEL} value={waterfall.authorityLevel} size="md" />
      <p className="text-muted text-sm">{t(`authority.${waterfall.authorityLevel}`)}</p>
      <p className="text-muted text-xs">{t("authority.why")}</p>
    </div>
  );
}

function MarginView({ waterfall, context }: { waterfall: MarginWaterfall; context: WaterfallContext }) {
  const t = useTranslations("sales.waterfall");
  const format = useFormat();
  const rows = [
    { key: "grossMarginPct", value: waterfall.grossMarginPct },
    { key: "contributionPct", value: waterfall.contributionPct },
  ] as const;
  const top = Math.max(n(waterfall.floorPct) * 2.5, ...rows.map((row) => n(row.value)), 1);
  const x = (value: number) => `${(Math.max(0, value) / top) * 100}%`;
  return (
    <div className="flex flex-col gap-4" data-tier="margin_pct">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip map={SALES_FLOOR_CHECK} value={waterfall.floorCheck} size="md" />
        <StatusChip map={SALES_AUTHORITY_LEVEL} value={waterfall.authorityLevel} />
      </div>
      <dl className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["discountPct", waterfall.discountPct],
            ["grossMarginPct", waterfall.grossMarginPct],
            ["contributionPct", waterfall.contributionPct],
            ["floorPct", waterfall.floorPct],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="bg-surface-subtle rounded-card flex flex-col gap-0.5 p-3">
            <dt className="text-muted text-xs">{t(`lines.${key}`)}</dt>
            <dd className="text-lg font-semibold">
              <Figure name={key} source={context.source} asOf={context.asOf}>
                {format.percent(value)}
              </Figure>
            </dd>
          </div>
        ))}
      </dl>
      <figure aria-label={t("marginTitle")} className="flex flex-col gap-1">
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li
              key={row.key}
              className="grid grid-cols-[minmax(7rem,12rem)_minmax(0,1fr)_4.5rem] items-center gap-3 py-1.5"
            >
              <span className="text-sm">{t(`lines.${row.key}`)}</span>
              <span aria-hidden className="relative h-9">
                <span
                  className="border-danger absolute inset-y-0 border-l border-dashed"
                  style={{ left: x(n(waterfall.floorPct)) }}
                />
                <span
                  className={cn(
                    "rounded-e-thumb absolute top-1/2 h-4 -translate-y-1/2 sm:h-5",
                    row.key === "contributionPct" ? "bg-primary" : "bg-muted",
                  )}
                  style={{ left: 0, width: x(n(row.value)) }}
                />
              </span>
              <span className="text-end text-sm font-semibold tabular-nums">{format.percent(row.value)}</span>
            </li>
          ))}
        </ul>
        <figcaption className="text-muted flex items-center gap-2 text-xs">
          <span aria-hidden className="border-danger h-3 border-l border-dashed" />
          {t("floorLine", { pct: format.percent(waterfall.floorPct) })}
        </figcaption>
      </figure>
    </div>
  );
}

function FullBridge({
  waterfall: w,
  context,
  compact,
}: {
  waterfall: FullWaterfall;
  context: WaterfallContext;
  compact: boolean;
}) {
  const t = useTranslations("sales.waterfall");
  const format = useFormat();
  const explain = useFigureText();
  const tip = (name: string) => explain(name, { source: context.source.label, asOf: context.asOf });
  const minus = (amount: string) => `− ${format.thb(unsigned(amount))}`;
  const signed = (amount: string) => (amount.startsWith("-") ? minus(amount) : `+ ${format.thb(amount)}`);
  const steps: BridgeStep[] = [
    {
      key: "listRevenue",
      label: t("lines.listRevenue"),
      kind: "total",
      value: n(w.listRevenue),
      display: format.thb(w.listRevenue),
      tip: tip("listRevenue"),
    },
    {
      key: "discount",
      label: t("lines.discount"),
      kind: "delta",
      value: -n(w.discountAmount),
      display: minus(w.discountAmount),
      share: format.percent(w.discountPct),
      tip: tip("discount"),
    },
    {
      key: "netRevenue",
      label: t("lines.netRevenue"),
      kind: "total",
      value: n(w.netRevenue),
      display: format.thb(w.netRevenue),
      tip: tip("netRevenue"),
    },
    {
      key: "factoryCost",
      label: t("lines.factoryCost"),
      kind: "delta",
      value: -n(w.factoryCost),
      display: minus(w.factoryCost),
      tip: tip("factoryCost"),
    },
    {
      key: "shippingDifference",
      label: t("lines.shippingDifference"),
      kind: "delta",
      value: n(w.shippingDifference),
      display: signed(w.shippingDifference),
      tip: tip("shippingDifference"),
    },
    {
      key: "paymentFee",
      label: w.paymentFee.method ? t("lines.paymentFeeOf", { method: w.paymentFee.method }) : t("lines.paymentFee"),
      kind: "delta",
      value: -n(w.paymentFee.amount),
      display: minus(w.paymentFee.amount),
      note: w.paymentFee.status === "not_set" ? t("notSet") : undefined,
      tip: tip("paymentFee"),
    },
    {
      key: "freeServices",
      label: t("lines.freeServices"),
      kind: "delta",
      value: -n(w.freeServices),
      display: minus(w.freeServices),
      tip: tip("freeServices"),
    },
    {
      key: "grossMargin",
      label: t("lines.grossMargin"),
      kind: "total",
      value: n(w.grossMargin),
      display: format.thb(w.grossMargin),
      share: format.percent(w.grossMarginPct),
      tip: tip("grossMargin"),
    },
    {
      key: "commission",
      label: t("lines.commission"),
      kind: "delta",
      value: -n(w.commissionAmount),
      display: minus(w.commissionAmount),
      share: format.percent(w.commissionRatePct),
      tip: tip("commission"),
    },
    {
      key: "creditCost",
      label: t("lines.creditCost"),
      kind: "delta",
      value: -n(w.creditCost),
      display: minus(w.creditCost),
      share: format.percent(w.creditCostPct),
      tip: tip("creditCost"),
    },
    {
      key: "badDebt",
      label: t("lines.badDebt"),
      kind: "delta",
      value: -n(w.badDebtProvision.amount),
      display: minus(w.badDebtProvision.amount),
      share: w.badDebtProvision.pct ? format.percent(w.badDebtProvision.pct) : undefined,
      note: w.badDebtProvision.status === "set" ? undefined : t(`badDebt.${w.badDebtProvision.status}`),
      tip: tip("badDebt"),
    },
    {
      key: "contributionAfterCommission",
      label: t("lines.contributionAfterCommission"),
      kind: "total",
      value: n(w.contributionAfterCommission),
      display: format.thb(w.contributionAfterCommission),
      share: format.percent(w.contributionPct),
      emphasis: true,
      tip: tip("contributionAfterCommission"),
    },
  ];
  return (
    <div className="flex flex-col gap-3" data-tier="full">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip map={SALES_FLOOR_CHECK} value={w.floorCheck} size="md" />
        <StatusChip map={SALES_AUTHORITY_LEVEL} value={w.authorityLevel} />
      </div>
      <BridgeChart
        title={t("bridgeTitle")}
        steps={
          compact
            ? steps.filter((step) => step.kind === "total" || step.key === "discount" || step.key === "commission")
            : steps
        }
        // The floor as an amount on the same scale (geometry only): the floor share of net revenue.
        threshold={{
          value: (n(w.netRevenue) * n(w.floorPct)) / 100,
          label: t("floorLine", { pct: format.percent(w.floorPct) }),
        }}
        watermark={context.viewer}
        labels={{
          showTable: t("showTable"),
          hideTable: t("showChart"),
          step: t("tableStep"),
          amount: t("tableAmount"),
          share: t("tableShare"),
        }}
      />
    </div>
  );
}
