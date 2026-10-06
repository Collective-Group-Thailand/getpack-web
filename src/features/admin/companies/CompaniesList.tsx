"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { COMPANY_STATUS, CREDIT_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { COMPANY_STATUSES, companiesList, CREDIT_STATUSES, type Company } from "./resources";

/**
 * B2B companies (F2 2.7, D-120…D-125): by account status, filtered by credit standing, with each
 * company's receivables — open, overdue and the oldest overdue day (D-122) — on the row (v0.5.0).
 * A company blocked for being overdue (`creditStatus: blocked_overdue`) is flagged in the row.
 */
export function CompaniesList({ initial }: { initial: InitialPage<Company> | null }) {
  const t = useTranslations("companies.list");
  const tStatus = useTranslations("status");
  const format = useFormat();

  const columns: DataTableColumn<Company>[] = [
    {
      id: "legalName",
      header: t("columns.company"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/companies/${row.id}`} className="text-primary font-medium hover:underline">
            {row.legalName}
          </Link>
          <p className="text-muted font-mono text-xs">
            {row.companyCode ?? t("noCode")} · {row.taxId}
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
      id: "receivables",
      header: t("columns.receivables"),
      numeric: true,
      cell: (row) => (
        <div>
          <p className="tabular-nums">{format.thb(row.receivables.openAmount)}</p>
          {row.receivables.overdueAmount !== "0.00" ? (
            <p className="text-danger text-xs tabular-nums">
              {t("overdue", {
                amount: format.thb(row.receivables.overdueAmount),
                days: row.receivables.oldestOverdueDays ?? 0,
              })}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "members",
      header: t("columns.members"),
      numeric: true,
      hideable: true,
      cell: (row) => format.number(row.membersCount),
    },
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
        hideEmpty
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
        exportResource="companies"
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        filters={[
          {
            id: "creditStatus",
            label: t("columns.credit"),
            kind: "select",
            options: CREDIT_STATUSES.map((value) => ({ value, label: tStatus(CREDIT_STATUS[value].labelKey) })),
          },
        ]}
        rowTone={(row) => (row.creditStatus === "blocked_overdue" ? "danger" : undefined)}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
