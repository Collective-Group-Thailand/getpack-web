import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_MACHINE_STATE, ERP_OPERATION_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { OperationButtons } from "@/features/partner/erp/MoActions";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { KioskRefresh } from "@/features/partner/ops/KioskRefresh";
import { KioskFullScreenButton, KioskScreen } from "@/features/partner/ops/KioskScreen";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";

type Item = Schemas["ErpOperationQueueItemDto"];

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.kiosk"))("title") };
}

/**
 * One machine's kiosk (D-353): what runs now with glove-sized start, pause, resume and finish, what
 * comes next in schedule order, and a breakdown report one tap away. Refreshes itself every 30 seconds.
 */
export default async function KioskPage({ params }: { params: Promise<{ machineId: string }> }) {
  const [{ machineId }, t, tShared, tPlan, tCommon, format, locale, context] = await Promise.all([
    params,
    getTranslations("partnerOps.kiosk"),
    getTranslations("partnerOps.shared"),
    getTranslations("partnerFactory.planning"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/machines/{machineId}/dispatch", {
          params: { path: { factoryId: context.factoryId, machineId } },
        })
      ).data!,
  );
  const back = { href: "/floor/kiosk", label: t("pick") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { machine, current, next } = read.data;
  const canRecord = canAt(context, "factory_production.record");
  const canReport = canAt(context, "factory_maintenance.report");
  const blocked = machine.state === "down" || machine.state === "maintenance";
  const unit = (code: string) => tCommon(`units.${code}` as never);

  const describe = ({ operation, order }: Item) =>
    [
      tCommon("inUnit", { qty: formatQty(order.quantity, locale), unit: unit(order.unit) }),
      operation.scheduledStart && operation.scheduledEnd
        ? t("planned", { from: format.dateTime(operation.scheduledStart), to: format.dateTime(operation.scheduledEnd) })
        : null,
      order.dueOn ? t("due", { date: format.date(order.dueOn) }) : null,
      tPlan("detail.minutes", { n: operation.plannedMinutes }),
    ]
      .filter(Boolean)
      .join(" · ");

  const card = (item: Item, big: boolean) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={big ? "text-2xl font-semibold" : "text-lg font-semibold"}>
            {tShared("numbered", { no: item.operation.seq, name: item.operation.name })}
          </p>
          <p className={big ? "text-lg" : undefined}>
            <Link
              href={`/planning/orders/${item.order.id}`}
              className="tabular-nums underline-offset-4 hover:underline"
            >
              {item.order.moNo}
            </Link>{" "}
            · {item.order.title}
          </p>
          <p className="text-muted text-sm">{describe(item)}</p>
          {item.operation.startedAt ? (
            <p className="text-muted text-sm">{t("elapsed", { at: format.dateTime(item.operation.startedAt) })}</p>
          ) : null}
        </div>
        <span className="flex flex-wrap items-center gap-1">
          {item.order.late ? <Badge tone="danger">{tPlan("late")}</Badge> : null}
          {item.order.short ? <Badge tone="warning">{tPlan("short")}</Badge> : null}
          {item.operation.milestone ? <Badge tone="info">{tShared("getpackStep")}</Badge> : null}
          <StatusChip map={ERP_OPERATION_STATUS} value={item.operation.status} />
        </span>
      </div>
      {canRecord ? (
        <OperationButtons
          orderId={item.order.id}
          operation={item.operation}
          unit={unit(item.order.unit)}
          defaultGood={item.order.quantity}
          size={big ? "xl" : "lg"}
          jobHref={`/planning/orders/${item.order.id}`}
        />
      ) : null}
    </div>
  );

  return (
    <KioskScreen>
      <PartnerPage
        title={machine.name}
        description={t("queued", { n: machine.queued })}
        back={back}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip map={ERP_MACHINE_STATE} value={machine.state} />
            <KioskRefresh />
            <KioskFullScreenButton />
            {canReport && !blocked ? (
              <Button asChild size="xl" variant="destructive-solid" iconStart="wrench">
                <Link href={`/maintenance/new?machine=${machine.id}`}>{t("reportBreakdown")}</Link>
              </Button>
            ) : null}
          </div>
        }
      >
        {blocked && machine.openMaintenance ? (
          <Callout tone="danger" icon="wrench">
            <Link href={`/maintenance/${machine.openMaintenance.id}`} className="underline-offset-4 hover:underline">
              {t("down", { title: machine.openMaintenance.title, no: machine.openMaintenance.mtNo })}
            </Link>
          </Callout>
        ) : null}

        <PartnerSection title={t("now")}>
          {current ? (
            <div className="border-primary bg-surface rounded-2xl border-2 p-4 md:p-6">{card(current, true)}</div>
          ) : (
            <p className="text-muted text-lg">{t("nothingNow")}</p>
          )}
        </PartnerSection>

        <PartnerSection title={t("nextTitle")}>
          {next.length ? (
            <ol className="flex flex-col gap-3">
              {next.map((item) => (
                <li key={item.operation.id} className="border-border bg-surface rounded-xl border p-4">
                  {card(item, false)}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon="check" title={t("noNext")} description={t("noNextBody")} />
          )}
        </PartnerSection>
      </PartnerPage>
    </KioskScreen>
  );
}
