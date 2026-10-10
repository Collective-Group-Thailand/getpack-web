import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_OPERATION_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { OperationButtons } from "@/features/partner/erp/MoActions";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.floor"))("title") };
}

/**
 * The floor (D-341): the operations to do on released orders, most urgent first, per machine — big buttons
 * to start, finish with good and scrap pieces, or skip. Built for a phone or a tablet by the machine.
 */
export default async function FloorPage({ searchParams }: { searchParams: Promise<{ machine?: string }> }) {
  const [{ machine }, t, tPlan, tCommon, format, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerFactory.floor"),
    getTranslations("partnerFactory.planning"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [overview, queue] = await Promise.all([
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/planning/overview", { params: { path } })).data!,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/planning/queue", {
            params: { path, query: machine ? { machineId: machine } : {} },
          })
        ).data!,
    ),
  ]);
  const canRecord = canAt(context, "factory_production.record");
  const tKiosk = await getTranslations("partnerOps.kiosk");

  return (
    <PartnerPage
      title={t("title")}
      description={t("body")}
      actions={
        canRecord ? (
          <Button asChild variant="secondary" iconStart="tablet">
            <Link href="/floor/kiosk">{tKiosk("title")}</Link>
          </Button>
        ) : undefined
      }
    >
      {overview.data?.machines.length ? (
        <ViewTabs
          label={t("machines")}
          current={machine ?? "all"}
          items={[
            { key: "all", href: "/floor", label: t("allMachines") },
            ...overview.data.machines
              .filter((m) => m.operations > 0 || m.machine.id === machine)
              .map((m) => ({
                key: m.machine.id,
                href: `/floor${queryOf({ machine: m.machine.id })}`,
                label: m.machine.name,
                count: m.operations,
              })),
          ]}
        />
      ) : null}
      {queue.data ? (
        queue.data.length ? (
          <ol className="flex flex-col gap-3">
            {queue.data.map(({ operation, order }) => (
              <li key={operation.id} className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">
                      {operation.seq}. {operation.name}
                    </p>
                    <p>
                      <Link
                        href={`/planning/orders/${order.id}`}
                        className="font-mono underline-offset-4 hover:underline"
                      >
                        {order.moNo}
                      </Link>{" "}
                      · {order.title}
                    </p>
                    <p className="text-muted text-sm">
                      {[
                        tCommon("inUnit", {
                          qty: formatQty(order.quantity, locale),
                          unit: tCommon(`units.${order.unit}` as never),
                        }),
                        order.dueOn ? t("due", { date: format.date(order.dueOn) }) : null,
                        operation.machine?.name ?? null,
                        tPlan("detail.minutes", { n: operation.plannedMinutes }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1">
                    {order.late ? <Badge tone="danger">{tPlan("late")}</Badge> : null}
                    {order.short ? <Badge tone="warning">{tPlan("short")}</Badge> : null}
                    <StatusChip map={ERP_OPERATION_STATUS} value={operation.status} />
                  </span>
                </div>
                {canRecord ? (
                  <OperationButtons
                    orderId={order.id}
                    operation={operation}
                    unit={tCommon(`units.${order.unit}` as never)}
                    defaultGood={order.quantity}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon="check" title={t("empty")} description={t("emptyBody")} />
        )
      ) : (
        <PageError error={queue.error} />
      )}
    </PartnerPage>
  );
}
