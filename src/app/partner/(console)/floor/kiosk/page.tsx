import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_MACHINE_STATE } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { StatusChip } from "@/features/partner/status";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.kiosk"))("title") };
}

/** The machine kiosk's first screen (D-353): pick the machine this tablet stands by. */
export default async function KioskPickerPage() {
  const [t, tShared, tMachines, tFloor, context] = await Promise.all([
    getTranslations("partnerOps.kiosk"),
    getTranslations("partnerOps.shared"),
    getTranslations("partnerOps.machines"),
    getTranslations("partnerFactory.floor"),
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
  const machines = read.data?.filter((m) => m.status === "active") ?? [];

  return (
    <PartnerPage title={t("title")} description={t("body")} back={{ href: "/floor", label: tFloor("title") }}>
      {read.data ? (
        machines.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("pick")}>
            {machines.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/floor/kiosk/${m.id}`}
                  className="border-border bg-surface hover:border-primary focus-visible:ring-primary flex min-h-32 flex-col justify-between gap-3 rounded-2xl border p-5 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-xl font-semibold">{m.name}</span>
                    <StatusChip map={ERP_MACHINE_STATE} value={m.state} />
                  </span>
                  <span className="text-muted">
                    {m.running
                      ? tShared("moStep", { mo: m.running.order.moNo, step: m.running.operation.name })
                      : t("nothingNow")}
                  </span>
                  <span className="text-lg font-medium">{t("queued", { n: m.queued })}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="tablet" title={tMachines("empty")} description={tMachines("emptyBody")} />
        )
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
