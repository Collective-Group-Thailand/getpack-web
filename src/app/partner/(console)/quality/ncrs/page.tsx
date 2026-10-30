import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_NCR_SEVERITY, ERP_NCR_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.ncrs"))("title") };
}

const VIEWS = ["active", "overdue", "closed", "all"] as const;
type View = (typeof VIEWS)[number];

/** Nonconformance reports (D-374): what is open, overdue and done. */
export default async function NcrsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "active";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tSource, format, context] = await Promise.all([
    getTranslations("partnerInsight.ncrs"),
    getTranslations("partnerInsight.sources"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const filter = (key: View) =>
    key === "active"
      ? { status: "active" as const }
      : key === "closed"
        ? { status: "closed" as const }
        : key === "overdue"
          ? { overdue: true }
          : {};
  const list = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/ncrs", {
          params: {
            path: { factoryId: context.factoryId },
            query: { page, perPage: 25, ...filter(view), ...(q ? { q } : {}) },
          },
        })
      ).data!,
  );
  // Every tab's count with the same search, so a tab says exactly how many rows it opens.
  const counts = await viewTotals(
    VIEWS,
    async (key) =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/ncrs", {
          params: {
            path: { factoryId: context.factoryId },
            query: { perPage: 1, ...filter(key), ...(q ? { q } : {}) },
          },
        })
      ).data,
  );
  const canRecord = canAt(context, "factory_quality.record");
  const href = (next: Record<string, string | number | undefined>) =>
    `/quality/ncrs${queryOf({ view: view === "active" ? undefined : view, q, ...next })}`;
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canRecord ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/quality/ncrs/new">{t("new")}</Link>
          </Button>
        ) : null
      }
    >
      <ListToolbar>
        <ViewTabs
          label={t("views.label")}
          current={view}
          items={VIEWS.map((key) => ({
            key,
            href: `/quality/ncrs${queryOf({ view: key === "active" ? undefined : key, q })}`,
            label: t(`views.${key}`),
            count: counts[key],
          }))}
        />
        <SearchBar
          id="ncr-search"
          action="/quality/ncrs"
          hidden={{ view: view === "active" ? undefined : view }}
          q={q}
          label={t("search")}
          placeholder={t("searchPlaceholder")}
          button={t("searchButton")}
        />
      </ListToolbar>
      {list.data ? (
        <>
          <PartnerTable
            caption={t("title")}
            rows={list.data.data}
            rowKey={(row) => row.id}
            rowHref={(row) => `/quality/ncrs/${row.id}`}
            rowTone={(row) =>
              row.overdue ? "danger" : row.severity === "critical" && row.status === "open" ? "warning" : undefined
            }
            empty={
              <EmptyState
                icon="shield-check"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  canRecord ? (
                    <Button asChild variant="secondary" iconStart="plus">
                      <Link href="/quality/ncrs/new">{t("new")}</Link>
                    </Button>
                  ) : view !== "all" ? (
                    <Button asChild variant="secondary" iconEnd="arrow-right">
                      <Link href={href({ view: "all", page: undefined })}>{t("views.all")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            }
            columns={[
              {
                key: "no",
                header: t("ncrNo"),
                primary: true,
                cell: (row) => <span className="tabular-nums">{row.ncrNo}</span>,
              },
              {
                key: "title",
                header: t("titleColumn"),
                cell: (row) => <span className="[overflow-wrap:anywhere] break-keep">{row.title}</span>,
              },
              { key: "src", header: t("source"), hideOnPhone: true, cell: (row) => tSource(row.source) },
              {
                key: "sev",
                header: t("severity"),
                cell: (row) => <StatusChip map={ERP_NCR_SEVERITY} value={row.severity} />,
              },
              { key: "own", header: t("owner"), hideOnPhone: true, cell: (row) => row.owner?.name ?? "—" },
              {
                key: "due",
                header: t("due"),
                cell: (row) => (
                  <span className="flex flex-wrap items-center gap-1 whitespace-nowrap">
                    {format.date(row.actionDueOn)}
                    {row.overdue ? <Badge tone="danger">{t("overdue")}</Badge> : null}
                  </span>
                ),
              },
              { key: "st", header: t("status"), cell: (row) => <StatusChip map={ERP_NCR_STATUS} value={row.status} /> },
            ]}
          />
          <Pager
            page={page}
            perPage={list.data.meta.perPage}
            total={list.data.meta.total}
            hrefFor={(p) => href({ page: p })}
            labels={{ nav: t("pages"), previous: t("previous"), next: t("next"), page: (n) => t("page", { n }) }}
          />
        </>
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
