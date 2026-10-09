import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { factoryContext } from "@/features/partner/context/server";
import { erpPickers } from "@/features/partner/erp/server";
import { StockMoveForm } from "@/features/partner/erp/StockMoveForm";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.move"))("transferTitle") };
}

/** Stock task "transfer" (Packio Factory ERP E1; D-321, D-324). */
export default async function StockTransferPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const [{ item }, t, tStock, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerErp.move"),
    getTranslations("partnerErp.stock"),
    getLocale(),
    factoryContext(),
  ]);
  const pickers = await erpPickers(context.factoryId);
  return (
    <PartnerPage
      title={t("transferTitle")}
      description={t("transferBody")}
      back={{ href: "/stock", label: tStock("title") }}
    >
      {pickers.data ? (
        <StockMoveForm
          mode="transfer"
          items={pickers.data.items}
          warehouses={pickers.data.warehouses}
          locale={locale}
          {...(item ? { initialItemId: item } : {})}
        />
      ) : (
        <PageError error={pickers.error} />
      )}
    </PartnerPage>
  );
}
