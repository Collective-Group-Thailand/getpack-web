"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Pagination } from "@/ui/components/Pagination";
import { Select } from "@/ui/components/Select";
import { Skeleton } from "@/ui/components/Skeleton";

import { ExportButton, QueryError } from "../console";

type Cell = string | number | null;
type ColumnType = "text" | "code" | "money" | "number" | "pct" | "date" | "datetime";

/**
 * One operational report (F2 2.8, B6.2): the period (or "as of" date), the report's own filter,
 * a typed table with the API's totals row, and the xlsx/csv export of exactly what is filtered.
 * Nothing is summed here — the totals are the API's.
 */
export function ReportView({ reportKey }: { reportKey: string }) {
  const t = useTranslations("reports");
  const tList = useTranslations("console.list");
  const format = useFormat();
  const [draft, setDraft] = useState({ from: "", to: "", asOf: "", filter: "", value: "" });
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const definitions = useQuery({
    queryKey: queryKeys.list("admin", "report", {}),
    queryFn: () => browserRequests().call("GET /v1/admin/reports"),
  });
  const definition = definitions.data?.find((report) => report.key === reportKey);
  const query = {
    ...(definition?.asOf ? (applied.asOf ? { asOf: applied.asOf } : {}) : {}),
    ...(!definition?.asOf && applied.from ? { from: applied.from } : {}),
    ...(!definition?.asOf && applied.to ? { to: applied.to } : {}),
    ...(applied.filter && applied.value ? { filter: applied.filter, value: applied.value } : {}),
    page,
    perPage,
  };
  const result = useQuery({
    queryKey: queryKeys.list("admin", "report", { key: reportKey, ...query }),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/reports/{reportKey}", { path: { reportKey }, query: query as never }),
    enabled: Boolean(definition),
  });

  const cell = (type: ColumnType, value: Cell) => {
    if (value === null || value === "") return "–";
    switch (type) {
      case "money":
        return format.thb(String(value));
      case "number":
        return format.number(Number(value));
      case "pct":
        return format.percent(String(value));
      case "date":
        return format.date(`${value}T00:00:00+07:00`);
      case "datetime":
        return format.dateTime(String(value));
      case "code":
        return <span className="font-mono">{value}</span>;
      default:
        return String(value);
    }
  };
  const column = (key: string) => (t.has(`columns.${key}`) ? t(`columns.${key}`) : key);
  const exportQuery = Object.fromEntries(Object.entries(query).map(([name, value]) => [name, String(value)]));
  const data = result.data;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/reports" }, { label: t(`names.${reportKey}`) }]}
          />
        }
        title={t(`names.${reportKey}`)}
        description={t(`notes.${reportKey}`)}
        actions={definition ? <ExportButton resource={`report:${reportKey}`} query={exportQuery} /> : null}
      />
      {definitions.isError ? <QueryError error={definitions.error} onRetry={() => void definitions.refetch()} /> : null}
      {definitions.data && !definition ? <EmptyState icon="lock" title={t("unavailable")} /> : null}

      {definition ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setApplied(draft);
          }}
        >
          {definition.asOf ? (
            <Field label={t("asOf")} hint={t("asOfHint")}>
              <Input
                type="date"
                value={draft.asOf}
                onChange={(event) => setDraft({ ...draft, asOf: event.target.value })}
              />
            </Field>
          ) : (
            <>
              <Field label={t("from")}>
                <Input
                  type="date"
                  value={draft.from}
                  onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                />
              </Field>
              <Field label={t("to")}>
                <Input
                  type="date"
                  value={draft.to}
                  onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                />
              </Field>
            </>
          )}
          {definition.filters.map((filter) => (
            <Field key={filter.key} label={column(filter.key)}>
              <Select
                value={draft.filter === filter.key && draft.value ? draft.value : "all"}
                onValueChange={(value) =>
                  setDraft({ ...draft, filter: value === "all" ? "" : filter.key, value: value === "all" ? "" : value })
                }
                options={[{ value: "all", label: t("all") }, ...filter.options]}
              />
            </Field>
          ))}
          <Button type="submit" iconStart="filter">
            {t("run")}
          </Button>
        </form>
      ) : null}

      {result.isError ? <QueryError error={result.error} onRetry={() => void result.refetch()} /> : null}
      {definition && !data && !result.isError ? <Skeleton className="h-64 w-full" /> : null}
      {data ? (
        <div className="bg-surface overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">{t(`names.${reportKey}`)}</caption>
            <thead className="bg-surface-subtle">
              <tr className="text-muted text-left text-xs">
                {data.columns.map((item) => (
                  <th
                    key={item.key}
                    scope="col"
                    className={`px-3 py-2 font-medium ${["money", "number", "pct"].includes(item.type) ? "text-right" : ""}`}
                  >
                    {column(item.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={data.columns.length} className="text-muted px-3 py-6 text-center">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                data.rows.map((row, at) => (
                  <tr key={at}>
                    {data.columns.map((item) => (
                      <td
                        key={item.key}
                        className={`px-3 py-2 ${["money", "number", "pct"].includes(item.type) ? "text-right tabular-nums" : ""}`}
                      >
                        {cell(item.type, row[item.key] ?? null)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {data.totals ? (
              <tfoot className="bg-surface-subtle font-semibold">
                <tr>
                  {data.columns.map((item, at) => (
                    <td
                      key={item.key}
                      className={`px-3 py-2 ${["money", "number", "pct"].includes(item.type) ? "text-right tabular-nums" : ""}`}
                    >
                      {at === 0 ? t("total") : item.total ? cell(item.type, data.totals![item.key] ?? null) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
      {data && data.meta.total > data.meta.perPage ? (
        <Pagination
          page={data.meta.page}
          perPage={perPage}
          total={data.meta.total}
          onPageChange={setPage}
          onPerPageChange={(size) => {
            setPerPage(size);
            setPage(1);
          }}
          pageSizes={[50, 100, 200]}
          labels={{
            nav: tList("pagination"),
            previous: tList("previous"),
            next: tList("next"),
            range: (from, to, total) =>
              tList("range", { from: format.number(from), to: format.number(to), total: format.number(total) }),
            pageOf: (current, pages) => tList("pageOf", { page: format.number(current), pages: format.number(pages) }),
            perPage: tList("perPage"),
          }}
        />
      ) : null}
      {data ? <p className="text-muted text-xs">{t("generated", { at: format.dateTime(data.generatedAt) })}</p> : null}
    </div>
  );
}
