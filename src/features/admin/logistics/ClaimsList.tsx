"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { CLAIM_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { CLAIM_ORIGINS, CLAIM_STATUSES, CLAIM_TYPES, claimsList, type Claim } from "./resources";

/**
 * Claims (F2 2.8, D-082, D-083): by status, type and origin, with the customer, the liability the rule
 * gave and whether the claim came from the customer or from a tolerance breach (D-080). A customer's
 * or factory's claims open from their pages (`?customerId`, `?factoryId`). The published row has no
 * SLA (CONTRACT-GAP admin.claims — `slaDueAt` is U2.5).
 */
export function ClaimsList({ initial }: { initial: InitialPage<Claim> | null }) {
  const t = useTranslations("logistics.claims");
  const tStatus = useTranslations("status");
  const format = useFormat();

  const columns: DataTableColumn<Claim>[] = [
    {
      id: "claimNo",
      header: t("columns.claim"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/claims/${row.id}`} className="text-primary font-mono hover:underline">
            {row.claimNo}
          </Link>
          <p className="text-muted text-xs">
            {row.orderCode}
            {row.factoryCode ? ` · ${row.factoryCode}` : null}
          </p>
        </div>
      ),
    },
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (row) => (
        <div className="min-w-0 text-sm">
          {row.customer.displayName}
          {row.customer.companyName ? <p className="text-muted text-xs">{row.customer.companyName}</p> : null}
        </div>
      ),
    },
    {
      id: "type",
      header: t("columns.type"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1 text-sm">
          {t(`types.${row.type}`)}
          {row.origin !== "customer" ? (
            <Badge size="sm" tone="info">
              {t(`origins.${row.origin}`)}
            </Badge>
          ) : null}
        </div>
      ),
    },
    { id: "status", header: t("columns.status"), cell: (row) => <StatusChip map={CLAIM_STATUS} value={row.status} /> },
    { id: "liability", header: t("columns.liability"), cell: (row) => t(`liabilities.${row.liability}`) },
    {
      id: "requested",
      header: t("columns.requested"),
      cell: (row) => (
        <span className="text-sm">
          {t(`resolutions.${row.requestedResolution}`)}
          {row.claimedAmount ? <span className="text-muted block text-xs">{format.thb(row.claimedAmount)}</span> : null}
        </span>
      ),
    },
    { id: "windowEndsAt", header: t("columns.window"), cell: (row) => <When at={row.windowEndsAt} absoluteOnly /> },
    { id: "submittedAt", header: t("columns.submitted"), hideable: true, cell: (row) => <When at={row.submittedAt} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all"), countKey: "claims.open" },
          ...CLAIM_STATUSES.map((status) => ({ value: status, label: tStatus(CLAIM_STATUS[status].labelKey) })),
        ]}
      />
      <ResourceList
        resource={claimsList}
        exportResource="claims"
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        filters={[
          {
            id: "type",
            label: t("filters.type"),
            kind: "select",
            options: CLAIM_TYPES.map((value) => ({ value, label: t(`types.${value}`) })),
          },
          {
            id: "origin",
            label: t("filters.origin"),
            kind: "select",
            options: CLAIM_ORIGINS.map((value) => ({ value, label: t(`origins.${value}`) })),
          },
        ]}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
