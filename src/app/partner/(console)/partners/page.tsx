import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { Button } from "@/ui/components/Button";
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
  const [t, tCommon, context] = await Promise.all([
    getTranslations("partnerErp.partners"),
    getTranslations("partnerErp.common"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = (key: View, perPage: number) =>
    contract.GET("/v1/partner/factories/{factoryId}/erp/partners", {
      params: {
        path: { factoryId: context.factoryId },
        query: {
          perPage,
          page: perPage === 1 ? 1 : page,
          ...(key === "archived" ? { status: "archived" } : { role: key }),
          ...(q ? { q } : {}),
        },
      },
    });
  // Every tab's count with the same search, so a tab says exactly how many rows it opens.
  const [list, counts] = await Promise.all([
    attempt(async () => (await read(view, PER_PAGE)).data!),
    viewTotals(VIEWS, async (key) => (await read(key, 1)).data),
  ]);
  const manage = canAt(context, "factory_trading_partners.manage");
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
      full
      title={t("title")}
      description={t("body")}
      actions={
        manage ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href={`/partners/new${view === "customer" ? "?kind=customer" : ""}`}>{t("new")}</Link>
          </Button>
        ) : undefined
      }
    >
      <ListToolbar>
        <ViewTabs
          label={t("views.label")}
          current={view}
          items={VIEWS.map((key) => ({ key, href: href(key, { q }), label: t(`views.${key}`), count: counts[key] }))}
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
      </ListToolbar>
      {list.data ? (
        <>
          <PartnerTable
            caption={t(`views.${view}`)}
            rows={list.data.data}
            rowKey={(p) => p.id}
            rowHref={(p) => `/partners/${p.id}`}
            empty={
              <EmptyState
                icon="handshake"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  manage && view !== "archived" ? (
                    <Button asChild variant="secondary" iconStart="plus">
                      <Link href={`/partners/new${view === "customer" ? "?kind=customer" : ""}`}>{t("new")}</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="secondary" iconEnd="arrow-right">
                      <Link href={href(view === "supplier" ? "customer" : "supplier")}>
                        {t(view === "supplier" ? "views.customer" : "views.supplier")}
                      </Link>
                    </Button>
                  )
                }
              />
            }
            columns={[
              {
                key: "name",
                header: t("table.name"),
                primary: true,
                cell: (p) => (
                  <span className="flex flex-col">
                    <span>{p.name}</span>
                    <span className="text-muted text-sm tabular-nums">{p.code}</span>
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
