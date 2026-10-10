import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PaymentForm } from "@/features/partner/erp/PaymentForm";
import { erpSuppliers } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.payables.pay"))("newTitle") };
}

/** Pay a supplier (D-338); `?supplier=` lists its open invoices, `?invoice=` ticks one. */
export default async function NewSupplierPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string; invoice?: string }>;
}) {
  const { supplier, invoice } = await searchParams;
  const [t, tAp, context] = await Promise.all([
    getTranslations("partnerFactory.payables.pay"),
    getTranslations("partnerFactory.payables"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const [suppliers, invoices] = await Promise.all([
      erpSuppliers(contract, context.factoryId),
      supplier
        ? contract.GET("/v1/partner/factories/{factoryId}/erp/supplier-invoices", {
            params: {
              path: { factoryId: context.factoryId },
              query: { supplierId: supplier, status: "open", perPage: 100 },
            },
          })
        : Promise.resolve(null),
    ]);
    return { suppliers, invoices: invoices?.data?.data ?? [] };
  });
  return (
    <PartnerPage
      wide
      title={t("newTitle")}
      description={t("newBody")}
      back={{ href: "/payables", label: tAp("title") }}
    >
      {read.data ? (
        <PaymentForm
          key={supplier ?? "none"}
          suppliers={read.data.suppliers}
          supplierId={supplier ?? null}
          invoices={read.data.invoices}
          {...(invoice ? { preselect: invoice } : {})}
        />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
