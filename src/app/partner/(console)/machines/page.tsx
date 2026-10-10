import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_MACHINE_STATE } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { MachineButton } from "@/features/partner/ops/MachineForm";
import { planLine } from "@/features/partner/ops/machine-text";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.machines"))("title") };
}

/** The factory's machines (D-355): state now, queue, output in 30 days and maintenance cycles. */
export default async function MachinesPage() {
  const [t, tShared, tStatus, format, context] = await Promise.all([
    getTranslations("partnerOps.machines"),
    getTranslations("partnerOps.shared"),
    getTranslations("status"),
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

  return (
    <PartnerPage wide title={t("title")} description={t("body")} actions={canConfigure ? <MachineButton /> : undefined}>
      {read.data ? (
        read.data.length ? (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {read.data.map((m) => (
              <li key={m.id} className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/machines/${m.id}`} className="text-lg font-semibold underline-offset-4 hover:underline">
                    {m.name}
                  </Link>
                  {m.status === "active" ? (
                    <StatusChip map={ERP_MACHINE_STATE} value={m.state} />
                  ) : (
                    <Badge tone="neutral">{t("inactive")}</Badge>
                  )}
                </div>
                {m.details ? <p className="text-muted text-sm">{m.details}</p> : null}
                <p className="text-sm">
                  {m.running
                    ? t("running", { name: m.running.operation.name, mo: m.running.order.moNo })
                    : tStatus("erpMachine.idle")}
                  {" · "}
                  {t("queued", { n: m.queued })}
                </p>
                <p className="text-muted text-sm">{t("impressions", { n: format.number(Number(m.impressions30d)) })}</p>
                {m.openMaintenance ? (
                  <Link
                    href={`/maintenance/${m.openMaintenance.id}`}
                    className="text-danger-subtle-fg text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {tShared("moStep", { mo: m.openMaintenance.mtNo, step: m.openMaintenance.title })}
                  </Link>
                ) : null}
                {m.plans.length ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {m.plans.map((plan) => (
                      <li key={plan.planId}>
                        <Link
                          href={`/maintenance/plans/${plan.planId}`}
                          className={
                            plan.due
                              ? "text-warning-subtle-fg font-medium underline-offset-4 hover:underline"
                              : "text-muted underline-offset-4 hover:underline"
                          }
                        >
                          {planLine(t as never, plan, n)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  {m.status === "active" ? (
                    <Link
                      href={`/floor/kiosk/${m.id}`}
                      className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {t("kiosk")}
                    </Link>
                  ) : null}
                  {canConfigure ? <MachineButton machine={m} /> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="cog" title={t("empty")} description={t("emptyBody")} />
        )
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
