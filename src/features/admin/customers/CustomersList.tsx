"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { ResourceList, type InitialPage } from "../console";
import { customersList, type Customer } from "./resources";

/**
 * Customers (F2 2.7): who they are and how they came. The published row carries no company or
 * order count, and the list has no type or channel filter (CONTRACT-GAP admin.customers).
 */
export function CustomersList({ initial }: { initial: InitialPage<Customer> | null }) {
  const t = useTranslations("customers.list");

  const columns: DataTableColumn<Customer>[] = [
    {
      id: "displayName",
      header: t("columns.customer"),
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/customers/${row.id}`} className="text-primary font-medium hover:underline">
            {row.displayName}
          </Link>
          {row.customerCode ? <p className="text-muted font-mono text-xs">{row.customerCode}</p> : null}
        </div>
      ),
    },
    { id: "customerType", header: t("columns.type"), cell: (row) => t(`types.${row.customerType}`) },
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
      empty={{ title: t("empty") }}
    />
  );
}
