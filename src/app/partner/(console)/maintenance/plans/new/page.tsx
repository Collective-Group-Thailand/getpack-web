import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { erpItems } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { PlanForm } from "@/features/partner/ops/MaintenanceForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.maintenance.planForm"))("newTitle") };
}

/** A new preventive plan (D-355). */
export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ machine?: string }> }) {
  const [{ machine }, t, tMt, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerOps.maintenance.planForm"),
    getTranslations("partnerOps.maintenance"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const [machines, items] = await Promise.all([
      contract.GET("/v1/partner/factories/{factoryId}/erp/machines", {
        params: { path: { factoryId: context.factoryId } },
      }),
      erpItems(contract, context.factoryId),
    ]);
    return { machines: machines.data!, items: items.filter((i) => i.status === "active") };
  });
  return (
    <PartnerPage title={t("newTitle")} back={{ href: "/maintenance?view=plans", label: tMt("plans.title") }}>
      {read.data ? (
        <PlanForm
          machines={read.data.machines.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name }))}
          items={read.data.items}
          locale={locale}
          {...(machine ? { initialMachineId: machine } : {})}
        />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
