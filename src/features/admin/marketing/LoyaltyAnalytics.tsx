"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import type { LoyaltyAnalytics as Analytics } from "@/features/shared/loyalty-p2/types";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { BarValue, Composition } from "@/ui/components/charts";
import { DataTable } from "@/ui/components/DataTable";
import { DeskSection, StatsRow } from "@/ui/components/DeskPage";
import { Field } from "@/ui/components/Field";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, QueryError } from "../console";
import { MovementChart } from "./MovementChart";
import { FundingSplitSection } from "./FundingSplit";

type Movement = Analytics["movement"][number];
type Programme = Analytics["retention"]["programmes"][number];
type TierRow = Analytics["earnVsRedeem"]["byTier"][number];

/** The last 24 whole months, newest first, as `YYYY-MM` in Bangkok time. */
export function recentMonths(now: Date, count = 24): string[] {
  const bangkok = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  let year = bangkok.getUTCFullYear();
  let month = bangkok.getUTCMonth(); // the current month is not whole yet: start with the one before
  return Array.from({ length: count }, () => {
    if (month === 0) {
      year -= 1;
      month = 12;
    }
    const value = `${year}-${String(month).padStart(2, "0")}`;
    month -= 1;
    return value;
  });
}

const monthStart = (month: string) => `${month}-01T00:00:00+07:00`;

/**
 * `/marketing/loyalty/analytics` (loyalty P2, PLAN §6, D-480, D-488, D-495; prototype `p2-loyalty-analytics.html`):
 * the liability at the expected redemption rate — flagged "รอ CPA ยืนยัน" while the rate is pending — beside the
 * outstanding points, the breakage measured against the assumption (not reliable before 12 months of data) and the
 * difference to ledger 2330 for Finance; the monthly movement as a chart and its table; earn by source and by tier;
 * repeat orders of redeemers against non-redeemers and the conversion of each programme (rates withheld under 10
 * customers). Every figure is the API's (`admin.loyaltyAnalytics.get`); the page adds no money.
 */
