import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_MACHINE_STATE } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { MachineButton } from "@/features/partner/ops/MachineForm";
import { MaintenanceTable } from "@/features/partner/ops/MaintenanceTable";
import { planLine } from "@/features/partner/ops/machine-text";
import { RelatedDocuments } from "@/features/partner/ops/RelatedDocuments";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.machines"))("title") };
}

/** One machine (D-355): what it does now, its maintenance plans and history, and its documents. */
export default async function MachinePage({ params }: { params: Promise<{ machineId: string }> }) {
  const [{ machineId }, t, tMt, tShared, tStatus, format, context] = await Promise.all([
    params,
    getTranslations("partnerOps.machines"),
    getTranslations("partnerOps.maintenance"),
    getTranslations("partnerOps.shared"),
    getTranslations("status"),
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

  return (
    <PartnerPage
      wide
      title={m.name}
      description={m.details ?? undefined}
      back={back}
      actions={
        <div className="flex flex-wrap gap-2">
          {m.status === "active" ? (
            <Button asChild variant="secondary" iconStart="tablet">
              <Link href={`/floor/kiosk/${m.id}`}>{t("kiosk")}</Link>
            </Button>
          ) : null}
          {canAt(context, "factory_maintenance.report") && m.status === "active" ? (
            <Button asChild variant="destructive" iconStart="wrench">
              <Link href={`/maintenance/new?machine=${m.id}`}>{tMt("report")}</Link>
            </Button>
          ) : null}
          {canAt(context, "factory_erp.configure") ? <MachineButton machine={m} /> : null}
        </div>
      }
    >
      <DescriptionList
        items={[
          { term: tMt("facts.machine"), description: <StatusChip map={ERP_MACHINE_STATE} value={m.state} /> },
          {
            term: tShared("now"),
            description: m.running ? (
              <Link href={`/planning/orders/${m.running.order.id}`} className="underline-offset-4 hover:underline">
                {t("running", { name: m.running.operation.name, mo: m.running.order.moNo })}
              </Link>
            ) : (
              tStatus("erpMachine.idle")
            ),
          },
          { term: tShared("queue"), description: t("queued", { n: m.queued }) },
          { term: tShared("output"), description: t("impressions", { n: n(Number(m.impressions30d)) }) },
          ...(m.maxWidthMm && m.maxLengthMm
            ? [{ term: tShared("size"), description: tShared("sizeMm", { w: m.maxWidthMm, l: m.maxLengthMm }) }]
            : []),
        ]}
      />

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
            <ul className="flex flex-col gap-1">
              {m.plans.map((plan) => (
                <li key={plan.planId}>
                  <Link href={`/maintenance/plans/${plan.planId}`} className="underline-offset-4 hover:underline">
                    {planLine(t as never, plan, n)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{tMt("plans.empty")}</p>
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
              empty={<EmptyState icon="wrench" title={tMt("empty")} />}
            />
          ) : (
            <PageError error={history.error} />
          )}
        </PartnerSection>
      ) : null}

      <RelatedDocuments type="machine" id={m.id} label={m.name} />
    </PartnerPage>
  );
}
