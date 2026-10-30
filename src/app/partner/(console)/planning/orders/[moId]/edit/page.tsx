import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { MoEditForm } from "@/features/partner/erp/MoEditForm";
import { erpItems } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.orders.edit"))("pageTitle") };
}

/** Change an open production order (D-340): dates and priority always; quantity, materials and steps while planned. */
export default async function EditProductionOrderPage({ params }: { params: Promise<{ moId: string }> }) {
  const { moId } = await params;
  const [t, context] = await Promise.all([getTranslations("partnerFactory.orders.edit"), factoryContext()]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const read = await attempt(async () => {
    const [order, items, overview] = await Promise.all([
      contract.GET("/v1/partner/factories/{factoryId}/erp/production-orders/{moId}", {
        params: { path: { ...path, moId } },
      }),
      erpItems(contract, context.factoryId),
      contract.GET("/v1/partner/factories/{factoryId}/erp/planning/overview", { params: { path } }),
    ]);
    return {
      order: order.data!,
      etag: order.response.headers.get("etag"),
      items: items.filter((i) => i.status === "active"),
      machines: (overview.data?.machines ?? []).map((m) => m.machine),
    };
  });
  const back = { href: `/planning/orders/${moId}`, label: read.data?.order.moNo ?? t("pageTitle") };
  return (
    <PartnerPage full title={read.data ? t("heading", { no: read.data.order.moNo }) : t("pageTitle")} back={back}>
      {read.data ? <MoEditForm {...read.data} /> : <PageError error={read.error} />}
    </PartnerPage>
  );
}
