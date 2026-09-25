"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat, When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { ResourceList, type InitialPage } from "../console";
import { customersList, type CustomerSummary } from "./resources";

/** Customers (F2 2.7): who they are, how they came, how much they have ordered. */
export function CustomersList({ initial }: { initial: InitialPage<CustomerSummary> | null }) {
  const t = useTranslations("customers.list");
  const format = useFormat();

  const columns: DataTableColumn<CustomerSummary>[] = [
    {
      id: "displayName",
      header: t("columns.customer"),
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/customers/${row.id}`} className="text-primary font-medium hover:underline">
            {row.displayName}
          </Link>
          <p className="text-muted font-mono text-xs">{row.customerCode}</p>
        </div>
      ),
    },
    { id: "customerType", header: t("columns.type"), cell: (row) => t(`types.${row.customerType}`) },
    {
      id: "company",
      header: t("columns.company"),
      cell: (row) => row.companyName ?? <span className="text-muted">–</span>,
    },
    {
      id: "contact",
      header: t("columns.contact"),
      cell: (row) => (
        <div className="text-sm">
          <p>{row.phone ?? "–"}</p>
          <p className="text-muted text-xs">{row.email ?? ""}</p>
        </div>
      ),
    },
    { id: "ordersCount", header: t("columns.orders"), numeric: true, cell: (row) => format.number(row.ordersCount) },
    {
      id: "createdVia",
      header: t("columns.via"),
      hideable: true,
      cell: (row) => <Badge size="sm">{t(`channels.${row.createdVia}`)}</Badge>,
    },
    { id: "createdAt", header: t("columns.since"), sortable: true, cell: (row) => <When at={row.createdAt} /> },
  ];

  return (
    <ResourceList
      resource={customersList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      filters={[
        {
          id: "customerType",
          label: t("columns.type"),
          kind: "select",
          options: (["individual", "juristic", "government"] as const).map((value) => ({
            value,
            label: t(`types.${value}`),
          })),
        },
        {
          id: "createdVia",
          label: t("columns.via"),
          kind: "select",
          options: (["self", "cs", "line_liff"] as const).map((value) => ({ value, label: t(`channels.${value}`) })),
        },
      ]}
      empty={{ title: t("empty") }}
    />
  );
}
