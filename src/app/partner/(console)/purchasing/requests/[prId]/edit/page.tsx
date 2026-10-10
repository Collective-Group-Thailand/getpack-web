import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { RequestForm } from "@/features/partner/erp/RequestForm";
import { erpItems } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.requests"))("editTitle") };
}

/** Edit a draft purchase request (D-336), under `If-Match`. */
export default async function EditPurchaseRequestPage({ params }: { params: Promise<{ prId: string }> }) {
  const [{ prId }, t, locale, context] = await Promise.all([
    params,
    getTranslations("partnerFactory.requests"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const [{ data, response }, items] = await Promise.all([
      contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}", {
        params: { path: { factoryId: context.factoryId, prId } },
      }),
      erpItems(contract, context.factoryId),
    ]);
    return { request: data!, etag: response.headers.get("etag"), items };
  });
  return (
    <PartnerPage wide title={t("editTitle")} back={{ href: `/purchasing/requests/${prId}`, label: t("title") }}>
      {read.data ? (
        <RequestForm
          request={read.data.request}
          etag={read.data.etag}
          items={read.data.items.filter((i) => i.status === "active")}
          locale={locale}
        />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
