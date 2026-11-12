import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AGENT_FORECAST_STATUS } from "@/domain/status";
import type { CommissionForecast } from "@/features/agent/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { PortalTable } from "@/ui/components/PortalTable";
import { Icon } from "@/ui/icons";

/**
 * The commission forecast (F47, D-468 §7): per order, what the agent can expect and when it should reach their account,
 * from the system's own rules — earned once the claim window has passed and the order is paid in full, summarised on
 * the 1st of the next month, paid within the payment terms of approval (never "the 5th", P-02). An order still in
 * progress has no date yet; each line says in words what it is waiting for. All figures and dates are the API's.
 */
export async function Forecast({ forecast }: { forecast: CommissionForecast }) {
  const [t, format] = await Promise.all([getTranslations("agentSales.forecast"), getFormat()]);
  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="forecast-total"
        className="border-primary/25 bg-primary-subtle rounded-card flex flex-col gap-2 border p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5"
      >
        <div>
          <h2 id="forecast-total" className="text-primary-subtle-fg text-sm font-medium">
            {t("total")}
          </h2>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{format.thb(forecast.totalExpected)}</p>
          <p className="text-muted mt-1 text-sm">{t("asOf", { date: format.dateTime(forecast.asOf) })}</p>
        </div>
        <p className="text-sm sm:max-w-sm sm:text-end">{t("rule", { days: forecast.paymentTermsDays })}</p>
      </section>

      {forecast.payoutProfileReady ? null : (
        <Callout tone="warning" title={t("profileTitle")}>
          <span className="flex flex-col items-start gap-2">
            {t("profileBody")}
            <Button asChild size="sm" variant="secondary" className="min-h-11 sm:min-h-8">
              <Link href="/payout">{t("profileAction")}</Link>
            </Button>
          </span>
        </Callout>
      )}

      {forecast.items.length === 0 ? (
        <EmptyState
          icon="coins"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Button asChild variant="secondary">
              <Link href="/leads">{t("emptyAction")}</Link>
            </Button>
          }
        />
      ) : (
        <PortalTable
          caption={t("caption")}
          columns={[
            { key: "order", label: t("columns.order"), className: "md:w-[22%]" },
            { key: "status", label: t("columns.status"), className: "md:whitespace-nowrap" },
            { key: "amount", label: t("columns.amount"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "when", label: t("columns.when") },
          ]}
          rows={forecast.items.map((item, index) => ({
            id: `${item.orderCode ?? "order"}-${index}`,
            phoneSubtitle: item.isFirstOrder ? t("firstOrder") : t("repeatOrder"),
            cells: {
              order: (
                <span className="block min-w-0">
                  <span className="block font-semibold tabular-nums">{item.orderCode ?? t("noCode")}</span>
                  <span className="text-muted hidden text-xs md:block">{item.isFirstOrder ? t("firstOrder") : t("repeatOrder")}</span>
                </span>
              ),
              status: <StatusChip map={AGENT_FORECAST_STATUS} value={item.status} />,
              amount: (
                <span className="block">
                  <span className="block font-semibold tabular-nums">{format.thb(item.expectedCommission)}</span>
                  <span className="text-muted block text-xs tabular-nums">
                    {t("basis", { base: format.thb(item.expectedBase), rate: format.percent(item.ratePct) })}
                  </span>
                </span>
              ),
              when: (
                <span className="flex flex-col gap-0.5 text-sm">
                  {item.status === "paid" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="wallet" size={14} aria-hidden="true" className="text-success" />
                      {t("paidOn", { date: format.date(item.expectedPayableOn) })}
                    </span>
                  ) : item.expectedPayableOn ? (
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Icon name="calendar" size={14} aria-hidden="true" />
                      {t("payableOn", { date: format.date(item.expectedPayableOn) })}
                    </span>
                  ) : (
                    <span className="text-muted">{t("noDate")}</span>
                  )}
                  {item.waitingFor ? <span className="text-muted text-xs">{t(`waiting.${item.waitingFor}`, { date: format.date(item.earnableOn), statement: format.date(item.statementOn) })}</span> : null}
                </span>
              ),
            },
          }))}
        />
      )}
    </div>
  );
}
