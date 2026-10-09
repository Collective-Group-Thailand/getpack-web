import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { factoryContext } from "@/features/partner/context/server";
import { ItemForm } from "@/features/partner/erp/ItemForm";
import { erpPickers } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.item"))("newTitle") };
}

/** A new stock item (D-320). */
export default async function NewItemPage() {
  const [t, tStock, context] = await Promise.all([
    getTranslations("partnerErp.item"),
    getTranslations("partnerErp.stock"),
    factoryContext(),
  ]);
  const pickers = await erpPickers(context.factoryId);
  return (
    <PartnerPage title={t("newTitle")} description={t("newBody")} back={{ href: "/stock", label: tStock("title") }}>
      {pickers.data ? <ItemForm suppliers={pickers.data.suppliers} /> : <PageError error={pickers.error} />}
    </PartnerPage>
  );
}
