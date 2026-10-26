"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { PROMOTION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Dialog } from "@/ui/components/Dialog";
import { IconButton } from "@/ui/components/IconButton";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  problemMessage,
  QueueTabs,
  ResourceList,
  StatusChip,
  useCan,
  type InitialPage,
} from "../console";
import { PROMOTION_KINDS, promotionsList, type Promotion } from "./resources";

/**
 * Promotions (F2 2.7, D-053): coupons, automatic promotions and the referral discount, in the
 * priority order the engine applies them. Each row says its benefit in the API's words, its
 * campaign, and what it has been used for (redemptions, discount given, what the margin guard
 * took back, D-053).
 */
export function PromotionsList({ initial }: { initial: InitialPage<Promotion> | null }) {
  const t = useTranslations("marketing.promotions");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const en = useLocale() === "en";
  const canManage = useCan("promotions.manage");
  const [ordering, setOrdering] = useState(false);

  const columns: DataTableColumn<Promotion>[] = [
    { id: "priority", header: t("columns.priority"), numeric: true, cell: (row) => row.priority },
    {
      id: "name",
      header: t("columns.promotion"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/marketing/promotions/${row.id}`} className="text-primary font-medium hover:underline">
            {row.name}
          </Link>
          <p className="text-muted text-xs">{en ? row.benefitSummaryEn : row.benefitSummaryTh}</p>
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
            className="text-primary text-xs tabular-nums hover:underline"
            title={row.campaign.name}
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
      numeric: true,
      cell: (row) => (
        <div className="text-sm">
          <p>{t("redemptions", { count: row.usage.redemptions })}</p>
          <p className="text-muted text-xs">{format.thb(row.usage.discountAmount)}</p>
          {Number(row.usage.cappedAmount) > 0 ? (
            <p className="text-warning-subtle-fg text-xs">
              {t("capped", { amount: format.thb(row.usage.cappedAmount) })}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "updatedAt",
      header: t("columns.updated"),
      hideable: true,
      cell: (row) => <When at={row.updatedAt} />,
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

/**
 * Live promotions in the order the engine tries them; the first is tried first (D-053). Saving
 * rewrites their priorities 10, 20, … (`admin.promotions.reorder`). Referral promotions are
 * system-managed (409 `promotions.system_managed`), so they are not offered.
 */
function PriorityDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("marketing.promotions.priority");
  const tList = useTranslations("marketing.promotions");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const live = useQuery({
    queryKey: queryKeys.list("admin", "promotion", { priority: true }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/promotions", { params: { query: { perPage: 100 } } })).data!,
  });
  const [order, setOrder] = useState<Promotion[] | null>(null);
  const [key] = useState(newIdempotencyKey);
  const rows =
    order ??
    (live.data?.data ?? [])
      .filter((row) => row.kind !== "referral" && (row.status === "active" || row.status === "paused"))
      .sort((a, b) => a.priority - b.priority);

  const save = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.PUT("/v1/admin/promotions/priority", {
          params: { header: { "Idempotency-Key": key } },
          body: { promotionIds: rows.map((row) => row.id) },
        })
      ).data!,
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
