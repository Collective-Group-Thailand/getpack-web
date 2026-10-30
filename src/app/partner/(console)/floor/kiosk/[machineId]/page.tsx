import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_MACHINE_STATE, ERP_OPERATION_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { OperationButtons } from "@/features/partner/erp/MoActions";
import { PageError, PartnerPage } from "@/features/partner/frame";
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
  const [{ machineId }, t, tShared, tPlan, tCommon, format, locale, context, tFloor] = await Promise.all([
    params,
    getTranslations("partnerOps.kiosk"),
    getTranslations("partnerOps.shared"),
    getTranslations("partnerFactory.planning"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
    getTranslations("partnerFactory.floor"),
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

  const running = current?.operation.status === "in_progress";

  return (
    <KioskScreen>
      <PartnerPage
        wide
        title={machine.name}
        status={<StatusChip map={ERP_MACHINE_STATE} value={machine.state} size="md" />}
        description={t("queued", { n: machine.queued })}
        back={back}
        actions={
          <>
            <KioskRefresh />
            <KioskFullScreenButton />
            {canReport && !blocked ? (
              // Red outline: a breakdown report is one tap away, but never louder than the job's own buttons.
              <Button asChild size="xl" variant="destructive" iconStart="wrench">
                <Link href={`/maintenance/new?machine=${machine.id}`}>{t("reportBreakdown")}</Link>
              </Button>
            ) : null}
          </>
        }
      >
        {blocked && machine.openMaintenance ? (
          <Callout tone="danger" icon="wrench">
            <Link href={`/maintenance/${machine.openMaintenance.id}`} className="underline-offset-4 hover:underline">
              {t("down", { title: machine.openMaintenance.title, no: machine.openMaintenance.mtNo })}
            </Link>
          </Callout>
        ) : null}

        {/* What runs now fills the screen beside the machine; what comes next sits in a column of its own. */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section aria-labelledby="kiosk-now" className="flex min-w-0 flex-col gap-3">
            <h2 id="kiosk-now" className="text-lg font-semibold">
              {t("now")}
            </h2>
            {current ? (
              <div
                className={
                  running
                    ? "border-primary bg-surface rounded-panel border-2 p-5 md:p-7"
                    : "border-border-strong bg-surface rounded-panel border-2 p-5 md:p-7"
                }
              >
                {card(current, true)}
              </div>
            ) : (
              <EmptyState
                icon="play"
                title={t("nothingNow")}
                description={next.length ? t("queued", { n: machine.queued }) : t("noNextBody")}
                action={
                  <Button asChild variant="secondary" size="xl" iconStart="factory">
                    <Link href="/floor">{tFloor("title")}</Link>
                  </Button>
                }
              />
            )}
          </section>

          <section aria-labelledby="kiosk-next" className="flex min-w-0 flex-col gap-3">
            <h2 id="kiosk-next" className="flex items-center gap-2 text-lg font-semibold">
              {t("nextTitle")}
              {next.length ? (
                <span className="bg-surface-subtle text-muted rounded-md px-2 text-sm tabular-nums">
                  {format.number(next.length)}
                </span>
              ) : null}
            </h2>
            {next.length ? (
              <ol className="flex flex-col gap-3">
                {next.map((item) => (
                  <li key={item.operation.id} className="border-border bg-surface rounded-card border p-4">
                    {card(item, false)}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                icon="check"
                title={t("noNext")}
                description={t("noNextBody")}
                action={
                  <Button asChild variant="secondary" size="xl">
                    <Link href="/floor/kiosk">{t("pick")}</Link>
                  </Button>
                }
              />
            )}
          </section>
        </div>
      </PartnerPage>
    </KioskScreen>
  );
}
