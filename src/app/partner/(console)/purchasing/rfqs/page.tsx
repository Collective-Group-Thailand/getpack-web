import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_RFQ_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.rfqs"))("title") };
}

const VIEWS = ["open", "awarded", "all"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/** Requests for quotation (D-348): in progress first, awarded, everything. */
export default async function RfqsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tPo, tCommon, format, context] = await Promise.all([
    getTranslations("partnerOps.rfqs"),
    getTranslations("partnerErp.purchasing"),
    getTranslations("partnerErp.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = (view: View, perPage: number) =>
    contract.GET("/v1/partner/factories/{factoryId}/erp/rfqs", {
      params: {
        path: { factoryId: context.factoryId },
        query: {
          perPage,
          page: perPage === 1 ? 1 : page,
          ...(view === "all" ? {} : { status: view }),
          ...(q ? { q } : {}),
        },
      },
    });
  // Every tab's count with the same search, so a tab says exactly how many rows it opens.
  const [list, counts] = await Promise.all([
    attempt(async () => (await read(view, PER_PAGE)).data!),
    viewTotals(VIEWS, async (key) => (await read(key, 1)).data),
  ]);
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/purchasing/rfqs${queryOf({ view: next === "open" ? undefined : next, ...extra })}`;

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      back={{ href: "/purchasing", label: tPo("title") }}
      actions={
        canAt(context, "factory_procurement.manage") ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/purchasing/rfqs/new">{t("new")}</Link>
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
          id="rfq-q"
          action="/purchasing/rfqs"
          hidden={{ view: view === "open" ? undefined : view }}
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
            rowKey={(r) => r.id}
            rowHref={(r) => `/purchasing/rfqs/${r.id}`}
            empty={
              <EmptyState
                icon="scale"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  canAt(context, "factory_procurement.manage") ? (
                    <Button asChild iconStart="plus">
                      <Link href="/purchasing/rfqs/new">{t("new")}</Link>
                    </Button>
                  ) : view !== "all" ? (
                    <Button asChild variant="secondary" iconEnd="arrow-right">
                      <Link href={href("all")}>{t("views.all")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            }
            columns={[
              {
                key: "no",
                header: t("table.no"),
                primary: true,
                cell: (r) => <span className="whitespace-nowrap tabular-nums">{r.rfqNo}</span>,
              },
              { key: "subject", header: t("table.subject"), cell: (r) => r.title },
              {
                key: "quoteBy",
                header: t("table.quoteBy"),
                className: "whitespace-nowrap",
                hideOnPhone: true,
                cell: (r) => format.date(r.quoteBy),
              },
              {
                key: "suppliers",
                header: t("table.suppliers"),
                cell: (r) => t("table.answered", { n: r.answered, total: r.supplierCount }),
              },
              {
                key: "status",
                header: t("table.status"),
                cell: (r) => <StatusChip map={ERP_RFQ_STATUS} value={r.status} />,
              },
            ]}
          />
          <Pager
            page={page}
            perPage={PER_PAGE}
            total={list.data.meta.total}
            hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
            labels={{
              nav: tCommon("pagination.nav"),
              previous: tCommon("pagination.previous"),
              next: tCommon("pagination.next"),
              page: (n: number) => tCommon("pagination.page", { n }),
            }}
          />
        </>
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
