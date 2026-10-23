import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_CHECK_RESULT } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

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
  const [t, tKind, format, context] = await Promise.all([
    getTranslations("partnerInsight.checks"),
    getTranslations("partnerInsight.kinds"),
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
              ...(query.q ? { q: query.q } : {}),
            },
          },
        })
      ).data!,
  );
  const href = (next: Record<string, string | number | undefined>) =>
    `/quality${queryOf({ view: view === "all" ? undefined : view, kind, q: query.q, ...next })}`;
  const canRecord = canAt(context, "factory_quality.record");

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canRecord ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/quality/new">{t("new")}</Link>
          </Button>
        ) : null
      }
    >
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({
          key,
          href: `/quality${queryOf({ view: key === "all" ? undefined : key, kind })}`,
          label: t(`views.${key}`),
        }))}
      />
      <ViewTabs
        label={t("kindLabel")}
        current={kind ?? "any"}
        items={[
          { key: "any", href: href({ kind: undefined, page: undefined }), label: t("anyKind") },
          ...KINDS.map((k) => ({ key: k, href: href({ kind: k, page: undefined }), label: tKind(k) })),
        ]}
      />
      <SearchBar
        id="qc-search"
        action="/quality"
        hidden={{ view: view === "all" ? undefined : view, kind }}
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
            rowHref={(row) => `/quality/${row.id}`}
            rowTone={(row) => (row.result === "fail" ? "danger" : row.result === "pending" ? "warning" : undefined)}
            empty={<EmptyState icon="clipboard-check" title={t("empty")} description={t("emptyBody")} />}
            columns={[
              {
                key: "no",
                header: t("qcNo"),
                primary: true,
                cell: (row) => <span className="font-mono">{row.qcNo}</span>,
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
