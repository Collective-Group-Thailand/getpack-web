"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";

import { problemMessage } from "../../console";
import { useFactoryPart } from "../hooks";
import { Section } from "../parts";
import type { Factory } from "../resources";

/**
 * getpack support's read of a factory's own ERP (D-381): only while the owner's time-boxed grant is active, read
 * only — the dashboard and the ERP settings. Every read is audited and listed to the owner, so nothing loads until
 * staff ask for it.
 */
export function ErpSupport({ factory }: { factory: Factory }) {
  const t = useTranslations("partners.erpSupport");
  const format = useFormat();
  const [asked, setAsked] = useState(false);
  const view = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/erp/support-view", undefined, {
    enabled: asked,
  });
  const notGranted = isApiError(view.error) && view.error.status === 403;
  const d = view.data?.dashboard;
  const s = view.data?.settings;
  return (
    <Section
      title={t("title")}
      actions={
        <Button
          size="sm"
          variant="secondary"
          iconStart="eye"
          loading={view.isFetching}
          onClick={() => (asked ? void view.refetch() : setAsked(true))}
        >
          {asked ? t("again") : t("read")}
        </Button>
      }
    >
      <p className="text-muted mb-3 text-sm">{t("body")}</p>
      {notGranted ? <Callout tone="info" title={t("notGranted")} /> : null}
      {view.error && !notGranted ? <Callout tone="danger" title={problemMessage(view.error, t("failed"))} /> : null}
      {view.data && d && s ? (
        <div className="flex flex-col gap-4">
          <Callout
            tone="warning"
            title={t("granted", { until: format.dateTime(view.data.expiresAt), reason: view.data.reason })}
          />
          <DescriptionList
            columns={2}
            items={[
              { term: t("sales"), description: `${format.thb(d.sales.invoicedNet)} / ${format.thb(d.sales.target)}` },
              {
                term: t("receivables"),
                description: `${format.thb(d.receivables.open)} (${t("overdue", { amount: format.thb(d.receivables.overdue) })})`,
              },
              { term: t("payables"), description: format.thb(d.payables.dueThisWeek) },
              { term: t("stock"), description: `${format.thb(d.stock.value)} · ${t("low", { n: d.stock.lowItems })}` },
              {
                term: t("production"),
                description: t("productionValue", { wip: d.production.inProgress, late: d.production.late }),
              },
              {
                term: t("machines"),
                description: t("machinesValue", {
                  down: d.machines.down,
                  total: d.machines.total,
                  oee: d.machines.oeeYesterdayPct ?? "—",
                }),
              },
              {
                term: t("quality"),
                description: t("qualityValue", { open: d.quality.openNcrs, overdue: d.quality.overdueNcrs }),
              },
              { term: t("modules"), description: s.modules.join(", ") },
              {
                term: t("costing"),
                description: t("costingValue", { labour: s.labourRatePerHour, overhead: s.overheadPct }),
              },
              {
                term: t("rules"),
                description: t("rulesValue", {
                  negative: s.allowNegativeStock ? t("yes") : t("no"),
                  tolerance: s.priceTolerancePct,
                }),
              },
            ]}
          />
        </div>
      ) : null}
    </Section>
  );
}
