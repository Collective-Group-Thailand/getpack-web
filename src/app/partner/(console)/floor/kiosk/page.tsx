import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_MACHINE_STATE } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { StatusChip } from "@/features/partner/status";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

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
  const tNav = await getTranslations("partner.sidebar.items");
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
    <PartnerPage wide title={t("title")} description={t("body")} back={{ href: "/floor", label: tFloor("title") }}>
      {read.data ? (
        machines.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("pick")}>
            {machines.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/floor/kiosk/${m.id}`}
                  className={cn(
                    "bg-surface hover:border-border-strong focus-visible:ring-focus-ring rounded-panel flex min-h-40 flex-col gap-4 border border-t-4 p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    m.state === "down" || m.state === "maintenance"
                      ? "border-border border-t-danger"
                      : m.running
                        ? "border-border border-t-primary"
                        : "border-border border-t-border-strong",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-xl leading-snug font-semibold [overflow-wrap:anywhere] break-keep">
                      {m.name}
                    </span>
                    <StatusChip map={ERP_MACHINE_STATE} value={m.state} size="md" />
                  </span>
                  <span className={m.running ? "font-medium" : "text-muted"}>
                    {m.running
                      ? tShared("moStep", { mo: m.running.order.moNo, step: m.running.operation.name })
                      : t("nothingNow")}
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-lg font-semibold tabular-nums">{t("queued", { n: m.queued })}</span>
                    <Icon name="arrow-right" size={22} aria-hidden="true" className="text-muted" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="tablet"
            title={tMachines("empty")}
            description={tMachines("emptyBody")}
            action={
              <Button asChild variant="secondary" size="xl">
                <Link href="/machines">{tNav("machines")}</Link>
              </Button>
            }
          />
        )
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
