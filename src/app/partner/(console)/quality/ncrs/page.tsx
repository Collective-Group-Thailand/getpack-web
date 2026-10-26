import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_NCR_SEVERITY, ERP_NCR_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ViewTabs } from "@/features/partner/rows";
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
  const [t, tSource, format, context] = await Promise.all([
    getTranslations("partnerInsight.ncrs"),
    getTranslations("partnerInsight.sources"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const list = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/ncrs", {
          params: {
            path: { factoryId: context.factoryId },
            query: {
              page,
              perPage: 25,
              ...(view === "active"
                ? { status: "active" }
                : view === "closed"
                  ? { status: "closed" }
                  : view === "overdue"
                    ? { overdue: true }
                    : {}),
              ...(query.q ? { q: query.q } : {}),
            },
          },
        })
      ).data!,
  );
  const href = (next: Record<string, string | number | undefined>) =>
    `/quality/ncrs${queryOf({ view: view === "active" ? undefined : view, q: query.q, ...next })}`;
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canAt(context, "factory_quality.record") ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/quality/ncrs/new">{t("new")}</Link>
          </Button>
        ) : null
      }
    >
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({
          key,
          href: `/quality/ncrs${queryOf({ view: key === "active" ? undefined : key })}`,
          label: t(`views.${key}`),
        }))}
      />
      <SearchBar
        id="ncr-search"
        action="/quality/ncrs"
        hidden={{ view: view === "active" ? undefined : view }}
        q={query.q}
        label={t("search")}
        placeholder={t("searchPlaceholder")}
        button={t("searchButton")}
      />
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
            empty={<EmptyState icon="shield-check" title={t("empty")} description={t("emptyBody")} />}
            columns={[
              {
                key: "no",
                header: t("ncrNo"),
                primary: true,
                cell: (row) => <span className="tabular-nums">{row.ncrNo}</span>,
              },
              { key: "title", header: t("titleColumn"), cell: (row) => row.title },
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
                  <span className="flex items-center gap-1">
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
