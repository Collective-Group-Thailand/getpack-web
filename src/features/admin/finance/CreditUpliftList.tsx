"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import type { CreditUpliftRow } from "@/features/shared/loyalty-p3/types";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { DataTable } from "@/ui/components/DataTable";
import { DeskSection } from "@/ui/components/DeskPage";
import { EmptyState } from "@/ui/components/EmptyState";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { adminBrowserApis, QueryError, useCan } from "../console";

type Filter = "all" | "capped";

/**
 * `/finance/credit-uplifts` (loyalty P3, D-485 / D-501; `admin.creditUplifts.list`): every limit the nightly
 * `b2b.credit_tier_uplift` job wrote — the company, the tier of its own 12-month spend, base → new (with the limit it
 * replaced), the factor, and, where the target is above the automatic cap, what is left to request. "ขออนุมัติวงเงินเต็ม"
 * opens the company's credit tab with the request prefilled (it follows the `credit_limit` approval as any request);
 * the mode (อัตโนมัติ · หยุดไว้ · ปิด) is set there too, with a reason. Figures are the API's.
 */
export function CreditUpliftList() {
  const t = useTranslations("finance.creditUplifts");
  const format = useFormat();
  const canManage = useCan("company_credit.manage");
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useQuery({
    queryKey: queryKeys.list("admin", "credit_uplift", { filter }),
    queryFn: async () => {
      const { data } = await adminBrowserApis().contract.GET("/v1/admin/credit-uplifts", {
        params: { query: { perPage: 100, ...(filter === "capped" ? { aboveCap: true } : {}) } },
      });
      return data!.data;
    },
  });
  if (rows.isError) return <QueryError error={rows.error} onRetry={() => void rows.refetch()} />;

  return (
    <DeskSection
      title={t("listTitle")}
      description={t("listNote")}
      actions={
        <SegmentedControl<Filter>
          label={t("filterLabel")}
          size="sm"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: t("filters.all") },
            { value: "capped", label: t("filters.capped") },
          ]}
        />
      }
    >
      <DataTable<CreditUpliftRow>
        caption={t("listTitle")}
        rows={rows.data ?? []}
        loading={rows.isPending}
        getRowId={(row) => row.versionId}
        empty={<EmptyState icon="trend-up" title={t("empty")} description={t("emptyBody")} />}
        columns={[
          {
            id: "company",
            header: t("columns.company"),
            cell: (row) => (
              <Link
                href={`/companies/${row.company.id}?tab=credit`}
                className="text-primary font-medium hover:underline"
              >
                {row.company.legalName}
              </Link>
            ),
          },
          {
            id: "tier",
            header: t("columns.tier"),
            cell: (row) => (
              <div>
                <p>{row.companyTier ? t(`tiers.${row.companyTier}`) : "—"}</p>
                {row.companySpend12m ? (
                  <p className="text-muted text-xs tabular-nums">
                    {t("spend", { amount: format.thb(row.companySpend12m) })}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            id: "base",
            header: t("columns.base"),
            numeric: true,
            cell: (row) => (
              <div>
                <p className="tabular-nums">{format.thb(row.baseLimit)}</p>
                <p className="text-muted text-xs tabular-nums">×{row.factor}</p>
              </div>
            ),
          },
          {
            id: "newLimit",
            header: t("columns.newLimit"),
            numeric: true,
            cell: (row) => (
              <div>
                <p className="font-semibold tabular-nums">{format.thb(row.newLimit)}</p>
                {row.previousLimit ? (
                  <p className="text-muted text-xs tabular-nums">
                    {t("previous", { amount: format.thb(row.previousLimit) })}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            id: "cap",
            header: t("columns.cap"),
            cell: (row) =>
              row.capped && row.aboveCapTarget ? (
                <div>
                  <Badge size="sm" tone="warning">
                    {t("capped")}
                  </Badge>
                  <p className="text-muted mt-0.5 text-xs tabular-nums">
                    {t("target", { amount: format.thb(row.aboveCapTarget) })}
                  </p>
                </div>
              ) : (
                <span className="text-muted text-sm">{t("notCapped")}</span>
              ),
          },
          { id: "effective", header: t("columns.effective"), cell: (row) => format.date(row.effectiveFrom) },
          {
            id: "mode",
            header: t("columns.mode"),
            cell: (row) => (
              <Badge size="sm" tone={row.mode === "auto" ? "neutral" : "info"}>
                {t(`modes.${row.mode}`)}
              </Badge>
            ),
          },
          {
            id: "actions",
            header: <span className="sr-only">{t("columns.actions")}</span>,
            cell: (row) =>
              row.pendingRequest ? (
                <Link
                  href={`/approvals/${row.pendingRequest.approvalId}`}
                  className="text-primary text-sm hover:underline"
                >
                  {t("pending", { amount: format.thb(row.pendingRequest.limitAmount) })}
                </Link>
              ) : row.capped && canManage ? (
                <Link
                  href={`/companies/${row.company.id}?tab=credit&uplift=request`}
                  className="text-primary text-sm font-medium whitespace-nowrap hover:underline"
                >
                  {t("requestFull")}
                </Link>
              ) : null,
          },
        ]}
      />
    </DeskSection>
  );
}
