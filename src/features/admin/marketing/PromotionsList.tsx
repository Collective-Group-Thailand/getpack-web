"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PROMOTION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Dialog } from "@/ui/components/Dialog";
import { IconButton } from "@/ui/components/IconButton";
import { toast } from "@/ui/components/Toast";

import { problemMessage, QueueTabs, ResourceList, StatusChip, useCan, type InitialPage } from "../console";
import { PROMOTION_KINDS, promotionsList, type PromotionSummary } from "./resources";

/**
 * Promotions (F2 2.7, D-053): coupons, automatic promotions and the referral discount, in the
 * priority order the engine applies them. Usage shows what the margin guard capped — the API
 * caps; the screen reports.
 */
export function PromotionsList({ initial }: { initial: InitialPage<PromotionSummary> | null }) {
  const t = useTranslations("marketing.promotions");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canManage = useCan("promotions.manage");
  const [ordering, setOrdering] = useState(false);

  const columns: DataTableColumn<PromotionSummary>[] = [
    { id: "priority", header: t("columns.priority"), numeric: true, cell: (row) => row.priority },
    {
      id: "name",
      header: t("columns.promotion"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/marketing/promotions/${row.id}`} className="text-primary font-medium hover:underline">
            {row.name}
          </Link>
          <p className="text-muted text-xs">{row.benefitSummary}</p>
        </div>
      ),
    },
    { id: "kind", header: t("columns.kind"), cell: (row) => <Badge size="sm">{t(`kinds.${row.kind}`)}</Badge> },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={PROMOTION_STATUS} value={row.status} />,
    },
    {
      id: "campaign",
      header: t("columns.campaign"),
      cell: (row) =>
        row.campaign ? (
          <Link
            href={`/marketing/campaigns/${row.campaign.id}`}
            className="text-primary font-mono text-xs hover:underline"
          >
            {row.campaign.code}
          </Link>
        ) : (
          <span className="text-muted">–</span>
        ),
    },
    { id: "stacking", header: t("columns.stacking"), hideable: true, cell: (row) => t(`stacking.${row.stacking}`) },
    {
      id: "usage",
      header: t("columns.usage"),
      cell: (row) => (
        <span className="text-sm">
          {t("usage", { count: row.usage.redemptionsCount, amount: format.thb(row.usage.discountAmount) })}
          {Number(row.usage.cappedAmount) > 0 ? (
            <span className="text-warning-subtle-fg block text-xs">
              {t("capped", { amount: format.thb(row.usage.cappedAmount) })}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "window",
      header: t("columns.window"),
      hideable: true,
      cell: (row) => (
        <span className="text-sm whitespace-nowrap">
          <When at={row.startsAt} absoluteOnly /> – {row.endsAt ? <When at={row.endsAt} absoluteOnly /> : t("noEnd")}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <QueueTabs
          label={t("kindsLabel")}
          param="kind"
          tabs={[
            { value: null, label: t("all") },
            ...PROMOTION_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) })),
          ]}
        />
        <div className="flex gap-2 pb-1">
          {canManage ? (
            <>
              <Button variant="secondary" iconStart="sort-asc" onClick={() => setOrdering(true)}>
                {t("reorder")}
              </Button>
              <Button iconStart="plus" asChild>
                <Link href="/marketing/promotions/new">{t("create")}</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <ResourceList
        resource={promotionsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: Object.entries(PROMOTION_STATUS).map(([value, meta]) => ({
              value,
              label: tStatus(meta.labelKey),
            })),
          },
        ]}
        empty={{ title: t("empty") }}
      />
      {ordering ? <PriorityDialog onClose={() => setOrdering(false)} /> : null}
    </div>
  );
}

/** Live promotions in the order the engine tries them; the first is tried first (D-053). */
function PriorityDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("marketing.promotions.priority");
  const tList = useTranslations("marketing.promotions");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const live = useQuery({
    queryKey: queryKeys.list("admin", "promotion", { priority: true }),
    queryFn: () => browserRequests().call("GET /v1/admin/promotions", { query: { perPage: 100 } }),
  });
  const [order, setOrder] = useState<PromotionSummary[] | null>(null);
  const rows = order ?? (live.data?.data ?? []).filter((row) => row.status === "active" || row.status === "paused");

  const save = useMutation({
    mutationFn: () =>
      browserRequests().call("PUT /v1/admin/promotions/priority", {
        body: { promotionIds: rows.map((row) => row.id) },
      }),
    onSuccess: () => {
      toast.success(t("saved"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
      onClose();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  const move = (index: number, by: -1 | 1) => {
    const next = [...rows];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    setOrder(next);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title")}
      description={t("body")}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button loading={save.isPending} disabled={!order} onClick={() => save.mutate()}>
            {t("save")}
          </Button>
        </>
      }
    >
      <ol className="flex flex-col gap-1">
        {rows.map((row, index) => (
          <li key={row.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="text-muted w-6 tabular-nums">{index + 1}.</span>
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            <Badge size="sm">{tList(`kinds.${row.kind}`)}</Badge>
            <IconButton
              name="chevron-up"
              size="sm"
              variant="ghost"
              label={t("up", { name: row.name })}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            />
            <IconButton
              name="chevron-down"
              size="sm"
              variant="ghost"
              label={t("down", { name: row.name })}
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
            />
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
