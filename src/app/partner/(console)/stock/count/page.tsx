import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { factoryContext } from "@/features/partner/context/server";
import { erpPickers } from "@/features/partner/erp/server";
import { CountSheet } from "@/features/partner/erp/CountSheet";
import { StockMoveForm } from "@/features/partner/erp/StockMoveForm";
import { ViewTabs } from "@/features/partner/rows";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.move"))("countTitle") };
}

/** Stock task "count" (getpack Factory ERP E1; D-321, D-324). */
export default async function StockCountPage({ searchParams }: { searchParams: Promise<{ item?: string; view?: string }> }) {
  const [query, t, tStock, tCount, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerErp.move"),
    getTranslations("partnerErp.stock"),
    getTranslations("partnerErp.count"),
    getLocale(),
    factoryContext(),
  ]);
  const { item, view } = query;
  const pickers = await erpPickers(context.factoryId);
  // One item (from its page) opens the single form; the store's walk round opens the sheet.
  const single = view === "single" || Boolean(item);
  return (
    <PartnerPage title={t("countTitle")} description={t("countBody")} back={{ href: "/stock", label: tStock("title") }}>
      <ViewTabs
        label={tCount("tabs.label")}
        current={single ? "single" : "sheet"}
        items={[
          { key: "sheet", href: "/stock/count", label: tCount("tabs.sheet") },
          { key: "single", href: "/stock/count?view=single", label: tCount("tabs.single") },
        ]}
      />
      {pickers.data ? (
        single ? (
          <StockMoveForm
            mode="count"
            items={pickers.data.items}
            warehouses={pickers.data.warehouses}
            locale={locale}
            {...(item ? { initialItemId: item } : {})}
          />
        ) : (
          <CountSheet items={pickers.data.items} warehouses={pickers.data.warehouses} locale={locale} />
        )
      ) : (
        <PageError error={pickers.error} />
      )}
    </PartnerPage>
  );
}
