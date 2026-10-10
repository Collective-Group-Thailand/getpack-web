import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { InvoiceForm } from "@/features/partner/erp/InvoiceForm";
import { erpSuppliers } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.payables.form"))("newTitle") };
}

/** Record a supplier invoice (D-337); `?po=` matches it against that purchase order. */
export default async function NewSupplierInvoicePage({ searchParams }: { searchParams: Promise<{ po?: string }> }) {
  const [{ po }, t, tAp, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerFactory.payables.form"),
    getTranslations("partnerFactory.payables"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const read = await attempt(async () => {
    const [suppliers, orders, order] = await Promise.all([
      erpSuppliers(contract, context.factoryId),
      contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-orders", {
        params: { path, query: { perPage: 100 } },
      }),
      po
        ? contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}", {
            params: { path: { ...path, poId: po } },
          })
        : Promise.resolve(null),
    ]);
    return {
      suppliers: suppliers.filter((s) => s.status === "active"),
      orders: (orders.data?.data ?? []).filter((o) => o.status !== "draft" && o.status !== "cancelled"),
      order: order?.data ?? null,
    };
  });
  return (
    <PartnerPage
      wide
      title={t("newTitle")}
      description={t("newBody")}
      back={{ href: "/payables", label: tAp("title") }}
    >
      {read.data ? (
        <InvoiceForm
          key={po ?? "none"}
          suppliers={read.data.suppliers}
          orders={read.data.orders}
          order={read.data.order}
          locale={locale}
        />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
