"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import type { CapacityDealRef, CapacityDealRow } from "@/features/shared/loyalty-p3/types";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable } from "@/ui/components/DataTable";
import { DeskSection } from "@/ui/components/DeskPage";
import { EmptyState } from "@/ui/components/EmptyState";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, useProductTypes } from "../console";

type ApprovalStatus = NonNullable<CapacityDealRow["approval"]>["status"];
const APPROVAL_TONE: Record<ApprovalStatus, "neutral" | "success" | "danger" | "info"> = {
  pending: "info",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
  expired: "neutral",
};

/** Whether Marketing may ask for publication: a draft with no request waiting or approved (D-502). */
export const canRequestPublish = (status: string, approval: CapacityDealRef["approval"]) =>
  status === "draft" && (approval === null || !["pending", "approved"].includes(approval.status));

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
 * `capacity_deal_publish` approval. A draft stays `draft` (it never applies at checkout) until Marketing asks for
 * publication (`request_publish`, in the editor's note) and another Marketing user approves it in the approvals inbox;
 * the approval activates it (API-CHANGES-P3 deviations 2–3). The free share is the
 * product type's as a whole; nothing here names or counts a production site.
 */
export function CapacityDealList() {
  const t = useTranslations("marketing.capacityDeals");
  const format = useFormat();
  const deals = useQuery({
    queryKey: queryKeys.list("admin", "capacity_deal", {}),
    queryFn: async () => {
      const { data } = await adminBrowserApis().contract.GET("/v1/admin/promotions/capacity-deals", {
        params: { query: { perPage: 100 } },
      });
      return data!.data;
    },
  });
  if (deals.isError) return <QueryError error={deals.error} onRetry={() => void deals.refetch()} />;

  return (
    <DeskSection title={t("title")} description={t("description")}>
      <DataTable<CapacityDealRow>
        caption={t("title")}
        rows={deals.data ?? []}
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
 * opens a new one — and where the approval stands. A draft with no open request offers "ขออนุมัติเผยแพร่"
 * (`request_publish`): the person asking becomes the requester and cannot approve it.
 */
export function CapacityDealNote({
  deal,
  promotionId,
  status,
  canManage = false,
  onRequested,
}: {
  deal: CapacityDealRef;
  promotionId?: string;
  status?: string;
  canManage?: boolean;
  /** After `request_publish`: the editor reads the promotion again. */
  onRequested?: () => void;
}) {
  const t = useTranslations("marketing.capacityDeals");
  const format = useFormat();
  const productTypes = useProductTypes();
  const [busy, setBusy] = useState(false);
  const offer = Boolean(canManage && promotionId && status && canRequestPublish(status, deal.approval));

  const requestPublish = async () => {
    if (!promotionId) return;
    setBusy(true);
    try {
      await adminBrowserApis().contract.POST("/v1/admin/promotions/{promotionId}/actions/{action}", {
        params: { path: { promotionId, action: "request_publish" } },
      });
      toast.success(t("requested"));
      onRequested?.();
    } catch (error) {
      toast.error(problemMessage(error, t("requestFailed")));
    } finally {
      setBusy(false);
    }
  };
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
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <ApprovalChip approval={deal.approval} />
        {offer ? (
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void requestPublish()}>
            {t("requestPublish")}
          </Button>
        ) : null}
      </div>
    </Callout>
  );
}
