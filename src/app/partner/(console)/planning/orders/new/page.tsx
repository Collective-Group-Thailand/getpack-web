import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { ProductionOrderForm } from "@/features/partner/erp/ProductionOrderForm";
import { erpItems, erpWarehouses } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.orders.form"))("newTitle") };
}

/** Plan a production order of the factory's own (D-340); `?item=` preselects the product. */
export default async function NewProductionOrderPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const [{ item }, t, tPlan, context] = await Promise.all([
    searchParams,
    getTranslations("partnerFactory.orders.form"),
    getTranslations("partnerFactory.planning"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const [items, warehouses, recipes] = await Promise.all([
      erpItems(contract, context.factoryId),
      erpWarehouses(contract, context.factoryId),
      contract.GET("/v1/partner/factories/{factoryId}/erp/recipes", {
        params: { path: { factoryId: context.factoryId }, query: { perPage: 100, status: "active" } },
      }),
    ]);
    return {
      items: items.filter((i) => i.status === "active" && (i.kind === "finished_good" || i.kind === "semi_finished")),
      warehouses: warehouses.filter((w) => w.status === "active"),
      recipes: recipes.data?.data ?? [],
    };
  });
  return (
    <PartnerPage
      wide
      title={t("newTitle")}
      description={t("newBody")}
      back={{ href: "/planning", label: tPlan("title") }}
    >
      {read.data ? (
        <ProductionOrderForm {...read.data} {...(item ? { initialItemId: item } : {})} />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
