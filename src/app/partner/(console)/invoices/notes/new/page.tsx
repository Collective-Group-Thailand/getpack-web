import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { NoteForm } from "@/features/partner/sales/NoteForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.notes"))("newTitle") };
}

/** A credit (`?kind=credit`) or debit note against an issued invoice (`?invoice=`, D-364). */
export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; kind?: string }>;
}) {
  const [query, t, context] = await Promise.all([
    searchParams,
    getTranslations("partnerSales.notes"),
    factoryContext(),
  ]);
  const kind = query.kind === "debit" ? "debit" : "credit";
  const { contract } = await partnerServerApis();
  const read = query.invoice
    ? await attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-invoices/{invoiceId}", {
              params: { path: { factoryId: context.factoryId, invoiceId: query.invoice! } },
            })
          ).data!,
      )
    : { data: null, error: new Error("invoice") };
  return (
    <PartnerPage
      wide
      title={t(kind === "credit" ? "newCredit" : "newDebit")}
      back={{ href: query.invoice ? `/invoices/${query.invoice}` : "/invoices", label: t("back") }}
    >
      {read.data ? <NoteForm invoice={read.data} kind={kind} /> : <PageError error={read.error} />}
    </PartnerPage>
  );
}
