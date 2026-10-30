import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_MACHINE_STATE } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerStats } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { MachineButton } from "@/features/partner/ops/MachineForm";
import { planLine } from "@/features/partner/ops/machine-text";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

const VIEWS = ["active", "inactive"] as const;
type View = (typeof VIEWS)[number];
const STATES = ["running", "idle", "down", "maintenance"] as const;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.machines"))("title") };
}

/** The factory's machines (D-355): state now, queue, output in 30 days and maintenance cycles. */
export default async function MachinesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "active";
  const [t, tShared, tStatus, tMt, tPlans, format, context] = await Promise.all([
    getTranslations("partnerOps.machines"),
    getTranslations("partnerOps.shared"),
    getTranslations("status"),
    getTranslations("partnerOps.maintenance"),
    getTranslations("partnerOps.maintenance.plans"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/machines", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data!,
  );
  const canConfigure = canAt(context, "factory_erp.configure");
  const n = (value: number) => format.number(value);

  const all = read.data ?? [];
  const active = all.filter((m) => m.status === "active");
  const byView = { active, inactive: all.filter((m) => m.status !== "active") };
  const rows = byView[view];
  const plansDue = active.reduce((sum, m) => sum + m.plans.filter((p) => p.due).length, 0);
  const href = (next: View) => `/machines${queryOf({ view: next === "active" ? undefined : next })}`;

  return (
    <PartnerPage full title={t("title")} description={t("body")} actions={canConfigure ? <MachineButton /> : undefined}>
      {read.data ? (
        all.length ? (
          <>
            {/* How the floor stands right now: machines by state, and the maintenance cycles that have come round. */}
            <PartnerStats
              label={t("title")}
              items={[
                ...STATES.map((state) => {
                  const count = active.filter((m) => m.state === state).length;
                  return {
                    key: state,
                    label: tStatus(`erpMachine.${state}`),
                    value: count,
                    ...(count && state === "down" ? { tone: "danger" as const } : {}),
                    ...(count && state === "maintenance" ? { tone: "warning" as const } : {}),
                  };
                }),
                {
                  key: "due",
                  label: tPlans("due"),
                  value: plansDue,
                  href: "/maintenance?view=plans",
                  ...(plansDue ? { tone: "warning" as const } : {}),
                },
              ]}
            />
            <ListToolbar>
              <ViewTabs
                label={t("title")}
                current={view}
                items={VIEWS.map((key) => ({
                  key,
                  href: href(key),
                  label: t(key),
                  count: byView[key].length,
                }))}
              />
            </ListToolbar>
            <PartnerTable
              caption={t("title")}
              rows={rows}
              rowKey={(m) => m.id}
              rowHref={(m) => `/machines/${m.id}`}
              rowTone={(m) =>
                m.status !== "active"
                  ? undefined
                  : m.state === "down"
                    ? "danger"
                    : m.openMaintenance || m.plans.some((p) => p.due)
                      ? "warning"
                      : undefined
              }
              empty={
                <EmptyState
                  icon="cog"
                  title={t("empty")}
                  action={
                    <Button asChild variant="secondary" iconEnd="arrow-right">
                      <Link href={href(view === "active" ? "inactive" : "active")}>
                        {t(view === "active" ? "inactive" : "active")}
                      </Link>
                    </Button>
                  }
                />
              }
              columns={[
                {
                  key: "name",
                  header: t("name"),
                  primary: true,
                  cell: (m) => (
                    <span className="flex flex-col">
                      <span className="[overflow-wrap:anywhere] break-keep">{m.name}</span>
                      {m.details ? <span className="text-muted text-sm font-normal">{m.details}</span> : null}
                    </span>
                  ),
                },
                {
                  key: "state",
                  header: tShared("now"),
                  cell: (m) =>
                    m.status === "active" ? (
                      <span className="flex flex-col items-start gap-1">
                        <StatusChip map={ERP_MACHINE_STATE} value={m.state} />
                        {m.running ? (
                          <span className="text-muted text-sm">
                            {t("running", { name: m.running.operation.name, mo: m.running.order.moNo })}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <Badge tone="neutral">{t("inactive")}</Badge>
                    ),
                },
                {
                  key: "queue",
                  header: tShared("queue"),
                  align: "end",
                  className: "whitespace-nowrap",
                  cell: (m) => t("queued", { n: m.queued }),
                },
                {
                  key: "output",
                  header: tShared("output"),
                  align: "end",
                  hideOnPhone: true,
                  className: "whitespace-nowrap",
                  cell: (m) => t("impressions", { n: format.number(Number(m.impressions30d)) }),
                },
                {
                  key: "maintenance",
                  header: tMt("title"),
                  cell: (m) =>
                    m.openMaintenance || m.plans.length ? (
                      <span className="flex flex-col gap-0.5 text-sm">
                        {m.openMaintenance ? (
                          <span className="text-danger font-medium">
                            {tShared("moStep", { mo: m.openMaintenance.mtNo, step: m.openMaintenance.title })}
                          </span>
                        ) : null}
                        {m.plans.map((plan) => (
                          <span
                            key={plan.planId}
                            className={plan.due ? "text-warning-subtle-fg font-medium" : "text-muted"}
                          >
                            {planLine(t as never, plan, n)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    ),
                },
              ]}
            />
          </>
        ) : (
          <EmptyState
            icon="cog"
            title={t("empty")}
            description={t("emptyBody")}
            action={canConfigure ? <MachineButton /> : undefined}
          />
        )
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
