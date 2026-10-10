import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { erpItems, erpSuppliers } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { RfqForm } from "@/features/partner/ops/RfqForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.rfqs"))("newTitle") };
}

/** A new request for quotation (D-348); `?request=` starts from an approved purchase request's open lines. */
export default async function NewRfqPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const [{ request }, t, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerOps.rfqs"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const [items, suppliers, pr] = await Promise.all([
      erpItems(contract, context.factoryId),
      erpSuppliers(contract, context.factoryId),
      request
        ? contract
            .GET("/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}", {
              params: { path: { factoryId: context.factoryId, prId: request } },
            })
            .then((r) => r.data ?? null)
        : Promise.resolve(null),
    ]);
    return { items, suppliers, pr };
  });
  return (
    <PartnerPage wide title={t("newTitle")} description={t("newBody")} back={{ href: "/purchasing/rfqs", label: t("title") }}>
      {read.data ? (
        <RfqForm
          items={read.data.items.filter((i) => i.status === "active")}
          suppliers={read.data.suppliers.filter((s) => s.status === "active" && s.kind !== "customer")}
          locale={locale}
          {...(read.data.pr?.status === "approved" ? { request: read.data.pr } : {})}
        />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
