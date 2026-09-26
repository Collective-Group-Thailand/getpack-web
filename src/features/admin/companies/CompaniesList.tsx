"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { COMPANY_STATUS, CREDIT_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { COMPANY_STATUSES, CREDIT_STATUSES, companiesList, type CompanySummary } from "./resources";

/**
 * B2B companies (F2 2.7, D-120…D-125): by account status, with the credit standing and what is
 * owed. A company blocked for being overdue (D-122) is flagged in the row.
 */
export function CompaniesList({ initial }: { initial: InitialPage<CompanySummary> | null }) {
  const t = useTranslations("companies.list");
  const tStatus = useTranslations("status");
  const format = useFormat();

  const columns: DataTableColumn<CompanySummary>[] = [
    {
      id: "legalName",
      header: t("columns.company"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/companies/${row.id}`} className="text-primary font-medium hover:underline">
            {row.legalName}
          </Link>
          <p className="text-muted font-mono text-xs">
            {row.companyCode} · {row.taxId}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={COMPANY_STATUS} value={row.status} />,
    },
    {
      id: "creditStatus",
      header: t("columns.credit"),
      cell: (row) => <StatusChip map={CREDIT_STATUS} value={row.creditStatus} />,
    },
    {
      id: "open",
      header: t("columns.open"),
      numeric: true,
      cell: (row) => format.thb(row.receivables.openAmount),
    },
    {
      id: "overdue",
      header: t("columns.overdue"),
      numeric: true,
      cell: (row) =>
        Number(row.receivables.overdueAmount) > 0 ? (
          <span className="text-danger">
            {format.thb(row.receivables.overdueAmount)}
            <span className="block text-xs">{t("days", { days: row.receivables.oldestOverdueDays })}</span>
          </span>
        ) : (
          <span className="text-muted">–</span>
        ),
    },
    { id: "members", header: t("columns.members"), numeric: true, cell: (row) => row.membersCount },
    {
      id: "paidOrders",
      header: t("columns.paidOrders"),
      numeric: true,
      hideable: true,
      cell: (row) => row.paidOrdersCount,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...COMPANY_STATUSES.map((status) => ({
            value: status,
            label: tStatus(COMPANY_STATUS[status].labelKey),
            ...(status === "kyc_review" ? { countKey: "companies.kyc_review" } : {}),
          })),
        ]}
      />
      <ResourceList
        resource={companiesList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        rowTone={(row) => (row.receivables.creditOrdersBlocked ? "danger" : undefined)}
        filters={[
          {
            id: "creditStatus",
            label: t("columns.credit"),
            kind: "select",
            options: CREDIT_STATUSES.map((value) => ({ value, label: tStatus(CREDIT_STATUS[value].labelKey) })),
          },
        ]}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
