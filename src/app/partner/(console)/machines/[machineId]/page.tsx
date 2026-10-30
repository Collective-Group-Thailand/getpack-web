import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_MACHINE_STATE } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { SummaryRows } from "@/features/partner/form-layout";
import { Row, RowList } from "@/features/partner/rows";
import { MachineButton } from "@/features/partner/ops/MachineForm";
import { MaintenanceTable } from "@/features/partner/ops/MaintenanceTable";
import { planLine } from "@/features/partner/ops/machine-text";
import { RelatedDocuments } from "@/features/partner/ops/RelatedDocuments";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.machines"))("title") };
}

/** One machine (D-355): what it does now, its maintenance plans and history, and its documents. */
export default async function MachinePage({ params }: { params: Promise<{ machineId: string }> }) {
  const [{ machineId }, t, tMt, tShared, tStatus, tSales, format, context] = await Promise.all([
    params,
    getTranslations("partnerOps.machines"),
    getTranslations("partnerOps.maintenance"),
    getTranslations("partnerOps.shared"),
    getTranslations("status"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId, machineId };
  const canMaintenance = canAt(context, "factory_maintenance.read");
  const read = await attempt(
    async () =>
      (await contract.GET("/v1/partner/factories/{factoryId}/erp/machines/{machineId}", { params: { path } })).data!,
  );
  const history = canMaintenance
    ? await attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/maintenance/orders", {
              params: { path: { factoryId: context.factoryId }, query: { machineId, perPage: 20 } },
            })
          ).data!,
      )
    : null;
  const back = { href: "/machines", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const m = read.data;
  const n = (value: number) => format.number(value);

  const canReport = canAt(context, "factory_maintenance.report") && m.status === "active";
  const canConfigure = canAt(context, "factory_erp.configure");

  return (
    <PartnerPage
      full
      title={m.name}
      description={m.details ?? undefined}
      back={back}
      status={
        m.status === "active" ? (
          <StatusChip map={ERP_MACHINE_STATE} value={m.state} />
        ) : (
          <Badge tone="neutral">{t("inactive")}</Badge>
        )
      }
    >
      {/* The machine's history on the left; what it is doing now and what to do with it in a panel in view. */}
      <PartnerDetail
        aside={
          <ActionPanel id="machine-next" tone="neutral" title={tSales("nextSteps")}>
            <SummaryRows
              rows={[
                {
                  key: "now",
                  label: tShared("now"),
                  value: m.running ? (
                    <Link
                      href={`/planning/orders/${m.running.order.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {t("running", { name: m.running.operation.name, mo: m.running.order.moNo })}
                    </Link>
                  ) : (
                    tStatus(`erpMachine.${m.state}`)
                  ),
                },
                { key: "queue", label: tShared("queue"), value: t("queued", { n: m.queued }) },
                {
                  key: "output",
                  label: tShared("output"),
                  value: t("impressions", { n: n(Number(m.impressions30d)) }),
                },
                ...(m.maxWidthMm && m.maxLengthMm
                  ? [
                      {
                        key: "size",
                        label: tShared("size"),
                        value: tShared("sizeMm", { w: m.maxWidthMm, l: m.maxLengthMm }),
                      },
                    ]
                  : []),
              ]}
            />
            <div data-fill="row" className="flex flex-col gap-2">
              {m.status === "active" ? (
                <Button asChild size="lg" iconStart="tablet">
                  <Link href={`/floor/kiosk/${m.id}`}>{t("kiosk")}</Link>
                </Button>
              ) : null}
              {canConfigure ? <MachineButton machine={m} buttonSize="lg" /> : null}
              {canReport ? (
                <Button asChild size="lg" variant="destructive" iconStart="wrench">
                  <Link href={`/maintenance/new?machine=${m.id}`}>{tMt("report")}</Link>
                </Button>
              ) : null}
            </div>
          </ActionPanel>
        }
      >
        {canMaintenance ? (
          <PartnerSection
            title={tMt("plans.title")}
            actions={
              canAt(context, "factory_maintenance.manage") ? (
                <Button asChild size="sm" variant="secondary" iconStart="plus">
                  <Link href={`/maintenance/plans/new?machine=${m.id}`}>{tMt("newPlan")}</Link>
                </Button>
              ) : undefined
            }
          >
            {m.plans.length ? (
              <RowList label={tMt("plans.title")}>
                {m.plans.map((plan) => (
                  <Row
                    key={plan.planId}
                    href={`/maintenance/plans/${plan.planId}`}
                    icon="calendar"
                    tone={plan.due ? "warning" : "neutral"}
                    title={planLine(t as never, plan, n)}
                  />
                ))}
              </RowList>
            ) : (
              <EmptyState
                icon="calendar"
                title={tMt("plans.empty")}
                description={tMt("plans.emptyBody")}
                action={
                  canAt(context, "factory_maintenance.manage") ? (
                    <Button asChild variant="secondary" iconStart="plus">
                      <Link href={`/maintenance/plans/new?machine=${m.id}`}>{tMt("newPlan")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </PartnerSection>
        ) : null}

        {history ? (
          <PartnerSection title={tMt("title")}>
            {history.data ? (
              <MaintenanceTable
                rows={history.data.data}
                caption={tMt("title")}
                withMachine={false}
                empty={
                  <EmptyState
                    icon="wrench"
                    title={tMt("empty")}
                    description={tMt("emptyBody")}
                    action={
                      canReport ? (
                        <Button asChild variant="secondary" iconStart="wrench">
                          <Link href={`/maintenance/new?machine=${m.id}`}>{tMt("report")}</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
            ) : (
              <PageError error={history.error} />
            )}
          </PartnerSection>
        ) : null}

        <RelatedDocuments type="machine" id={m.id} label={m.name} />
      </PartnerDetail>
    </PartnerPage>
  );
}
