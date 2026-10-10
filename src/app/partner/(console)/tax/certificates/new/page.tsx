import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { WhtCertificateForm } from "@/features/partner/sales/TaxForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.tax.certificates"))("newTitle") };
}

/** A 50 ทวิ for a supplier payment (`?payment=`, D-366), started from what its invoices suggest. */
export default async function NewCertificatePage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const [{ payment }, t, context] = await Promise.all([
    searchParams,
    getTranslations("partnerSales.tax.certificates"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = payment
    ? await attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/supplier-payments/{paymentId}/wht", {
              params: { path: { factoryId: context.factoryId, paymentId: payment } },
            })
          ).data!,
      )
    : { data: null, error: new Error("payment") };
  return (
    <PartnerPage
      wide
      title={t("newTitle")}
      back={{ href: payment ? `/payables/payments/${payment}` : "/tax?view=certificates", label: t("back") }}
    >
      {read.data ? <WhtCertificateForm suggestion={read.data} /> : <PageError error={read.error} />}
    </PartnerPage>
  );
}
