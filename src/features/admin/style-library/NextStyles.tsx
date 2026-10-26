"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

import { adminBrowserApis, QueryError, Section, useProductTypes } from "../console";

type Keyword = Schemas["NextStylesKeywordDto"];
type Base = Schemas["NextStylesBaseDto"];
type TypeCount = Schemas["NextStylesTypeCountDto"];
type Structural = Schemas["NextStylesStructuralDto"];

/** This month in Bangkok, `YYYY-MM`. */
const thisMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()).slice(0, 7);

/**
 * What to add to the library next (D-274, D-411): the month's searches that found nothing (only
 * keywords enough people typed, so no one searcher is identifiable), styles customers priced that
 * cannot be shown yet, quotation requests that named no style, and structural design requests per
 * product type — each a sign of a structure the library lacks or holds back.
 */
export function NextStyles() {
  const t = useTranslations("styleLibrary.next");
  const locale = useLocale();
  const format = useFormat();
  const types = useProductTypes();
  const [month, setMonth] = useState(thisMonth);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "next_styles", { month }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/analytics/next-styles", { params: { query: { month } } }))
        .data!,
  });
  const data = query.data;

  const keywords: DataTableColumn<Keyword>[] = [
    { id: "keyword", header: t("keyword"), cell: (row) => <span className="font-medium">{row.keyword}</span> },
    { id: "searches", header: t("searches"), numeric: true, cell: (row) => format.number(row.searches) },
    { id: "searchers", header: t("searchers"), numeric: true, cell: (row) => format.number(row.searchers) },
    {
      id: "surface",
      header: t("surface"),
      cell: (row) => (t.has(`surfaces.${row.surface}`) ? t(`surfaces.${row.surface}`) : row.surface),
    },
  ];
  const bases: DataTableColumn<Base>[] = [
    {
      id: "base",
      header: t("style"),
      cell: (row) => (
        <div>
          <p className="font-medium">{locale === "en" ? row.nameEn : row.nameTh}</p>
          <p className="text-muted text-xs tabular-nums">{row.baseCode}</p>
        </div>
      ),
    },
    { id: "calculations", header: t("calculations"), numeric: true, cell: (row) => format.number(row.calculations) },
  ];
  const rfqs: DataTableColumn<TypeCount>[] = [
    { id: "type", header: t("productType"), cell: (row) => types.labelOf(row.productTypeCode) },
    { id: "count", header: t("rfqs"), numeric: true, cell: (row) => format.number(row.count) },
  ];
  const structural: DataTableColumn<Structural>[] = [
    { id: "type", header: t("productType"), cell: (row) => types.labelOf(row.productTypeCode) },
    { id: "requests", header: t("requests"), numeric: true, cell: (row) => format.number(row.requests) },
    { id: "published", header: t("published"), numeric: true, cell: (row) => format.number(row.published) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <Field label={t("month")} className="w-44">
          <Input
            type="month"
            value={month}
            max={thisMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </Field>
        {data ? (
          <p className="text-muted text-sm">
            {t("totals", {
              searches: format.number(data.styleSearches),
              suppressed: format.number(data.suppressedZeroResultSearches),
              min: data.minGroupSize,
            })}
          </p>
        ) : null}
      </div>
      {query.isError ? <QueryError error={query.error} onRetry={() => void query.refetch()} /> : null}
      <Section title={t("zeroTitle")} description={t("zeroIntro")}>
        <DataTable
          caption={t("zeroTitle")}
          columns={keywords}
          rows={data?.zeroResultSearches ?? []}
          getRowId={(row) => `${row.surface}:${row.keyword}`}
          loading={query.isPending}
          empty={<EmptyState icon="search" title={t("zeroEmpty")} />}
        />
      </Section>
      <Section title={t("heldTitle")} description={t("heldIntro")}>
        <DataTable
          caption={t("heldTitle")}
          columns={bases}
          rows={data?.unpublishableStyles ?? []}
          getRowId={(row) => row.baseCode}
          loading={query.isPending}
          empty={<EmptyState icon="layers" title={t("heldEmpty")} />}
        />
      </Section>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t("rfqTitle")} description={t("rfqIntro")}>
          <DataTable
            caption={t("rfqTitle")}
            columns={rfqs}
            rows={data?.rfqsWithoutStyle ?? []}
            getRowId={(row) => row.productTypeCode}
            loading={query.isPending}
            empty={<EmptyState icon="inbox" title={t("rfqEmpty")} />}
          />
        </Section>
        <Section title={t("structuralTitle")} description={t("structuralIntro")}>
          <DataTable
            caption={t("structuralTitle")}
            columns={structural}
            rows={data?.structuralRequests ?? []}
            getRowId={(row) => row.productTypeCode}
            loading={query.isPending}
            empty={<EmptyState icon="ruler" title={t("structuralEmpty")} />}
          />
        </Section>
      </div>
    </div>
  );
}
