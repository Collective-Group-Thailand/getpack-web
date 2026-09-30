"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { COMPANY_STATUS, CREDIT_STATUS } from "@/domain/status";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { COMPANY_STATUSES, companiesList, type Company } from "./resources";

/**
 * B2B companies (F2 2.7, D-120…D-125): by account status, with the credit standing. A company
 * blocked for being overdue (D-122, `creditStatus: blocked_overdue`) is flagged in the row.
 *
 * CONTRACT-GAP admin.companies — the published list carries no receivables per row (open,
 * overdue, oldest overdue days) and cannot be filtered by credit status, so neither is shown.
 */
export function CompaniesList({ initial }: { initial: InitialPage<Company> | null }) {
  const t = useTranslations("companies.list");
  const tStatus = useTranslations("status");

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
      id: "members",
      header: t("columns.members"),
      numeric: true,
      // CONTRACT-GAP admin.companies: no membersCount — the members arrive inline and are counted here.
      cell: (row) => row.members.filter((member) => member.status !== "removed").length,
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
        rowTone={(row) => (row.creditStatus === "blocked_overdue" ? "danger" : undefined)}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
