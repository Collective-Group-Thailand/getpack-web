import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getReorder } from "@/features/customer/fulfilment/api.server";
import { ReorderView } from "@/features/customer/fulfilment/ReorderView";
import { LiffHeader } from "@/features/customer/liff/LiffHeader";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";
import { getMyOrder } from "@/features/customer/orders/api.server";
import { specLinesOf } from "@/features/customer/orders/summary";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fulfilment.reorder");
  return { title: t("title") };
}

/** Reorder in LINE (D-151), then checkout on the site. */
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  if (!(await liffCustomer())) return <LiffSignIn />;
  const { orderId } = await params;
  const [t, tCatalog, locale, preview, detail] = await Promise.all([
    getTranslations("fulfilment.reorder"),
    getTranslations("catalog"),
    getLocale(),
    getReorder(orderId),
    getMyOrder(orderId),
  ]);
  const summary = detail?.order.summary;
  return (
    <div className="flex flex-col gap-4">
      <LiffHeader
        back={{ href: `/liff/orders/${orderId}`, label: preview ? t("back", { code: preview.orderCode }) : t("title") }}
        title={preview ? t("titleFor", { code: preview.orderCode }) : t("title")}
      />
      {preview && summary ? (
        <ReorderView
          initial={preview}
          specs={specLinesOf(locale, summary)}
          unit={tCatalog(`stock.units.${summary.unit}`)}
        />
      ) : (
        <Callout tone="info">{t("notAllowed")}</Callout>
      )}
    </div>
  );
}
