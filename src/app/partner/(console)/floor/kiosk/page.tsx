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
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={t("pick")}>
            {machines.map((m) => {
              const stopped = m.state === "down" || m.state === "maintenance";
              return (
                <li key={m.id}>
                  <Link
                    href={`/floor/kiosk/${m.id}`}
                    className={cn(
                      "bg-surface focus-visible:ring-focus-ring rounded-panel group flex h-full min-h-44 flex-col gap-4 border-2 p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none active:translate-y-px",
                      stopped ? "border-danger" : "border-border hover:border-border-strong",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-xl leading-snug font-semibold [overflow-wrap:anywhere] break-keep">
                        {m.name}
                      </span>
                      <StatusChip map={ERP_MACHINE_STATE} value={m.state} size="md" />
                    </span>
                    {m.running ? (
                      <span className="bg-primary-subtle text-primary-subtle-fg rounded-lg px-3 py-2.5">
                        <span className="block text-sm">{t("now")}</span>
                        <span className="block font-semibold [overflow-wrap:anywhere] break-keep">
                          {tShared("moStep", { mo: m.running.order.moNo, step: m.running.operation.name })}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted border-border rounded-lg border border-dashed px-3 py-2.5">
                        {t("nothingNow")}
                      </span>
                    )}
                    <span className="border-border mt-auto flex min-h-14 items-center justify-between gap-2 border-t pt-3">
                      <span className="text-lg font-semibold tabular-nums">{t("queued", { n: m.queued })}</span>
                      <span className="border-border bg-surface-subtle text-fg grid size-11 place-items-center rounded-full border transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
                        <Icon name="arrow-right" size={22} aria-hidden="true" />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
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
