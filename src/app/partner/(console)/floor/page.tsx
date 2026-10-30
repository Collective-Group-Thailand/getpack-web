import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_OPERATION_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { OperationButtons } from "@/features/partner/erp/MoActions";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerStats } from "@/features/partner/frame";
import { ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

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
        // The whole floor, filtered here by machine: the tabs' counts are then the rows each tab lists.
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/planning/queue", { params: { path } })).data!,
    ),
  ]);
  const canRecord = canAt(context, "factory_production.record");
  // One card per order: the step to work on now (running, paused, else the first still to do), the rest folded
  // under it in order — an operator should not be offered "ready to ship" before "print".
  type Entry = NonNullable<typeof queue.data>[number];
  const groups: { order: Entry["order"]; operations: Entry[] }[] = [];
  const onMachine = (entry: Entry) => !machine || entry.operation.machine?.id === machine;
  for (const entry of (queue.data ?? []).filter(onMachine)) {
    const group = groups.find((g) => g.order.id === entry.order.id);
    if (group) group.operations.push(entry);
    else groups.push({ order: entry.order, operations: [entry] });
  }
  for (const group of groups) {
    group.operations.sort((a, b) => a.operation.seq - b.operation.seq);
    const running = group.operations.findIndex(
      (e) => e.operation.status === "in_progress" || e.operation.status === "paused",
    );
    if (running > 0) group.operations.unshift(...group.operations.splice(running, 1));
  }
  const [tKiosk, tStatus] = await Promise.all([getTranslations("partnerOps.kiosk"), getTranslations("status")]);
  const unitOf = (unit: string) => (tCommon.has(`units.${unit}` as never) ? tCommon(`units.${unit}` as never) : unit);
  const entries = (queue.data ?? []).filter(onMachine);
  // Each machine's count is the operations this list shows for it — not the overview's own tally, which can differ.
  const perMachine = (id: string) => (queue.data ?? []).filter((entry) => entry.operation.machine?.id === id).length;
  const countOf = (status: string) => entries.filter((entry) => entry.operation.status === status).length;
  const late = groups.filter((group) => group.order.late).length;
  const short = groups.filter((group) => group.order.short).length;

  return (
    <PartnerPage
      wide
      title={t("title")}
      description={t("body")}
      actions={
        canRecord ? (
          <Button asChild variant="secondary" size="nav" iconStart="tablet">
            <Link href="/floor/kiosk">{tKiosk("title")}</Link>
          </Button>
        ) : undefined
      }
    >
      {queue.data && entries.length ? (
        // Counts of what is on the list below — nothing added up but the rows.
        <PartnerStats
          label={t("title")}
          items={[
            {
              key: "running",
              icon: "play",
              label: tStatus("erpOperation.inProgress"),
              value: format.number(countOf("in_progress")),
              highlight: countOf("in_progress") > 0,
            },
            {
              key: "pending",
              icon: "clock",
              label: tStatus("erpOperation.pending"),
              value: format.number(countOf("pending")),
            },
            {
              key: "late",
              icon: "warning",
              label: tPlan("late"),
              value: format.number(late),
              tone: late ? "danger" : "neutral",
            },
            {
              key: "short",
              icon: "package",
              label: tPlan("short"),
              value: format.number(short),
              tone: short ? "warning" : "neutral",
            },
          ]}
        />
      ) : null}
      {overview.data?.machines.length ? (
        <ViewTabs
          label={t("machines")}
          current={machine ?? "all"}
          items={[
            { key: "all", href: "/floor", label: t("allMachines"), count: queue.data?.length },
            ...overview.data.machines
              .filter((m) => perMachine(m.machine.id) > 0 || m.machine.id === machine)
              .map((m) => ({
                key: m.machine.id,
                href: `/floor${queryOf({ machine: m.machine.id })}`,
                label: m.machine.name,
                count: queue.data ? perMachine(m.machine.id) : undefined,
              })),
          ]}
        />
      ) : null}
      {queue.data ? (
        entries.length ? (
          <ol className="grid gap-3 xl:grid-cols-2">
            {groups.map(({ order, operations }) => {
              const [now, ...later] = operations;
              const card = now!;
              const running = card.operation.status === "in_progress";
              return (
                <li
                  key={order.id}
                  className={cn(
                    "bg-surface rounded-card flex min-w-0 flex-col gap-4 border border-s-4 p-4 md:p-5",
                    order.late
                      ? "border-border border-s-danger"
                      : running
                        ? "border-border border-s-primary"
                        : "border-border border-s-border-strong",
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/planning/orders/${order.id}`}
                        className="text-muted inline-flex min-h-11 items-center text-sm tabular-nums underline-offset-4 hover:underline md:min-h-8"
                      >
                        {order.moNo}
                      </Link>
                      <span className="flex flex-wrap gap-1">
                        {order.late ? <Badge tone="danger">{tPlan("late")}</Badge> : null}
                        {order.short ? <Badge tone="warning">{tPlan("short")}</Badge> : null}
                        <StatusChip map={ERP_OPERATION_STATUS} value={card.operation.status} size="md" />
                      </span>
                    </div>
                    {/* The step is what the operator looks for, so it is the largest line; the order says what it is for. */}
                    <p className="text-xl leading-snug font-semibold [overflow-wrap:anywhere] break-keep">
                      {card.operation.seq}. {card.operation.name}
                    </p>
                    <p className="[overflow-wrap:anywhere] break-keep">{order.title}</p>
                    <p className="text-muted text-sm">
                      {[
                        tCommon("inUnit", { qty: formatQty(order.quantity, locale), unit: unitOf(order.unit) }),
                        order.dueOn ? t("due", { date: format.date(order.dueOn) }) : null,
                        card.operation.machine?.name ?? null,
                        card.operation.plannedMinutes > 0
                          ? tPlan("detail.minutes", { n: card.operation.plannedMinutes })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {canRecord ? (
                    <OperationButtons
                      orderId={order.id}
                      operation={card.operation}
                      unit={unitOf(order.unit)}
                      defaultGood={order.quantity}
                      size="xl"
                    />
                  ) : null}
                  {later.length ? (
                    <details className="border-border group border-t pt-1">
                      <summary className="text-muted hover:text-fg flex min-h-12 cursor-pointer items-center gap-2 text-sm select-none">
                        <Icon
                          name="chevron-down"
                          size={16}
                          aria-hidden="true"
                          className="shrink-0 transition-transform group-open:rotate-180"
                        />
                        {t("nextSteps", {
                          list: later
                            .slice(0, 3)
                            .map((item) => `${item.operation.seq}. ${item.operation.name}`)
                            .join(" · "),
                          count: later.length,
                        })}
                      </summary>
                      <ol className="mt-2 flex flex-col gap-3">
                        {later.map((item) => (
                          <li
                            key={item.operation.id}
                            className="border-border bg-surface-subtle flex flex-col gap-2 rounded-lg border p-3"
                          >
                            <p className="font-medium">
                              {item.operation.seq}. {item.operation.name}
                              {item.operation.machine ? (
                                <span className="text-muted"> · {item.operation.machine.name}</span>
                              ) : null}
                            </p>
                            {canRecord ? (
                              <OperationButtons
                                orderId={order.id}
                                operation={item.operation}
                                unit={unitOf(order.unit)}
                                defaultGood={order.quantity}
                              />
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState
            icon="check"
            title={t("empty")}
            description={t("emptyBody")}
            action={
              machine ? (
                <Button asChild variant="secondary" size="nav">
                  <Link href="/floor">{t("allMachines")}</Link>
                </Button>
              ) : (
                <Button asChild variant="secondary" size="nav" iconEnd="arrow-right">
                  <Link href="/planning">{tPlan("title")}</Link>
                </Button>
              )
            }
          />
        )
      ) : (
        <PageError error={queue.error} />
      )}
    </PartnerPage>
  );
}
