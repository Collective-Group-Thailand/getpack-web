import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { MachineRates } from "@/features/partner/insight/PeopleForms";
import { StatStrip } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.costs"))("title") };
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const thisMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/** Job costs (D-376): the month's completed orders — materials, machine, labour, overhead — and the machine rates. */
export default async function CostsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const query = await searchParams;
  const month = query.month && MONTH.test(query.month) ? query.month : thisMonth();
  const [t, format, context] = await Promise.all([
    getTranslations("partnerInsight.costs"),
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
  return (
    <PartnerPage full title={t("title")} description={t("body")}>
      <form className="flex flex-wrap items-end gap-2" action="/insight/costs">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("month")}</span>
          <Input type="month" name="month" defaultValue={month} className="w-48" />
        </label>
        <Button type="submit" variant="secondary">
          {t("show")}
        </Button>
      </form>
      {report.data ? (
        <>
          <StatStrip
            label={t("totals")}
            items={[
              { key: "n", label: t("orders"), value: format.number(report.data.totals.orders) },
              { key: "m", label: t("material"), value: format.thb(report.data.totals.material) },
              { key: "mc", label: t("machine"), value: format.thb(report.data.totals.machine) },
              { key: "l", label: t("labour"), value: format.thb(report.data.totals.labour) },
              { key: "o", label: t("overhead"), value: format.thb(report.data.totals.overhead) },
              { key: "t", label: t("total"), value: format.thb(report.data.totals.total), tone: "success" },
            ]}
          />
          <PartnerTable
            caption={t("title")}
            rows={report.data.orders}
            rowKey={(row) => row.productionOrder.id}
            rowHref={(row) => `/insight/costs/${row.productionOrder.id}`}
            empty={<EmptyState icon="calculator" title={t("empty")} description={t("emptyBody")} />}
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
              { key: "t", header: t("total"), align: "end", cell: (row) => format.thb(row.total) },
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
      <PartnerSection title={t("rates")} description={t("ratesBody")}>
        {rates.data ? (
          rates.data.length ? (
            <MachineRates rates={rates.data} canEdit={canAt(context, "factory_erp.configure")} />
          ) : (
            <EmptyState icon="cog" title={t("noMachines")} />
          )
        ) : (
          <PageError error={rates.error} />
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
