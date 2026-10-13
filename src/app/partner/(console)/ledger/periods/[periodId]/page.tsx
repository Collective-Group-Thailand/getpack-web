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
  const [t, tc, format, context] = await Promise.all([getTranslations("partnerLedger.period"), getTranslations("partnerLedger.common"), getFormat(), factoryContext()]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [periods, checklist] = await Promise.all([
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/periods", { params: { path } })).data!),
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/periods/{periodId}/checklist", { params: { path: { ...path, periodId } } })).data!),
  ]);
  const period = periods.data?.find((p) => p.id === periodId);
  if (!period || !checklist.data)
    return (
      <PartnerPage title={t("checks")} back={{ href: "/ledger", label: t("back") }}>
        <PageError error={checklist.error ?? periods.error} />
      </PartnerPage>
    );
  const c = checklist.data;
  return (
    <PartnerPage
      title={t("title", { month: period.month })}
      description={t("body")}
      back={{ href: "/ledger", label: t("back") }}
      meta={<StatusChip map={PERIOD_STATUS} value={period.status} size="md" />}
    >
      <PeriodActions period={period} />
      <p className={c.canClose ? "text-success font-medium" : "text-warning font-medium"}>{c.canClose ? t("canClose") : t("cannotClose")}</p>
      <PartnerSection title={t("checks")}>
        <PartnerTable
          caption={t("checks")}
          rows={c.checks}
          rowKey={(row) => row.key}
          rowTone={(row) => (row.ok ? undefined : row.blocking ? "danger" : "warning")}
          columns={[
            { key: "n", header: t("checks"), primary: true, cell: (row) => <span>{t(`names.${row.key}` as never)}</span> },
            { key: "e", header: t("expected"), align: "end", hideOnPhone: true, cell: (row) => (row.expected === null ? "—" : format.thb(row.expected)) },
            { key: "a", header: t("actual"), align: "end", hideOnPhone: true, cell: (row) => (row.actual === null ? "—" : format.thb(row.actual)) },
            { key: "d", header: t("difference"), align: "end", cell: (row) => (row.difference === null ? "—" : format.thb(row.difference)) },
            { key: "s", header: tc("status"), cell: (row) => <Badge tone={row.ok ? "success" : row.blocking ? "danger" : "warning"}>{row.ok ? (row.blocking ? t("ok") : t("info")) : t("fail")}</Badge> },
            { key: "x", header: tc("description"), hideOnPhone: true, cell: (row) => <span className="text-muted text-sm">{row.detail}</span> },
          ]}
        />
        {c.openProductionOrders ? <p className="text-muted text-sm">{t("openOrders", { n: c.openProductionOrders })}</p> : null}
      </PartnerSection>
      <Button asChild variant="secondary" iconStart="list-ordered" className="self-start">
        <Link href={`/ledger/journals?month=${period.month}`}>{t("journals", { month: period.month })}</Link>
      </Button>
    </PartnerPage>
  );
}
