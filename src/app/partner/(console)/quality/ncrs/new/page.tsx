import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { factoryContext } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { NcrForm } from "@/features/partner/insight/QualityForms";
import { qualityPickers } from "@/features/partner/insight/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.ncrs.form"))("pageTitle") };
}

/** Raises an NCR (D-374): a customer complaint, something found inside, or a supplier's goods. */
export default async function NewNcrPage({
  searchParams,
}: {
  searchParams: Promise<{ checkId?: string; productionOrderId?: string; itemId?: string }>;
}) {
  const [query, t, context] = await Promise.all([
    searchParams,
    getTranslations("partnerInsight.ncrs.form"),
    factoryContext(),
  ]);
  const pickers = await qualityPickers(context.factoryId);
  return (
    <PartnerPage
      full
      title={t("pageTitle")}
      description={t("pageBody")}
      back={{ href: "/quality/ncrs", label: t("back") }}
    >
      {pickers.data ? (
        <NcrForm
          items={pickers.data.items}
          customers={pickers.data.customers}
          suppliers={pickers.data.suppliers}
          machines={pickers.data.machines}
          warehouses={pickers.data.warehouses}
          people={pickers.data.people}
          initial={{
            ...(query.checkId ? { checkId: query.checkId } : {}),
            ...(query.productionOrderId ? { productionOrderId: query.productionOrderId } : {}),
            ...(query.itemId ? { itemId: query.itemId } : {}),
          }}
        />
      ) : (
        <PageError error={pickers.error} />
      )}
    </PartnerPage>
  );
}
