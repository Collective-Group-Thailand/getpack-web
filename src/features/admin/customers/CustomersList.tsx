"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat, When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { ResourceList, type InitialPage } from "../console";
import { customersList, type Customer } from "./resources";

const TYPES = ["individual", "juristic", "government"] as const;
const CHANNELS = ["self", "cs", "line_liff"] as const;

/**
 * Customers (F2 2.7): who they are, how they came, and how much they order — the row's company,
 * order count, last order and referral code, and the type and channel filters (v0.5.0).
 */
export function CustomersList({ initial }: { initial: InitialPage<Customer> | null }) {
  const t = useTranslations("customers.list");
  const format = useFormat();

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
          {row.companyName ? <p className="text-muted truncate text-xs">{row.companyName}</p> : null}
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
    {
      id: "ordersCount",
      header: t("columns.orders"),
      numeric: true,
      cell: (row) => (
        <div>
          <p className="tabular-nums">{format.number(row.ordersCount)}</p>
          {row.lastOrderAt ? (
            <p className="text-muted text-xs">
              <When at={row.lastOrderAt} />
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "referralCode",
      header: t("columns.referralCode"),
      hideable: true,
      cell: (row) => <span className="font-mono text-sm">{row.referralCode ?? "–"}</span>,
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
          options: TYPES.map((value) => ({ value, label: t(`types.${value}`) })),
        },
        {
          id: "createdVia",
          label: t("columns.via"),
          kind: "select",
          options: CHANNELS.map((value) => ({ value, label: t(`channels.${value}`) })),
        },
      ]}
      empty={{ title: t("empty") }}
    />
  );
}
