import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { FigureGrid, Headline, PanelLink } from "@/features/partner/insight/figures";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { Meter } from "@/ui/components/Meter";
import { Panel } from "@/ui/components/Panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.dashboard"))("title") };
}

/**
 * The owner's dashboard (D-378): this month's sales against target, money owed both ways, stock, production,
 * machines and yesterday's OEE, quality and follow-ups — each figure opening the list behind it.
 */
export default async function DashboardPage() {
  const [t, tNav, format, context] = await Promise.all([
    getTranslations("partnerInsight.dashboard"),
    getTranslations("partner.sidebar.items"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/dashboard", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data!,
  );
  if (!read.data)
    return (
      <PartnerPage title={t("title")}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const d = read.data;
  const pct = (v: string | null) => (v === null ? "—" : format.percent(v, 1));
  const achieved = d.sales.achievementPct === null ? null : Number(d.sales.achievementPct);
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("asOf", { date: format.date(d.asOf) })}
      actions={
        canAt(context, "factory_erp.configure") ? (
          <Button asChild variant="secondary" iconStart="settings">
            <Link href="/settings/erp">{t("settings")}</Link>
          </Button>
        ) : null
      }
    >
      {/* The money first, wide; the work for getpack beside it — the two things an owner opens this page for. */}
      <div className="grid gap-5 xl:grid-cols-12 xl:gap-6">
        <Panel
          id="dash-money"
          title={t("money")}
          className="xl:col-span-8"
          actions={<PanelLink href="/insight/profit?by=customer">{tNav("insightProfit")}</PanelLink>}
        >
          <div className="flex flex-col gap-5">
            <Headline label={t("salesOwn")} value={format.thb(d.sales.invoicedNet)}>
              {achieved !== null ? (
                <div className="mt-2 flex max-w-xl flex-col gap-1.5">
                  <Meter
                    value={achieved}
                    label={t("salesOwn")}
                    valueText={t("ofTarget", { pct: pct(d.sales.achievementPct), target: format.thb(d.sales.target) })}
                  />
                  <p className="text-muted text-sm tabular-nums">
                    {t("ofTarget", { pct: pct(d.sales.achievementPct), target: format.thb(d.sales.target) })}
                  </p>
                </div>
              ) : (
                <p className="text-muted text-sm">{t("noTarget")}</p>
              )}
            </Headline>
            <FigureGrid
              label={t("money")}
              items={[
                {
                  key: "ar",
                  label: t("receivables"),
                  value: format.thb(d.receivables.open),
                  hint:
                    Number(d.receivables.overdue) > 0
                      ? t("overdue", { amount: format.thb(d.receivables.overdue), n: d.receivables.overdueInvoices })
                      : t("noneOverdue"),
                  tone: Number(d.receivables.overdue) > 0 ? "danger" : "neutral",
                  href: "/receivables",
                },
                {
                  key: "ap",
                  label: t("payables"),
                  value: format.thb(d.payables.dueThisWeek),
                  hint:
                    Number(d.payables.overdueAmount) > 0
                      ? t("apOverdue", { amount: format.thb(d.payables.overdueAmount) })
                      : t("apWeek", { n: d.payables.dueThisWeekCount }),
                  tone: Number(d.payables.overdueAmount) > 0 ? "warning" : "neutral",
                  href: "/payables",
                },
                {
                  key: "stock",
                  label: t("stockValue"),
                  value: format.thb(d.stock.value),
                  hint: t("lowItems", { n: d.stock.lowItems }),
                  tone: d.stock.lowItems ? "warning" : "neutral",
                  href: "/stock",
                },
              ]}
            />
          </div>
        </Panel>
        <Panel
          id="dash-getpack"
          title={t("getpack")}
          className="xl:col-span-4"
          actions={<PanelLink href="/billing">{tNav("billing")}</PanelLink>}
        >
          <div className="flex flex-col gap-5">
            <Headline label={t("getpackRevenue")} value={format.thb(d.getpack.confirmedNet)}>
              <p className="text-muted text-sm">{t("getpackRevenueHint", { n: d.getpack.confirmedStatements })}</p>
            </Headline>
            <FigureGrid
              label={t("getpack")}
              columns={2}
              items={[
                {
                  key: "confirm",
                  label: t("getpackToConfirm"),
                  value: format.number(d.getpack.toConfirm),
                  hint: t("getpackToConfirmHint", { amount: format.thb(d.getpack.toConfirmGross) }),
                  tone: d.getpack.toConfirm ? "warning" : "neutral",
                  href: "/billing",
                },
                {
                  key: "invoice",
                  label: t("getpackToInvoice"),
                  value: format.number(d.getpack.toInvoice),
                  tone: d.getpack.toInvoice ? "warning" : "neutral",
                  href: "/billing",
                },
              ]}
            />
          </div>
        </Panel>
      </div>
      <PartnerSection id="dash-ops" title={t("operations")}>
        <FigureGrid
          label={t("operations")}
          columns={5}
          items={[
            {
              key: "wip",
              label: t("inProgress"),
              value: format.number(d.production.inProgress),
              hint: t("completed", { n: d.production.completedThisMonth }),
              href: "/planning",
            },
            {
              key: "late",
              label: t("late"),
              value: format.number(d.production.late),
              tone: d.production.late ? "danger" : "neutral",
              hint: d.production.late ? t("lateHint") : t("onTime"),
              href: "/planning",
            },
            {
              key: "machines",
              label: t("machines"),
              value: t("machinesValue", { down: d.machines.down, total: d.machines.total }),
              hint: t("oeeYesterday", { pct: pct(d.machines.oeeYesterdayPct) }),
              tone: d.machines.down ? "danger" : "neutral",
              href: "/insight/oee",
            },
            {
              key: "quality",
              label: t("quality"),
              value: t("openNcrs", { n: d.quality.openNcrs }),
              hint: t("passRate", { pct: pct(d.quality.passRatePct), n: d.quality.checksThisMonth }),
              tone: d.quality.overdueNcrs ? "danger" : d.quality.openNcrs ? "warning" : "neutral",
              href: "/quality/ncrs",
            },
            {
              key: "follow",
              label: t("followUps"),
              value: format.number(d.followUps.dueToday),
              hint: t("followUpsHint", { overdue: d.followUps.overdue, alerts: d.followUps.alerts }),
              tone: d.followUps.overdue ? "warning" : "neutral",
              href: "/alerts",
            },
          ]}
        />
      </PartnerSection>
      {d.production.lateOrders.length || d.stock.low.length ? (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          {d.production.lateOrders.length ? (
            <PartnerSection id="dash-late" title={t("lateOrders")}>
              <PartnerTable
                caption={t("lateOrders")}
                rows={d.production.lateOrders}
                rowKey={(row) => row.order.id}
                rowHref={(row) => `/planning/orders/${row.order.id}`}
                rowTone={() => "danger"}
                columns={[
                  {
                    key: "no",
                    header: t("order"),
                    primary: true,
                    cell: (row) => <span className="whitespace-nowrap tabular-nums">{row.order.number}</span>,
                  },
                  { key: "title", header: t("orderTitle"), cell: (row) => row.title },
                  {
                    key: "due",
                    header: t("due"),
                    className: "whitespace-nowrap",
                    cell: (row) => format.date(row.dueOn),
                  },
                ]}
              />
            </PartnerSection>
          ) : null}
          {d.stock.low.length ? (
            <PartnerSection id="dash-low" title={t("lowStock")}>
              <PartnerTable
                caption={t("lowStock")}
                rows={d.stock.low}
                rowKey={(row) => row.item.id}
                rowHref={(row) => `/stock/items/${row.item.id}`}
                columns={[
                  { key: "i", header: t("item"), primary: true, cell: (row) => row.item.name },
                  {
                    key: "a",
                    header: t("available"),
                    align: "end",
                    cell: (row) => formatQty(row.available, format.locale),
                  },
                  {
                    key: "r",
                    header: t("reorderPoint"),
                    align: "end",
                    cell: (row) => formatQty(row.reorderPoint, format.locale),
                  },
                ]}
              />
            </PartnerSection>
          ) : null}
        </div>
      ) : null}
    </PartnerPage>
  );
}
