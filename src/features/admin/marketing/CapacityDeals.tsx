"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import type { CapacityDealRef, CapacityDealRow } from "@/lib/api/requests/admin-loyalty-p3";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { DataTable } from "@/ui/components/DataTable";
import { DeskSection } from "@/ui/components/DeskPage";
import { EmptyState } from "@/ui/components/EmptyState";

import { adminBrowserApis, QueryError, useProductTypes } from "../console";

type ApprovalStatus = NonNullable<CapacityDealRow["approval"]>["status"];
const APPROVAL_TONE: Record<ApprovalStatus, "neutral" | "success" | "danger" | "info"> = {
  pending: "info",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

/** The approval of a capacity deal as a chip; "ไม่มีคำขอ" when none is open. */
function ApprovalChip({ approval }: { approval: CapacityDealRow["approval"] }) {
  const t = useTranslations("marketing.capacityDeals");
  if (!approval) return <span className="text-muted text-sm">{t("approval.none")}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge size="sm" tone={APPROVAL_TONE[approval.status]}>
        {t(`approval.${approval.status}`)}
      </Badge>
      {approval.status === "pending" ? (
        <Link href={`/approvals/${approval.id}`} className="text-primary text-sm hover:underline">
          {t("approval.open")}
        </Link>
      ) : null}
    </span>
  );
}

/**
 * Capacity deals (loyalty P3, D-502; `admin.capacityDeals.list`): the drafts the worker made where a product type has
 * room next week — product type, week, its free share, the discount, whether it shows and its
 * `capacity_deal_publish` approval (decided in the approvals inbox; the drafter cannot approve). The free share is the
 * product type's as a whole; nothing here names or counts a production site.
 */
export function CapacityDealList() {
  const t = useTranslations("marketing.capacityDeals");
  const format = useFormat();
  const deals = useQuery({
    queryKey: queryKeys.list("admin", "capacity_deal", {}),
    queryFn: () => adminBrowserApis().requests.call("GET /v1/admin/promotions/capacity-deals"),
  });
  if (deals.isError) return <QueryError error={deals.error} onRetry={() => void deals.refetch()} />;

  return (
    <DeskSection title={t("title")} description={t("description")}>
      <DataTable<CapacityDealRow>
        caption={t("title")}
        rows={deals.data?.items ?? []}
        loading={deals.isPending}
        getRowId={(row) => row.promotionId}
        empty={<EmptyState icon="calendar" title={t("empty")} description={t("emptyBody")} />}
        columns={[
          {
            id: "type",
            header: t("columns.type"),
            cell: (row) => (
              <Link
                href={`/marketing/promotions/${row.promotionId}`}
                className="text-primary font-medium hover:underline"
              >
                {row.productTypeName}
              </Link>
            ),
          },
          {
            id: "week",
            header: t("columns.week"),
            cell: (row) => <span className="tabular-nums">{t("week", { date: format.date(row.weekStart) })}</span>,
          },
          {
            id: "free",
            header: t("columns.free"),
            numeric: true,
            cell: (row) => format.percent(row.freePct, 1),
          },
          {
            id: "discount",
            header: t("columns.discount"),
            numeric: true,
            cell: (row) => format.percent(row.discountPct),
          },
          {
            id: "visibility",
            header: t("columns.visibility"),
            cell: (row) => (
              <Badge size="sm" tone={row.visibility === "hidden" ? "neutral" : "success"}>
                {t(`visibility.${row.visibility}`)}
              </Badge>
            ),
          },
          { id: "approval", header: t("columns.approval"), cell: (row) => <ApprovalChip approval={row.approval} /> },
        ]}
      />
    </DeskSection>
  );
}

/**
 * The capacity deal's note in the promotion editor: what it is (product type, week, free share), that its benefit and
 * conditions are the worker's (read-only) and only the display is edited — an edit withdraws the open approval and
 * opens a new one — and where the approval stands.
 */
export function CapacityDealNote({ deal }: { deal: CapacityDealRef }) {
  const t = useTranslations("marketing.capacityDeals");
  const format = useFormat();
  const productTypes = useProductTypes();
  return (
    <Callout
      tone="info"
      title={t("note.title", {
        type: productTypes.labelOf(deal.productTypeCode),
        date: format.date(deal.weekStart),
        free: format.percent(deal.freePct, 1),
      })}
    >
      <p>{t("note.body")}</p>
      <div className="mt-2">
        <ApprovalChip approval={deal.approval} />
      </div>
    </Callout>
  );
}
