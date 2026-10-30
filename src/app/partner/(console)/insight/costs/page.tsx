import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Composition } from "@/features/partner/charts";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection, PartnerStats } from "@/features/partner/frame";
import { MachineRates } from "@/features/partner/insight/PeopleForms";
import { bangkokMonth, PeriodPicker, shiftMonth, stepLabel } from "@/features/partner/period";
import { ListToolbar } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.costs"))("title") };
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Job costs (D-376): the month in the toolbar, its totals as figures and as one bar of what they are made of, the
 * completed orders below, and the machine rates the machine cost is priced at.
 */
export default async function CostsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const query = await searchParams;
  const month = query.month && MONTH.test(query.month) ? query.month : bangkokMonth();
  const [t, tPeriod, tNav, format, context] = await Promise.all([
    getTranslations("partnerInsight.costs"),
    getTranslations("partnerSales.tax"),
    getTranslations("partner.sidebar.items"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [report, rates] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/insight/costs", {
            params: { path, query: { month } },
          })
        ).data!,
    ),
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/machine-rates", { params: { path } })).data!,
    ),
  ]);
  const totals = report.data?.totals;
  return (
    <PartnerPage full title={t("title")} description={t("body")}>
      <ListToolbar>
        <PeriodPicker
          action="/insight/costs"
          label={tPeriod("monthNav")}
          fields={[{ name: "month", label: t("month"), value: month, type: "month" }]}
          submit={t("show")}
          prev={{ href: `/insight/costs?month=${shiftMonth(month, -1)}`, label: stepLabel(tPeriod("prevMonth")) }}
          {...(month < bangkokMonth()
            ? { next: { href: `/insight/costs?month=${shiftMonth(month, 1)}`, label: stepLabel(tPeriod("nextMonth")) } }
            : {})}
        />
      </ListToolbar>
      {report.data && totals ? (
        <>
          <PartnerStats
            label={t("totals")}
            columns={6}
            items={[
              { key: "t", label: t("total"), value: format.thb(totals.total), highlight: true },
              { key: "m", label: t("material"), value: format.thb(totals.material) },
              { key: "mc", label: t("machine"), value: format.thb(totals.machine) },
              { key: "l", label: t("labour"), value: format.thb(totals.labour) },
              { key: "o", label: t("overhead"), value: format.thb(totals.overhead) },
              { key: "n", label: t("orders"), value: format.number(totals.orders) },
            ]}
          />
          <Composition
            label={t("totals")}
            parts={[
              { key: "m", label: t("material"), value: Number(totals.material), display: format.thb(totals.material) },
              { key: "mc", label: t("machine"), value: Number(totals.machine), display: format.thb(totals.machine) },
              { key: "l", label: t("labour"), value: Number(totals.labour), display: format.thb(totals.labour) },
              { key: "o", label: t("overhead"), value: Number(totals.overhead), display: format.thb(totals.overhead) },
            ]}
          />
          <PartnerTable
            caption={t("title")}
            rows={report.data.orders}
            rowKey={(row) => row.productionOrder.id}
            rowHref={(row) => `/insight/costs/${row.productionOrder.id}`}
            empty={
              <EmptyState
                icon="calculator"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  <Button asChild variant="secondary">
                    <Link href="/planning">{tNav("planning")}</Link>
                  </Button>
                }
              />
            }
            columns={[
              {
                key: "no",
                header: t("order"),
                primary: true,
                cell: (row) => <span className="whitespace-nowrap tabular-nums">{row.productionOrder.number}</span>,
              },
              { key: "ti", header: t("product"), cell: (row) => row.item?.name ?? row.title },
              { key: "g", header: t("good"), align: "end", cell: (row) => formatQty(row.goodQty, format.locale) },
              {
                key: "m",
                header: t("material"),
                align: "end",
                hideOnPhone: true,
                cell: (row) => format.thb(row.material),
              },
              {
                key: "mc",
                header: t("machine"),
                align: "end",
                hideOnPhone: true,
                cell: (row) => format.thb(row.machine),
              },
              { key: "l", header: t("labour"), align: "end", hideOnPhone: true, cell: (row) => format.thb(row.labour) },
              {
                key: "o",
                header: t("overhead"),
                align: "end",
                hideOnPhone: true,
                cell: (row) => format.thb(row.overhead),
              },
              {
                key: "t",
                header: t("total"),
                align: "end",
                cell: (row) => <span className="font-semibold">{format.thb(row.total)}</span>,
              },
              {
                key: "u",
                header: t("unitCost"),
                align: "end",
                cell: (row) => (row.unitCost ? format.thb(Number(row.unitCost).toFixed(2)) : "—"),
              },
            ]}
          />
        </>
      ) : (
        <PageError error={report.error} />
      )}
      <PartnerSection id="rates" title={t("rates")} description={t("ratesBody")}>
        {rates.data ? (
          rates.data.length ? (
            <MachineRates rates={rates.data} canEdit={canAt(context, "factory_erp.configure")} />
          ) : (
            <EmptyState
              icon="cog"
              title={t("noMachines")}
              action={
                <Button asChild variant="secondary">
                  <Link href="/machines">{tNav("machines")}</Link>
                </Button>
              }
            />
          )
        ) : (
          <PageError error={rates.error} />
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
