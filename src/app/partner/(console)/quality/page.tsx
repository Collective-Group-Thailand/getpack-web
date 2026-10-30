import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_CHECK_RESULT } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerStats } from "@/features/partner/frame";
import { FilterLinks, ListToolbar, ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.checks"))("title") };
}

const VIEWS = ["all", "pending", "fail", "pass"] as const;
type View = (typeof VIEWS)[number];
const KINDS = ["incoming", "in_process", "final", "other"] as const;

/** The factory's own quality checks (D-372): incoming, in-process and final, newest first, by result. */
export default async function QualityChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; kind?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "all";
  const kind = KINDS.includes(query.kind as (typeof KINDS)[number])
    ? (query.kind as Schemas["ErpCheckKind"])
    : undefined;
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tKind, tNcr, tTemplates, format, context] = await Promise.all([
    getTranslations("partnerInsight.checks"),
    getTranslations("partnerInsight.kinds"),
    getTranslations("partnerInsight.ncrs"),
    getTranslations("partnerInsight.templates"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const list = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/quality-checks", {
          params: {
            path: { factoryId: context.factoryId },
            query: {
              page,
              perPage: 25,
              ...(view !== "all" ? { result: view } : {}),
              ...(kind ? { kind } : {}),
              ...(q ? { q } : {}),
            },
          },
        })
      ).data!,
  );
  const path = { factoryId: context.factoryId };
  // Every tab's count with the same kind and search, so a tab says exactly how many rows it opens.
  const [counts, ncrOpen, ncrOverdue] = await Promise.all([
    viewTotals(
      VIEWS,
      async (key) =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/quality-checks", {
            params: {
              path,
              query: {
                perPage: 1,
                ...(key !== "all" ? { result: key } : {}),
                ...(kind ? { kind } : {}),
                ...(q ? { q } : {}),
              },
            },
          })
        ).data,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/ncrs", {
            params: { path, query: { perPage: 1, status: "active" } },
          })
        ).data!.meta.total,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/ncrs", {
            params: { path, query: { perPage: 1, overdue: true } },
          })
        ).data!.meta.total,
    ),
  ]);
  const href = (next: Record<string, string | number | undefined>) =>
    `/quality${queryOf({ view: view === "all" ? undefined : view, kind, q, ...next })}`;
  const canRecord = canAt(context, "factory_quality.record");
  const link =
    "text-primary inline-flex min-h-11 items-center gap-1.5 font-medium underline-offset-4 hover:underline md:min-h-8";

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      // NCRs and the check templates are this area's other two screens, one link away.
      meta={
        <nav aria-label={t("title")} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className={link} href="/quality/ncrs">
            <Icon name="shield" size={16} aria-hidden />
            {tNcr("title")}
          </Link>
          <Link className={link} href="/quality/templates">
            <Icon name="checklist" size={16} aria-hidden />
            {tTemplates("title")}
          </Link>
        </nav>
      }
      actions={
        canRecord ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/quality/new">{t("new")}</Link>
          </Button>
        ) : null
      }
    >
      <PartnerStats
        label={t("title")}
        items={[
          ...(counts.pending !== null
            ? [{ key: "pending", label: t("views.pending"), value: counts.pending, href: "/quality?view=pending" }]
            : []),
          ...(counts.fail !== null
            ? [
                {
                  key: "fail",
                  label: t("views.fail"),
                  value: counts.fail,
                  href: "/quality?view=fail",
                  ...(counts.fail ? { tone: "danger" as const } : {}),
                },
              ]
            : []),
          ...(ncrOpen.data !== undefined
            ? [{ key: "ncr", label: t("stats.ncrOpen"), value: ncrOpen.data, href: "/quality/ncrs" }]
            : []),
          ...(ncrOverdue.data !== undefined
            ? [
                {
                  key: "overdue",
                  label: t("stats.ncrOverdue"),
                  value: ncrOverdue.data,
                  href: "/quality/ncrs?view=overdue",
                  ...(ncrOverdue.data ? { tone: "danger" as const } : {}),
                },
              ]
            : []),
        ]}
      />
      <div className="flex flex-col gap-3">
        <ListToolbar>
          <ViewTabs
            label={t("views.label")}
            current={view}
            items={VIEWS.map((key) => ({
              key,
              href: `/quality${queryOf({ view: key === "all" ? undefined : key, kind, q })}`,
              label: t(`views.${key}`),
              count: counts[key],
            }))}
          />
          <SearchBar
            id="qc-search"
            action="/quality"
            hidden={{ view: view === "all" ? undefined : view, kind }}
            q={q}
            label={t("search")}
            placeholder={t("searchPlaceholder")}
            button={t("searchButton")}
          />
        </ListToolbar>
        <FilterLinks
          label={t("kindLabel")}
          current={kind ?? "any"}
          items={[
            { key: "any", href: href({ kind: undefined, page: undefined }), label: t("anyKind") },
            ...KINDS.map((k) => ({ key: k, href: href({ kind: k, page: undefined }), label: tKind(k) })),
          ]}
        />
      </div>
      {list.data ? (
        <>
          <PartnerTable
            caption={t("title")}
            rows={list.data.data}
            rowKey={(row) => row.id}
            rowHref={(row) => `/quality/${row.id}`}
            rowTone={(row) => (row.result === "fail" ? "danger" : row.result === "pending" ? "warning" : undefined)}
            empty={
              <EmptyState
                icon="clipboard-check"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  canRecord ? (
                    <Button asChild variant="secondary" iconStart="plus">
                      <Link href="/quality/new">{t("new")}</Link>
                    </Button>
                  ) : view !== "all" || kind ? (
                    <Button asChild variant="secondary" iconEnd="arrow-right">
                      <Link href="/quality">{t("views.all")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            }
            columns={[
              {
                key: "no",
                header: t("qcNo"),
                primary: true,
                cell: (row) => <span className="tabular-nums">{row.qcNo}</span>,
              },
              { key: "k", header: t("kind"), cell: (row) => tKind(row.kind) },
              {
                key: "what",
                header: t("what"),
                cell: (row) =>
                  [
                    row.item?.name,
                    row.productionOrder?.number,
                    row.goodsReceipt?.number,
                    row.lotNo ? t("lot", { lot: row.lotNo }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—",
              },
              {
                key: "q",
                header: t("qty"),
                align: "end",
                hideOnPhone: true,
                cell: (row) => (row.inspectedQty ? formatQty(row.inspectedQty, format.locale) : "—"),
              },
              { key: "by", header: t("inspector"), hideOnPhone: true, cell: (row) => row.inspector.name },
              { key: "at", header: t("at"), hideOnPhone: true, cell: (row) => format.dateTime(row.inspectedAt) },
              {
                key: "r",
                header: t("result"),
                cell: (row) => <StatusChip map={ERP_CHECK_RESULT} value={row.result} />,
              },
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
