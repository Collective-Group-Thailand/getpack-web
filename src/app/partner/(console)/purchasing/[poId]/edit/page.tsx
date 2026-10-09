import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PurchaseOrderForm } from "@/features/partner/erp/PurchaseOrderForm";
import { erpPickers } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";

type Props = { params: Promise<{ poId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.purchasing.form"))("editTitle") };
}

/** Editing a draft purchase order (D-325); anything else goes back to the order. */
export default async function EditPurchaseOrderPage({ params }: Props) {
  const { poId } = await params;
  const [t, locale, context] = await Promise.all([
    getTranslations("partnerErp.purchasing.form"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const [order, pickers] = await Promise.all([
    attempt(async () => {
      const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}", {
        params: { path: { factoryId: context.factoryId, poId } },
      });
      return { order: data!, etag: response.headers.get("etag") };
    }),
    erpPickers(context.factoryId),
  ]);
  const back = { href: `/purchasing/${poId}`, label: t("editTitle") };
  if (order.data && order.data.order.status !== "draft") redirect(`/purchasing/${poId}`);
  return (
    <PartnerPage wide title={t("editTitle")} description={t("body")} back={back}>
      {order.data && pickers.data ? (
        <PurchaseOrderForm
          order={order.data.order}
          etag={order.data.etag}
          items={pickers.data.items}
          suppliers={pickers.data.suppliers}
          locale={locale}
        />
      ) : (
        <PageError error={order.error ?? pickers.error} />
      )}
    </PartnerPage>
  );
}
