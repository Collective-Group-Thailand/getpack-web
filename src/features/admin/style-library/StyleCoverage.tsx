"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Meter } from "@/ui/components/Meter";

import { adminBrowserApis, QueryError, Section } from "../console";

type Category = Schemas["CategoryCoverageDto"];
type Process = Schemas["ProcessCoverageDto"];

/**
 * How ready the library is (D-243, D-411): per category, how many variants are shown and how many
 * a factory can make, with the reasons the rest are held back; per process, how many variants
 * need it and how many verified factories run it — a process no factory runs is what keeps a
 * style on quotation.
 */
export function StyleCoverage() {
  const t = useTranslations("styleLibrary.coverage");
  const tStyles = useTranslations("styles");
  const tReasons = useTranslations("styleLibrary.reasons");
  const locale = useLocale();
  const format = useFormat();
  const query = useQuery({
    queryKey: queryKeys.list("admin", "style_coverage", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/style-coverage")).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  const categories: DataTableColumn<Category>[] = [
    {
      id: "category",
      header: t("category"),
      cell: (row) => (tStyles.has(`categories.${row.category}`) ? tStyles(`categories.${row.category}`) : row.category),
    },
    { id: "bases", header: t("bases"), numeric: true, cell: (row) => format.number(row.bases) },
    {
      id: "shown",
      header: t("shown"),
      cell: (row) => (
        <div className="flex min-w-44 items-center gap-2">
          <Meter
            value={row.variants ? Math.round((row.publishable / row.variants) * 100) : 0}
            label={t("shown")}
            valueText={t("shownOf", { shown: row.publishable, total: row.variants })}
            tone={row.publishable === row.variants ? "success" : "primary"}
            className="flex-1"
          />
          <span className="text-sm tabular-nums">
            {t("shownOf", { shown: format.number(row.publishable), total: format.number(row.variants) })}
          </span>
        </div>
      ),
    },
    {
      id: "makeable",
      header: t("makeable"),
      numeric: true,
      cell: (row) => (
        <span className={row.notMakeable ? "text-danger" : undefined}>
          {t("makeableOf", { makeable: format.number(row.makeable), total: format.number(row.variants) })}
        </span>
      ),
    },
    {
      id: "reasons",
      header: t("reasons"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.reasons.map((r) => (
            <Badge key={r.reason} size="sm" tone="warning">
              {tReasons(`${r.reason}.label`)} {format.number(r.count)}
            </Badge>
          ))}
        </span>
      ),
    },
  ];

  const processes: DataTableColumn<Process>[] = [
    {
      id: "process",
      header: t("process"),
      cell: (row) => (
        <div>
          <p className="font-medium">{locale === "en" ? row.nameEn : row.nameTh}</p>
          <p className="text-muted text-xs tabular-nums">{row.code}</p>
        </div>
      ),
    },
    { id: "needing", header: t("variantsNeeding"), numeric: true, cell: (row) => format.number(row.variantsNeeding) },
    {
      id: "factories",
      header: t("factories"),
      numeric: true,
      cell: (row) =>
        row.factories === 0 ? (
          <Badge tone="danger" size="sm">
            {t("noFactory")}
          </Badge>
        ) : (
          format.number(row.factories)
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {data ? (
        <p className="text-muted text-sm">
          {t("generated")} <When at={data.generatedAt} />
        </p>
      ) : null}
      <Section title={t("categoriesTitle")} description={t("categoriesIntro")}>
        <DataTable
          caption={t("categoriesTitle")}
          columns={categories}
          rows={data?.categories ?? []}
          getRowId={(row) => row.category}
          loading={query.isPending}
          empty={<EmptyState icon="layers" title={t("empty")} />}
        />
      </Section>
      <Section title={t("processesTitle")} description={t("processesIntro")}>
        <DataTable
          caption={t("processesTitle")}
          columns={processes}
          rows={[...(data?.processes ?? [])].sort(
            // What holds styles back first: needed by variants, run by no factory.
            (a, b) =>
              Number(b.factories === 0 && b.variantsNeeding > 0) - Number(a.factories === 0 && a.variantsNeeding > 0) ||
              b.variantsNeeding - a.variantsNeeding,
          )}
          getRowId={(row) => row.code}
          loading={query.isPending}
          rowTone={(row) => (row.factories === 0 && row.variantsNeeding > 0 ? "danger" : undefined)}
          empty={<EmptyState icon="factory" title={t("empty")} />}
        />
      </Section>
    </div>
  );
}
