import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { RequestForm } from "@/features/partner/erp/RequestForm";
import { erpItems } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.requests"))("newTitle") };
}

/** A new purchase request (D-336); `?item=` starts with that item. */
export default async function NewPurchaseRequestPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const [{ item }, t, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerFactory.requests"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const items = await attempt(() => erpItems(contract, context.factoryId));
  return (
    <PartnerPage
      wide
      title={t("newTitle")}
      description={t("newBody")}
      back={{ href: "/purchasing/requests", label: t("title") }}
    >
      {items.data ? (
        <RequestForm
          items={items.data.filter((i) => i.status === "active")}
          locale={locale}
          {...(item ? { initialItemId: item } : {})}
        />
      ) : (
        <PageError error={items.error} />
      )}
    </PartnerPage>
  );
}
