import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { queryOf } from "@/features/partner/erp/ui";
import { BarValue } from "@/features/partner/charts";
import { PageError, PartnerPage, PartnerStats } from "@/features/partner/frame";
import { bangkokMonth, PeriodPicker, shiftMonth, stepLabel } from "@/features/partner/period";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.profit"))("title") };
}

const BY = ["getpack_job", "customer", "item", "sales_order"] as const;
type By = (typeof BY)[number];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Gross profit (D-376): what the month's invoices earned over the cost of what they delivered. */
export default async function ProfitPage({ searchParams }: { searchParams: Promise<{ month?: string; by?: string }> }) {
  const query = await searchParams;
  const month = query.month && MONTH.test(query.month) ? query.month : bangkokMonth();
  const by: By = BY.includes(query.by as By) ? (query.by as By) : "getpack_job";
  const [t, tPeriod, tNav, format, context] = await Promise.all([
    getTranslations("partnerInsight.profit"),
    getTranslations("partnerSales.tax"),
    getTranslations("partner.sidebar.items"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/insight/profitability", {
          params: { path: { factoryId: context.factoryId }, query: { month, by } },
        })
      ).data!,
  );
  const noCost = by === "getpack_job" ? (read.data?.rows.filter((r) => Number(r.cost) === 0).length ?? 0) : 0;
  const pct = (v: string | null) => (v === null ? "—" : format.percent(v, 1));
  // One scale for both bars of a row: cost reads against the revenue it was spent for.
  const maxRevenue = Math.max(0, ...(read.data?.rows ?? []).flatMap((r) => [Number(r.revenue), Number(r.cost)]));
  const href = (m: string) => `/insight/profit${queryOf({ month: m, by: by === "getpack_job" ? undefined : by })}`;
  return (
    <PartnerPage full title={t("title")} description={t("body")}>
      <ListToolbar>
        <ViewTabs
          label={t("by")}
          current={by}
          items={BY.map((key) => ({
            key,
            href: `/insight/profit${queryOf({ month, by: key === "getpack_job" ? undefined : key })}`,
            label: t(`views.${key}`),
          }))}
        />
        <PeriodPicker
          action="/insight/profit"
          label={tPeriod("monthNav")}
          hidden={{ by: by === "getpack_job" ? undefined : by }}
          fields={[{ name: "month", label: t("month"), value: month, type: "month" }]}
          submit={t("show")}
          prev={{ href: href(shiftMonth(month, -1)), label: stepLabel(tPeriod("prevMonth")) }}
          {...(month < bangkokMonth()
            ? { next: { href: href(shiftMonth(month, 1)), label: stepLabel(tPeriod("nextMonth")) } }
            : {})}
        />
      </ListToolbar>
      {read.data ? (
        <>
          <PartnerStats
            label={t("totals")}
            columns={3}
            items={[
              { key: "r", label: t("revenue"), value: format.thb(read.data.revenue) },
              { key: "c", label: t("cost"), value: format.thb(read.data.cost) },
              {
                key: "g",
                label: t("grossProfit"),
                value: format.thb(read.data.grossProfit),
                hint: noCost ? t("noCostCount", { n: noCost }) : pct(read.data.grossProfitPct),
                tone: noCost ? "warning" : Number(read.data.grossProfit) < 0 ? "danger" : "neutral",
                highlight: !noCost && Number(read.data.grossProfit) >= 0,
              },
            ]}
          />
          <PartnerTable
            caption={t("title")}
            rows={read.data.rows}
            rowKey={(row) => row.key.id}
            {...(by === "getpack_job"
              ? { rowHref: (row: { key: { id: string } }) => `/insight/costs/${row.key.id}` }
              : {})}
            rowTone={(row) => (Number(row.grossProfit) < 0 ? "danger" : undefined)}
            empty={
              <EmptyState
                icon="trend-up"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  <Button asChild variant="secondary">
                    <Link href="/invoices">{tNav("invoices")}</Link>
                  </Button>
                }
              />
            }
            columns={[
              {
                key: "k",
                header: t(`views.${by}`),
                primary: true,
                cell: (row) =>
                  by === "customer" || (by === "getpack_job" && row.key.name.startsWith(row.key.code))
                    ? row.key.name
                    : `${row.key.code}${row.key.name ? ` · ${row.key.name}` : ""}`,
              },
              {
                key: "r",
                header: t("revenue"),
                align: "end",
                cell: (row) => (
                  <BarValue value={Number(row.revenue)} max={maxRevenue}>
                    {format.thb(row.revenue)}
                  </BarValue>
                ),
              },
              {
                key: "c",
                header: t("cost"),
                align: "end",
                hideOnPhone: true,
                // A getpack job with nothing issued or recorded has no cost yet — not a 100 % margin.
                cell: (row) =>
                  by === "getpack_job" && Number(row.cost) === 0 ? (
                    <Badge tone="warning" title={t("noCostHint")}>
                      {t("noCost")}
                    </Badge>
                  ) : (
                    <BarValue value={Number(row.cost)} max={maxRevenue} tone="muted">
                      {format.thb(row.cost)}
                    </BarValue>
                  ),
              },
              { key: "g", header: t("grossProfit"), align: "end", cell: (row) => format.thb(row.grossProfit) },
              {
                key: "p",
                header: t("pct"),
                align: "end",
                cell: (row) => (by === "getpack_job" && Number(row.cost) === 0 ? "—" : pct(row.grossProfitPct)),
              },
            ]}
          />
          <p className="text-muted max-w-[72ch] text-sm text-pretty">
            {by === "getpack_job" ? t("noteGetpack") : t("note")}
          </p>
        </>
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
