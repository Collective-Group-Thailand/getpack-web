import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { RecipeForm } from "@/features/partner/erp/RecipeForm";
import { erpItems } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.recipes"))("newTitle") };
}

/** Write a recipe (D-339); `?item=` starts with that product. */
export default async function NewRecipePage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const [{ item }, t, context] = await Promise.all([
    searchParams,
    getTranslations("partnerFactory.recipes"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const [items, overview] = await Promise.all([
      erpItems(contract, context.factoryId),
      contract.GET("/v1/partner/factories/{factoryId}/erp/planning/overview", {
        params: { path: { factoryId: context.factoryId } },
      }),
    ]);
    return {
      items: items.filter((i) => i.status === "active"),
      machines: (overview.data?.machines ?? []).map((m) => m.machine),
    };
  });
  return (
    <PartnerPage
      full
      title={t("newTitle")}
      description={t("newBody")}
      back={{ href: "/planning/recipes", label: t("title") }}
    >
      {read.data ? (
        <RecipeForm items={read.data.items} machines={read.data.machines} {...(item ? { initialItemId: item } : {})} />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
