import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { erpPickers } from "@/features/partner/erp/server";
import { StockMoveForm } from "@/features/partner/erp/StockMoveForm";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { Row, RowList } from "@/features/partner/rows";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.move"))("issueTitle") };
}

/** Stock task "issue" (getpack Factory ERP E1; D-321, D-324). */
export default async function StockIssuePage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const [{ item }, t, tStock, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerErp.move"),
    getTranslations("partnerErp.stock"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const [pickers, orders] = await Promise.all([
    erpPickers(context.factoryId),
    // Material for production is issued against its order (D-341): the orders on the floor come first.
    canAt(context, "factory_planning.read")
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/production-orders", {
                params: { path: { factoryId: context.factoryId }, query: { status: "open", perPage: 20 } },
              })
            ).data!.data.filter((mo) => mo.status === "released" || mo.status === "in_progress"),
        ).then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);
  const tIssue = await getTranslations("partnerErp.issueFor");
  return (
    <PartnerPage title={t("issueTitle")} description={t("issueBody")} back={{ href: "/stock", label: tStock("title") }}>
      {orders.length ? (
        <PartnerSection title={tIssue("title")} description={tIssue("body")}>
          <RowList label={tIssue("title")}>
            {orders.map((mo) => (
              <Row
                key={mo.id}
                href={`/planning/orders/${mo.id}`}
                icon="factory"
                tone={mo.short ? "warning" : "neutral"}
                title={`${mo.moNo} · ${mo.title}`}
                meta={mo.short ? tIssue("short") : tIssue("ready")}
              />
            ))}
          </RowList>
        </PartnerSection>
      ) : null}
      {orders.length ? <h2 className="text-lg font-semibold">{tIssue("other")}</h2> : null}
      {pickers.data ? (
        <StockMoveForm
          mode="issue"
          items={pickers.data.items}
          warehouses={pickers.data.warehouses}
          locale={locale}
          {...(item ? { initialItemId: item } : {})}
        />
      ) : (
        <PageError error={pickers.error} />
      )}
    </PartnerPage>
  );
}
