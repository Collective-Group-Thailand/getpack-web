import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { erpItems, erpSuppliers } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { RfqForm } from "@/features/partner/ops/RfqForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.rfqs"))("title") };
}

/** Edits a draft request for quotation (D-348). */
export default async function EditRfqPage({ params }: { params: Promise<{ rfqId: string }> }) {
  const [{ rfqId }, t, locale, context] = await Promise.all([
    params,
    getTranslations("partnerOps.rfqs"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const [rfq, items, suppliers] = await Promise.all([
      contract.GET("/v1/partner/factories/{factoryId}/erp/rfqs/{rfqId}", {
        params: { path: { factoryId: context.factoryId, rfqId } },
      }),
      erpItems(contract, context.factoryId),
      erpSuppliers(contract, context.factoryId),
    ]);
    return { rfq: rfq.data!, etag: rfq.response.headers.get("etag"), items, suppliers };
  });
  const back = { href: `/purchasing/rfqs/${rfqId}`, label: t("title") };
  return (
    <PartnerPage
      wide
      title={read.data ? t("editTitle", { no: read.data.rfq.rfqNo }) : t("title")}
      back={back}
    >
      {read.data ? (
        <RfqForm
          rfq={read.data.rfq}
          etag={read.data.etag}
          items={read.data.items.filter((i) => i.status === "active")}
          suppliers={read.data.suppliers.filter((s) => s.status === "active" && s.kind !== "customer")}
          locale={locale}
        />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
