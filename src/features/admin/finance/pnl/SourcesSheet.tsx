"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Sheet } from "@/ui/components/Sheet";
import { Skeleton } from "@/ui/components/Skeleton";

import { adminBrowserApis, QueryError } from "../../console";
import { usePnlFormat } from "./format";
import { pnlKeys, type PnlCell, type PnlLine, type PnlSourceItem, type PnlSourceKind } from "./resources";

const PER_PAGE = 25;

/** The kinds a cell's records can be listed as; the first is the API's default for its source. */
function kindsOf(line: PnlLine, cell: PnlCell): (PnlSourceKind | null)[] {
  if (cell.source === "pipeline_run_rate") return [null, "customer_run_rate"];
  if ((line.key === "agent_commission" || line.key === "employee_commission") && cell.source === "gl")
    return [null, "commission"];
  return [null];
}
/** The kind a default list (no `kind` parameter) holds, for its tab label. */
function defaultKind(cell: PnlCell): PnlSourceKind {
  if (cell.source === "pipeline_run_rate" || cell.source === "commission_rates") return "lead";
  if (cell.source === "fixed_assets") return "fixed_asset";
  return "gl_line";
}

/** Where a record lives in the back office, when it has a page. */
function hrefOf(item: PnlSourceItem): string | null {
  if (item.kind === "gl_line" && item.id) return `/finance/ledger/journals/${item.id}`;
  if (item.kind === "lead" && item.id) return `/sales/leads/${item.id}`;
  if (item.kind === "customer_run_rate" && item.id) return `/companies/${item.id}`;
  if (item.kind === "fixed_asset" && item.code) return `/finance/assets?q=${encodeURIComponent(item.code)}`;
  if (item.kind === "commission" && item.code) return `/agents/commissions?q=${encodeURIComponent(item.code)}`;
  return null;
}

/**
 * The drill-down of a P&L cell (D-472 `admin.pnl.listCellSources`): the records behind the number — journal lines of
 * the month (or of the trailing window behind a forecast ratio), the open deals of a pipeline forecast (stage only, no
 * contact data), the fixed assets behind depreciation, commission records, repeat customers by company. Each links to
 * its record where the back office has a page; the list pages 25 at a time.
 */
export function SourcesSheet({
  planId,
  line,
  cell,
  onClose,
}: {
  planId: string;
  line: PnlLine;
  cell: PnlCell;
  onClose: () => void;
}) {
  const t = useTranslations("finance.pnl.sources");
  const format = usePnlFormat();
  const kinds = kindsOf(line, cell);
  const [kind, setKind] = useState<PnlSourceKind | null>(null);

  const list = useInfiniteQuery({
    queryKey: pnlKeys.sources(planId, line.key, cell.month, kind),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/finance/pnl/plans/{planId}/cells/{lineKey}/{month}/sources", {
          params: {
            path: { planId, lineKey: line.key, month: cell.month },
            query: { page: pageParam, perPage: PER_PAGE, ...(kind ? { kind } : {}) },
          },
        })
      ).data!,
    getNextPageParam: (last) => (last.meta.page * last.meta.perPage < last.meta.total ? last.meta.page + 1 : undefined),
  });
  const items = list.data?.pages.flatMap((page) => page.data) ?? [];
  const total = list.data?.pages[0]?.meta.total ?? 0;

  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title")}
      description={t("description", { line: format.label(line), month: format.month(cell.month) })}
      closeLabel={t("close")}
      className="w-[min(30rem,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-4" data-testid="pnl-sources">
        {kinds.length > 1 ? (
          <SegmentedControl
            label={t("tabs")}
            size="sm"
            value={kind ?? "default"}
            onValueChange={(value) => setKind(value === "default" ? null : (value as PnlSourceKind))}
            options={kinds.map((value) => ({
              value: value ?? "default",
              label: t(`kinds.${value ?? defaultKind(cell)}`),
            }))}
          />
        ) : null}
        {list.isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, at) => (
              <Skeleton key={at} className="h-14 w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <QueryError error={list.error} onRetry={() => void list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="list-bullet"
            title={t("empty")}
            action={
              <Button variant="secondary" onClick={onClose}>
                {t("close")}
              </Button>
            }
          />
        ) : (
          <>
            <p className="text-muted text-sm">{t("count", { count: total })}</p>
            <ul className="divide-border border-border rounded-card divide-y border">
              {items.map((item, at) => {
                const href = hrefOf(item);
                const name =
                  item.code ??
                  (item.kind === "customer_run_rate" && item.id
                    ? t("companyRef", { id: item.id.slice(-6) })
                    : t(`kinds.${item.kind}`));
                return (
                  <li
                    key={`${item.id ?? item.code ?? "row"}-${at}`}
                    className="flex flex-col gap-0.5 px-3 py-2.5 text-sm"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      {href ? (
                        <Link
                          href={href}
                          className="text-primary focus-visible:ring-focus-ring rounded-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-2"
                          aria-label={t("open", { code: name })}
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="font-medium">{name}</span>
                      )}
                      <span className="font-medium tabular-nums">{format.thb(item.amount)}</span>
                    </span>
                    {item.description ? <span className="text-fg">{item.description}</span> : null}
                    <span className="text-muted flex flex-wrap gap-x-2 text-xs tabular-nums">
                      {item.date ? <span>{format.date(item.date)}</span> : null}
                      {item.accountCode ? <span>{t("accountCode", { code: item.accountCode })}</span> : null}
                      {item.orderCode ? <span>{item.orderCode}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            {list.hasNextPage ? (
              <Button
                variant="secondary"
                onClick={() => void list.fetchNextPage()}
                loading={list.isFetchingNextPage}
                className="self-center"
              >
                {t("more")}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </Sheet>
  );
}
