"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { CLAIM_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { CLAIM_STATUSES, claimsList, type Claim } from "./resources";

/**
 * Claims (F2 2.8, D-082, D-083): by status, with the liability the rule gave and whether the claim
 * came from the customer or from a tolerance breach (D-080). The published row names no customer
 * and no SLA, and the list does not filter by type or origin (CONTRACT-GAP admin.claims).
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
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
