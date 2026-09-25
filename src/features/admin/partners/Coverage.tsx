"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { z } from "zod";

import { queryKeys } from "@/lib/api/query-keys";
import type { coverageRow } from "@/lib/api/requests/admin-partners";
import { browserRequests } from "@/lib/api/requests/browser";
import { Badge } from "@/ui/components/Badge";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Icon } from "@/ui/icons";

import { QueryError } from "../console";

type CoverageRow = z.output<typeof coverageRow>;

/**
 * The coverage map (D-043, D-100): per product type, whether a customer can get an instant price
 * — a shipped calculator and at least one active factory at tier A, or B within its envelope — or
 * only an RFQ, and which factories cover it. The gaps are where recruiting a factory pays.
 */
export function Coverage() {
  const t = useTranslations("partners.coverage");
  const coverage = useQuery({
    queryKey: queryKeys.list("admin", "coverage", {}),
    queryFn: () => browserRequests().call("GET /v1/admin/catalog/coverage"),
  });
  if (coverage.isError) return <QueryError error={coverage.error} onRetry={() => void coverage.refetch()} />;
  const rows: CoverageRow[] = coverage.data?.data ?? [];

  const columns: DataTableColumn<CoverageRow>[] = [
    {
      id: "type",
      header: t("productType"),
      cell: (row) => <span className="font-medium">{row.productType.name}</span>,
    },
    {
      id: "path",
      header: t("path"),
      cell: (row) =>
        row.instantPath ? (
          <Badge tone="success" icon="check">
            {t("instant")}
          </Badge>
        ) : (
          <Badge tone="neutral" icon="chat">
            {t("rfqOnly")}
          </Badge>
        ),
    },
    {
      id: "why",
      header: t("why"),
      cell: (row) =>
        row.instantPath ? (
          <span className="text-muted text-sm">{t("reasons.instant")}</span>
        ) : row.quoteMode === "rfq" ? (
          <span className="text-muted text-sm">
            {row.calculatorKey ? t("reasons.notSwitched") : t("reasons.noCalculator")}
          </span>
        ) : (
          <span className="text-warning-subtle-fg text-sm">{t("reasons.noFactory")}</span>
        ),
    },
    {
      id: "factories",
      header: t("factories"),
      cell: (row) =>
        row.factories.length === 0 ? (
          <span className="text-danger inline-flex items-center gap-1 text-sm">
            <Icon name="warning" size={14} />
            {t("none")}
          </span>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {row.factories.map((item) => (
              <li key={item.factory.id}>
                <Link href={`/partners/${item.factory.id}?tab=terms`}>
                  <Badge
                    size="sm"
                    tone={item.factoryStatus === "active" ? (item.tier === "C" ? "neutral" : "primary") : "warning"}
                  >
                    {t("chip", { code: item.factory.code, tier: item.tier })}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        ),
    },
  ];

  return (
    <DataTable
      caption={t("title")}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.productType.id}
      loading={coverage.isPending}
      rowTone={(row) => (row.factories.length === 0 ? "danger" : undefined)}
    />
  );
}
