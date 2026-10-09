import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.partners"))("title") };
}

const VIEWS = ["supplier", "customer", "archived"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/** The factory's own suppliers and customers (D-317): private to the factory. */
export default async function TradingPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "supplier";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tCommon, tStock, context] = await Promise.all([
    getTranslations("partnerErp.partners"),
    getTranslations("partnerErp.common"),
    getTranslations("partnerErp.stock"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const list = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/partners", {
          params: {
            path: { factoryId: context.factoryId },
            query: {
              perPage: PER_PAGE,
              page,
              ...(view === "archived" ? { status: "archived" } : { role: view }),
              ...(q ? { q } : {}),
            },
          },
        })
      ).data!,
  );
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/partners${queryOf({ view: next === "supplier" ? undefined : next, ...extra })}`;
  const pagination = {
    nav: tCommon("pagination.nav"),
    previous: tCommon("pagination.previous"),
    next: tCommon("pagination.next"),
    page: (n: number) => tCommon("pagination.page", { n }),
  };

  return (
    <PartnerPage
      wide
      title={t("title")}
      description={t("body")}
      actions={
        canAt(context, "factory_trading_partners.manage") ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href={`/partners/new${view === "customer" ? "?kind=customer" : ""}`}>{t("new")}</Link>
          </Button>
        ) : undefined
      }
    >
      <Callout tone="info" icon="lock">
        {tStock("privacy")}
      </Callout>
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({ key, href: href(key), label: t(`views.${key}`) }))}
      />
      <SearchBar
        id="partners-q"
        action="/partners"
        hidden={{ view: view === "supplier" ? undefined : view }}
        q={q}
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        button={tCommon("search")}
      />
      {list.data ? (
        <>
          <PartnerTable
            caption={t(`views.${view}`)}
            rows={list.data.data}
            rowKey={(p) => p.id}
            rowHref={(p) => `/partners/${p.id}`}
            empty={<EmptyState icon="handshake" title={t("empty")} description={t("emptyBody")} />}
            columns={[
              {
                key: "name",
                header: t("table.name"),
                primary: true,
                cell: (p) => (
                  <span className="flex flex-col">
                    <span>{p.name}</span>
                    <span className="text-muted font-mono text-sm">{p.code}</span>
                  </span>
                ),
              },
              {
                key: "kind",
                header: t("table.kind"),
                hideOnPhone: true,
                cell: (p) => tCommon(`partnerKinds.${p.kind}`),
              },
              { key: "contact", header: t("table.contact"), cell: (p) => p.contactName ?? "—" },
              {
                key: "phone",
                header: t("table.phone"),
                cell: (p) =>
                  p.phone ? (
                    <a href={`tel:${p.phone}`} className="relative z-10 underline-offset-4 hover:underline">
                      {p.phone}
                    </a>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "terms",
                header: t("table.terms"),
                cell: (p) => (p.paymentTermDays ? t("days", { n: p.paymentTermDays }) : t("cash")),
              },
            ]}
          />
          <Pager
            page={page}
            perPage={PER_PAGE}
            total={list.data.meta.total}
            hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
            labels={pagination}
          />
        </>
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
