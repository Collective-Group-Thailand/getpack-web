import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PERIOD_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PeriodActions } from "@/features/partner/ledger/LedgerActions";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.overview"))("checklist") };
}

/** One period (D-390): the close checklist, its status and the transitions offered. */
export default async function PeriodPage({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await params;
  const [t, tc, format, context] = await Promise.all([
    getTranslations("partnerLedger.period"),
    getTranslations("partnerLedger.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [periods, checklist] = await Promise.all([
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/periods", { params: { path } })).data!,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/periods/{periodId}/checklist", {
            params: { path: { ...path, periodId } },
          })
        ).data!,
    ),
  ]);
  const period = periods.data?.find((p) => p.id === periodId);
  if (!period || !checklist.data)
    return (
      <PartnerPage title={t("checks")} back={{ href: "/ledger", label: t("back") }}>
        <PageError error={checklist.error ?? periods.error} />
      </PartnerPage>
    );
  const c = checklist.data;
  const monthLabel = format.date(`${period.month}-01`, { style: "month" });
  const [y, m] = period.month.split("-").map(Number) as [number, number];
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  // Where each check is put right (D-390).
  const FIX: Record<string, string> = {
    stock_valuation: `/ledger/reports?tab=stock&from=${period.month}-01&to=${monthEnd}`,
    payables: "/payables?view=aging",
    receivables: "/receivables",
    vat: `/tax?month=${period.month}`,
    wht: `/tax?view=wht&month=${period.month}`,
    bank: "/ledger/bank",
    depreciation: "/ledger/assets",
    open_wip: "/planning/orders",
  };
  return (
    <PartnerPage
      full
      title={t("title", { month: monthLabel })}
      description={t("body")}
      back={{ href: "/ledger", label: t("back") }}
      meta={<StatusChip map={PERIOD_STATUS} value={period.status} size="md" />}
    >
      <PeriodActions period={period} />
      <p className={c.canClose ? "text-success font-medium" : "text-warning font-medium"}>
        {c.canClose ? t("canClose") : t("cannotClose")}
      </p>
      <PartnerSection title={t("checks")}>
        <PartnerTable
          caption={t("checks")}
          rows={c.checks}
          rowKey={(row) => row.key}
          rowTone={(row) => (row.ok ? undefined : row.blocking ? "danger" : "warning")}
          columns={[
            {
              key: "n",
              header: t("checks"),
              primary: true,
              cell: (row) => <span>{t(`names.${row.key}` as never)}</span>,
            },
            {
              key: "e",
              header: t("expected"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => (row.expected === null ? "—" : format.thb(row.expected)),
            },
            {
              key: "a",
              header: t("actual"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => (row.actual === null ? "—" : format.thb(row.actual)),
            },
            {
              key: "d",
              header: t("difference"),
              align: "end",
              cell: (row) => (row.difference === null ? "—" : format.thb(row.difference)),
            },
            {
              key: "s",
              header: tc("status"),
              cell: (row) => (
                <Badge tone={row.ok ? "success" : row.blocking ? "danger" : "warning"}>
                  {row.ok ? (row.blocking ? t("ok") : t("info")) : t("fail")}
                </Badge>
              ),
            },
            {
              key: "x",
              header: tc("description"),
              hideOnPhone: true,
              cell: (row) => (
                <span className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">{row.detail}</span>
                  {!row.ok && t.has(`fix.${row.key}` as never) ? <span>{t(`fix.${row.key}` as never)}</span> : null}
                </span>
              ),
            },
            {
              key: "f",
              header: t("fixColumn"),
              cell: (row) =>
                FIX[row.key] && (!row.ok || !row.blocking) ? (
                  <Link className="text-link text-sm whitespace-nowrap underline" href={FIX[row.key]!}>
                    {t("open")}
                  </Link>
                ) : null,
            },
          ]}
        />
        {c.openProductionOrders ? (
          <p className="text-muted text-sm">{t("openOrders", { n: c.openProductionOrders })}</p>
        ) : null}
      </PartnerSection>
      <Button asChild variant="secondary" iconStart="list-ordered" className="self-start">
        <Link href={`/ledger/journals?month=${period.month}`}>{t("journals", { month: monthLabel })}</Link>
      </Button>
    </PartnerPage>
  );
}
