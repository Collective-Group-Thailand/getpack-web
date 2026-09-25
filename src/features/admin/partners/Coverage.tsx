"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { FACTORY_STATUS } from "@/domain/status";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Icon } from "@/ui/icons";

import { QueryError, useProductTypes } from "../console";
import { adminBrowserApis } from "../console/api";

type CoverageRow = Schemas["ProductTypeCoverageDto"];
type CoverageFactory = Schemas["CoverageFactoryDto"];

/**
 * The coverage map (D-043, D-100): per product type, whether a customer can get an instant price
 * — the type quoted instantly and an active factory at tier A, or B within its envelope — or only
 * an RFQ, and every factory with a capability for it. The gaps are where recruiting a factory pays.
 */
export function Coverage() {
  const t = useTranslations("partners.coverage");
  const tStatus = useTranslations("status");
  const { labelOf } = useProductTypes();
  const coverage = useQuery({
    queryKey: queryKeys.list("admin", "coverage", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/partners/coverage")).data!,
  });
  if (coverage.isError) return <QueryError error={coverage.error} onRetry={() => void coverage.refetch()} />;
  const rows = coverage.data ?? [];

  // A factory that cannot take the work now says why in words, not by colour alone.
  const chip = (item: CoverageFactory) => {
    const tier = item.tier ?? "–";
    if (item.capabilityStatus !== "active")
      return t("chipInactive", { code: item.factoryCode, tier, status: t("capabilityInactive") });
    if (item.factoryStatus === "active") return t("chip", { code: item.factoryCode, tier });
    const status = FACTORY_STATUS[item.factoryStatus as keyof typeof FACTORY_STATUS];
    return t("chipInactive", {
      code: item.factoryCode,
      tier,
      status: status ? tStatus(status.labelKey) : item.factoryStatus,
    });
  };

  const columns: DataTableColumn<CoverageRow>[] = [
    {
      id: "type",
      header: t("productType"),
      cell: (row) => <span className="font-medium">{labelOf(row.productTypeCode)}</span>,
    },
    {
      id: "path",
      header: t("path"),
      cell: (row) =>
        row.instantPath === "instant_available" ? (
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
      cell: (row) => (
        <span
          className={
            row.instantPath === "instant_available" || row.instantPath === "type_rfq_only"
              ? "text-muted text-sm"
              : "text-warning-subtle-fg text-sm"
          }
        >
          {t(`reasons.${row.instantPath}`)}
        </span>
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
            {row.factories.map((item) => {
              const live = item.factoryStatus === "active" && item.capabilityStatus === "active";
              return (
                <li key={item.factoryId}>
                  <Link href={`/partners/${item.factoryId}?tab=terms`}>
                    <Badge
                      size="sm"
                      tone={live ? (item.tier === "A" || item.tier === "B" ? "primary" : "neutral") : "warning"}
                    >
                      {chip(item)}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        ),
    },
  ];

  return (
    <DataTable
      caption={t("title")}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.productTypeId}
      loading={coverage.isPending}
      rowTone={(row) => (row.factories.length === 0 ? "danger" : undefined)}
    />
  );
}
