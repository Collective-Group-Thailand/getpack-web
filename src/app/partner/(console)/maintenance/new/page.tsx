import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { BreakdownForm } from "@/features/partner/ops/MaintenanceForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.maintenance"))("reportTitle") };
}

/** Report a breakdown (D-355), from the kiosk's button (machine chosen) or from maintenance. */
export default async function ReportBreakdownPage({ searchParams }: { searchParams: Promise<{ machine?: string }> }) {
  const [{ machine }, t, context] = await Promise.all([
    searchParams,
    getTranslations("partnerOps.maintenance"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const machines = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/machines", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data!,
  );
  return (
    <PartnerPage
      title={t("reportTitle")}
      description={t("reportBody")}
      back={
        machine ? { href: `/floor/kiosk/${machine}`, label: t("title") } : { href: "/maintenance", label: t("title") }
      }
    >
      {machines.data ? (
        <BreakdownForm
          machines={machines.data.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name }))}
          {...(machine ? { initialMachineId: machine } : {})}
        />
      ) : (
        <PageError error={machines.error} />
      )}
    </PartnerPage>
  );
}
