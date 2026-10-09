import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { factoryContext } from "@/features/partner/context/server";
import { PurchaseOrderForm } from "@/features/partner/erp/PurchaseOrderForm";
import { erpPickers } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.purchasing.form"))("newTitle") };
}

/** A new draft purchase order (D-325); `?supplier=` preselects one. */
export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  const [{ supplier }, t, tPo, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerErp.purchasing.form"),
    getTranslations("partnerErp.purchasing"),
    getLocale(),
    factoryContext(),
  ]);
  const pickers = await erpPickers(context.factoryId);
  return (
    <PartnerPage wide title={t("newTitle")} description={t("body")} back={{ href: "/purchasing", label: tPo("title") }}>
      {pickers.data ? (
        <PurchaseOrderForm
          items={pickers.data.items}
          suppliers={pickers.data.suppliers}
          locale={locale}
          {...(supplier ? { initialSupplierId: supplier } : {})}
        />
      ) : (
        <PageError error={pickers.error} />
      )}
    </PartnerPage>
  );
}
