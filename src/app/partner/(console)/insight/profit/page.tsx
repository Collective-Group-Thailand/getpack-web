import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { StatStrip, ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.profit"))("title") };
}

const BY = ["customer", "item", "sales_order"] as const;
type By = (typeof BY)[number];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const thisMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/** Gross profit (D-376): what the month's invoices earned over the cost of what they delivered. */
export default async function ProfitPage({ searchParams }: { searchParams: Promise<{ month?: string; by?: string }> }) {
  const query = await searchParams;
  const month = query.month && MONTH.test(query.month) ? query.month : thisMonth();
  const by: By = BY.includes(query.by as By) ? (query.by as By) : "customer";
  const [t, format, context] = await Promise.all([getTranslations("partnerInsight.profit"), getFormat(), factoryContext()]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/insight/profitability", { params: { path: { factoryId: context.factoryId }, query: { month, by } } })).data!,
  );
  const pct = (v: string | null) => (v === null ? "—" : format.percent(v, 1));
  return (
    <PartnerPage full title={t("title")} description={t("body")}>
      <ViewTabs label={t("by")} current={by} items={BY.map((key) => ({ key, href: `/insight/profit${queryOf({ month, by: key === "customer" ? undefined : key })}`, label: t(`views.${key}`) }))} />
      <form className="flex flex-wrap items-end gap-2" action="/insight/profit">
        {by !== "customer" ? <input type="hidden" name="by" value={by} /> : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("month")}</span>
          <Input type="month" name="month" defaultValue={month} className="w-48" />
        </label>
        <Button type="submit" variant="secondary">
          {t("show")}
        </Button>
      </form>
      {read.data ? (
        <>
          <StatStrip
            label={t("totals")}
            items={[
              { key: "r", label: t("revenue"), value: format.thb(read.data.revenue) },
              { key: "c", label: t("cost"), value: format.thb(read.data.cost) },
              { key: "g", label: t("grossProfit"), value: format.thb(read.data.grossProfit), hint: pct(read.data.grossProfitPct), tone: Number(read.data.grossProfit) < 0 ? "danger" : "success" },
            ]}
          />
          <PartnerTable
            caption={t("title")}
            rows={read.data.rows}
            rowKey={(row) => row.key.id}
            rowTone={(row) => (Number(row.grossProfit) < 0 ? "danger" : undefined)}
            empty={<EmptyState icon="trend-up" title={t("empty")} description={t("emptyBody")} />}
            columns={[
              {
                key: "k",
                header: t(`views.${by}`),
                primary: true,
                cell: (row) => (by === "customer" ? row.key.name : `${row.key.code}${row.key.name ? ` · ${row.key.name}` : ""}`),
              },
              { key: "r", header: t("revenue"), align: "end", cell: (row) => format.thb(row.revenue) },
              { key: "c", header: t("cost"), align: "end", hideOnPhone: true, cell: (row) => format.thb(row.cost) },
              { key: "g", header: t("grossProfit"), align: "end", cell: (row) => format.thb(row.grossProfit) },
              { key: "p", header: t("pct"), align: "end", cell: (row) => pct(row.grossProfitPct) },
            ]}
          />
          <p className="text-muted text-sm">{t("note")}</p>
        </>
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
