import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { DeliveryForm } from "@/features/partner/sales/DeliveryForms";
import { EmptyState } from "@/ui/components/EmptyState";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.deliveries"))("newTitle") };
}

/** A new delivery note for a confirmed sales order (`?so=`, D-362). */
export default async function NewDeliveryPage({ searchParams }: { searchParams: Promise<{ so?: string }> }) {
  const [{ so }, t, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerSales.deliveries"),
    getLocale(),
    factoryContext(),
  ]);
  const back = { href: so ? `/sales-orders/${so}` : "/deliveries", label: t("title") };
  if (!so)
    return (
      <PartnerPage title={t("newTitle")} back={back}>
        <EmptyState
          icon="truck"
          title={t("pickOrder")}
          action={
            <Button asChild>
              <Link href="/sales-orders">{t("toOrders")}</Link>
            </Button>
          }
        />
      </PartnerPage>
    );
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-orders/{salesOrderId}", {
          params: { path: { factoryId: context.factoryId, salesOrderId: so } },
        })
      ).data!,
  );
  return (
    <PartnerPage
      wide
      title={t("newTitle")}
      description={read.data ? t("newBody", { no: read.data.soNo, customer: read.data.customer.name }) : undefined}
      back={back}
    >
      {read.data ? <DeliveryForm order={read.data} locale={locale} /> : <PageError error={read.error} />}
    </PartnerPage>
  );
}