export function LoyaltyAnalytics() {
  const t = useTranslations("marketing.analytics");
  const format = useFormat();
  const [now] = useState(() => Date.now());
  const months = recentMonths(new Date(now));
  const [to, setTo] = useState(months[0]!);
  const [from, setFrom] = useState(months[5]!);
  const range = from <= to ? { from, to } : { from: to, to: from };
  const monthLabel = (month: string) => format.date(monthStart(month), { style: "month" });
  const query = useQuery({
    queryKey: queryKeys.list("admin", "loyalty_analytics", range),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/loyalty/analytics", { params: { query: range } })).data!,
    staleTime: 5 * 60_000,
  });
  const data = query.data;
  const options = months.map((month) => ({ value: month, label: monthLabel(month) }));
  const rate = (value: string | null) => (value === null ? "—" : format.percent(value));
  const points = (value: number) => format.number(value);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("from")} className="w-40">
            <NativeSelect value={from} onValueChange={setFrom} options={options} />
          </Field>
          <Field label={t("to")} className="w-40">
            <NativeSelect value={to} onValueChange={setTo} options={options} />
          </Field>
        </div>
        {data ? (
          <p className="text-muted text-sm tabular-nums">{t("asOf", { at: format.dateTime(data.asOf) })}</p>
        ) : null}
      </div>

      {query.isError ? <QueryError error={query.error} onRetry={() => void query.refetch()} /> : null}

      {data ? (
        <StatsRow
          label={t("kpis.label")}
          columns={4}
          items={[
            {
              key: "liability",
              label: t("kpis.liability"),
              value: format.thb(data.liability.estimatedLiability),
              highlight: true,
              hint: (
                <span className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {t("kpis.atRate", { rate: format.percent(data.liability.expectedRedemptionRatePct) })}
                    {data.liability.rateConfirmation === "pending_cpa" ? (
                      <Badge size="sm" tone="warning">
                        {t("kpis.pendingCpa")}
                      </Badge>
                    ) : null}
                  </span>
                  <span>{t("kpis.faceValue", { amount: format.thb(data.liability.faceValue) })}</span>
                </span>
              ),
            },
            {
              key: "outstanding",
              label: t("kpis.outstanding"),
              value: points(data.liability.outstandingPoints),
              hint: t("kpis.outstandingHint", { date: format.date(data.asOf) }),
            },
            {
              key: "breakage",
              label: t("kpis.breakage", { months: data.breakage.windowMonths }),
              value: rate(data.breakage.actualPct),
              hint: (
                <span className="flex flex-col gap-1">
                  <span>{t("kpis.assumed", { pct: format.percent(data.breakage.assumedPct) })}</span>
                  {data.breakage.reliable ? null : (
                    <span>
                      <Badge size="sm">
                        {t("kpis.monthsOfData", { have: data.breakage.monthsOfData, need: data.breakage.windowMonths })}
                      </Badge>
                    </span>
                  )}
                </span>
              ),
            },
            {
              key: "difference",
              label: t("kpis.difference"),
              value: format.thb(data.liability.difference),
              hint: (
                <span className="flex flex-col gap-1">
                  <span>{t("kpis.ledger", { amount: format.thb(data.liability.ledgerBalance2330) })}</span>
                  <Link
                    href="/finance/reports/roll-forwards"
                    className="text-primary font-medium underline underline-offset-4"
                  >
                    {t("kpis.ledgerLink")}
                  </Link>
                </span>
              ),
            },
          ]}
        />
      ) : query.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : null}

      <DeskSection title={t("movement.title")} description={t("movement.note")}>
        {data ? (
          <div className="border-border bg-surface rounded-panel flex flex-col gap-3 border p-4 md:p-5">
            <MovementChart
              label={t("movement.title")}
              legend={{
                earned: t("movement.earned"),
                redeemed: t("movement.redeemed"),
                expired: t("movement.expired"),
              }}
              formatValue={points}
              bars={data.movement.map((row) => {
                const earned = row.earned.order + row.earned.activity + row.earned.referral + row.earned.bonus;
                return {
                  key: row.month,
                  label: format.date(monthStart(row.month), { style: "month" }).split(" ")[0]!,
                  title: t("movement.hover", {
                    month: monthLabel(row.month),
                    earned: points(earned),
                    redeemed: points(row.redeemed),
                    expired: points(row.expired),
                  }),
                  earned,
                  redeemed: row.redeemed,
                  expired: row.expired,
                };
              })}
            />
            <DataTable<Movement>
              caption={t("movement.table")}
              density="compact"
              rows={data.movement}
              getRowId={(row) => row.month}
              columns={[
                {
                  id: "month",
                  header: t("movement.month"),
                  cell: (row) => <span className="whitespace-nowrap">{monthLabel(row.month)}</span>,
                },
                {
                  id: "opening",
                  header: t("movement.opening"),
                  numeric: true,
                  cell: (row) => points(row.openingPoints),
                },
                { id: "order", header: t("sources.order"), numeric: true, cell: (row) => points(row.earned.order) },
                {
                  id: "activity",
                  header: t("sources.activity"),
                  numeric: true,
                  cell: (row) => points(row.earned.activity),
                },
                {
                  id: "referral",
                  header: t("sources.referral"),
                  numeric: true,
                  cell: (row) => points(row.earned.referral),
                },
                { id: "bonus", header: t("sources.bonus"), numeric: true, cell: (row) => points(row.earned.bonus) },
                { id: "redeemed", header: t("movement.redeemed"), numeric: true, cell: (row) => points(-row.redeemed) },
                { id: "returned", header: t("movement.returned"), numeric: true, cell: (row) => points(row.returned) },
                { id: "reversed", header: t("movement.reversed"), numeric: true, cell: (row) => points(-row.reversed) },
                { id: "expired", header: t("movement.expired"), numeric: true, cell: (row) => points(-row.expired) },
                { id: "adjusted", header: t("movement.adjusted"), numeric: true, cell: (row) => points(row.adjusted) },
                {
                  id: "closing",
                  header: t("movement.closing"),
                  numeric: true,
                  cell: (row) => <span className="font-semibold">{points(row.closingPoints)}</span>,
                },
              ]}
            />
          </div>
        ) : (
          <Skeleton className="h-80 w-full" />
        )}
      </DeskSection>

      <div className="grid gap-5 xl:grid-cols-[5fr_7fr]">
        <DeskSection title={t("sources.title")} description={t("sources.note")}>
          {data ? (
            <div className="border-border bg-surface rounded-panel flex flex-col gap-4 border p-4 md:p-5">
              <Composition
                label={t("sources.title")}
                parts={data.earnVsRedeem.bySource.map((row) => ({
                  key: row.source,
                  label: t(`sources.${row.source}`),
                  value: row.earned,
                  display: points(row.earned),
                }))}
              />
              <DataTable
                caption={t("sources.title")}
                density="compact"
                rows={data.earnVsRedeem.bySource}
                getRowId={(row) => row.source}
                columns={[
                  { id: "source", header: t("sources.source"), cell: (row) => t(`sources.${row.source}`) },
                  {
                    id: "earned",
                    header: t("sources.earned"),
                    numeric: true,
                    cell: (row) => (
                      <BarValue
                        value={row.earned}
                        max={Math.max(...data.earnVsRedeem.bySource.map((entry) => entry.earned))}
                        tone={row.source === "order" ? "primary" : "muted"}
                      >
                        {points(row.earned)}
                      </BarValue>
                    ),
                  },
                ]}
              />
            </div>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </DeskSection>
        <DeskSection title={t("tiers.title")} description={t("tiers.note")}>
          {data ? (
            <DataTable<TierRow>
              caption={t("tiers.title")}
              rows={data.earnVsRedeem.byTier}
              getRowId={(row) => row.tier}
              columns={[
                {
                  id: "tier",
                  header: t("tiers.tier"),
                  cell: (row) => (t.has(`tiers.names.${row.tier}`) ? t(`tiers.names.${row.tier}`) : row.tier),
                },
                { id: "members", header: t("tiers.members"), numeric: true, cell: (row) => points(row.members) },
                { id: "earned", header: t("tiers.earned"), numeric: true, cell: (row) => points(row.earned) },
                { id: "redeemed", header: t("tiers.redeemed"), numeric: true, cell: (row) => points(row.redeemed) },
                { id: "pct", header: t("tiers.pct"), numeric: true, cell: (row) => rate(row.redemptionPct) },
              ]}
            />
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </DeskSection>
      </div>

      <DeskSection title={t("retention.title")} description={t("retention.note")}>
        {data ? (
          <div className="border-border bg-surface rounded-panel grid gap-6 border p-4 md:p-5 xl:grid-cols-[4fr_7fr]">
            <dl className="m-0 flex flex-col gap-5">
              {(
                [
                  ["redeemers", data.retention.repeatOrderRate.redeemersPct, data.retention.repeatOrderRate.redeemers],
                  [
                    "nonRedeemers",
                    data.retention.repeatOrderRate.nonRedeemersPct,
                    data.retention.repeatOrderRate.nonRedeemers,
                  ],
                ] as const
              ).map(([key, pct, customers]) => (
                <div key={key}>
                  <dt className="flex justify-between gap-3 text-sm font-medium">
                    {t(`retention.${key}`)}
                    <span className="text-muted font-normal tabular-nums">
                      {t("retention.customers", { count: customers })}
                    </span>
                  </dt>
                  <dd className="m-0 mt-2 flex items-center gap-3">
                    <span aria-hidden="true" className="bg-surface-subtle block h-2 flex-1 overflow-hidden rounded">
                      <span
                        className={cn("block h-full rounded", key === "redeemers" ? "bg-primary" : "bg-border-strong")}
                        style={{ width: `${Math.min(100, Number(pct ?? 0))}%` }}
                      />
                    </span>
                    <span className="w-16 text-end font-semibold tabular-nums">{rate(pct)}</span>
                  </dd>
                </div>
              ))}
              <p className="text-muted m-0 text-[0.8125rem]">
                {t("retention.window", { days: data.retention.repeatOrderRate.windowDays })}
              </p>
            </dl>
            <DataTable<Programme>
              caption={t("retention.programmes")}
              density="compact"
              rows={data.retention.programmes}
              getRowId={(row) => row.programme}
              columns={[
                { id: "programme", header: t("retention.programme"), cell: (row) => t(`programmes.${row.programme}`) },
                {
                  id: "window",
                  header: t("retention.windowCol"),
                  numeric: true,
                  cell: (row) => t("retention.days", { days: row.windowDays }),
                },
                { id: "sent", header: t("retention.sent"), numeric: true, cell: (row) => points(row.sent) },
                {
                  id: "converted",
                  header: t("retention.converted"),
                  numeric: true,
                  cell: (row) => points(row.converted),
                },
                {
                  id: "rate",
                  header: t("retention.rate"),
                  numeric: true,
                  cell: (row) =>
                    row.ratePct === null ? (
                      <span className="text-muted" title={t("retention.withheld")}>
                        —<span className="sr-only">{t("retention.withheld")}</span>
                      </span>
                    ) : (
                      <BarValue value={Number(row.ratePct)} max={100}>
                        {rate(row.ratePct)}
                      </BarValue>
                    ),
                },
              ]}
            />
          </div>
        ) : (
          <Skeleton className="h-56 w-full" />
        )}
      </DeskSection>

      {/* Loyalty P4 (D-506): who funded the capacity deals' discounts. */}
      <FundingSplitSection range={range} />

      <p className="border-border flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-sm">
        <Link href="/marketing" className="text-primary inline-flex items-center gap-1 font-medium hover:underline">
          {t("links.promotions")}
          <Icon name="chevron-right" size={16} aria-hidden="true" />
        </Link>
        <Link
          href="/reports/points_liability"
          className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
        >
          <Icon name="download" size={16} aria-hidden="true" />
          {t("links.export")}
        </Link>
      </p>
    </div>
  );
}
