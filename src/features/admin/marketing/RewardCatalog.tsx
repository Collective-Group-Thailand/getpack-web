"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import type { AdminRedemption, RewardCatalogItem } from "@/lib/api/requests/admin-loyalty-p3";
import type { RedemptionStatus } from "@/lib/api/requests/store-loyalty-p3";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable } from "@/ui/components/DataTable";
import { DeskSection } from "@/ui/components/DeskPage";
import { Dialog } from "@/ui/components/Dialog";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { PageHeader } from "@/ui/components/PageHeader";
import { toast } from "@/ui/components/Toast";
import { ViewTabs } from "@/ui/components/ViewTabs";

import { adminBrowserApis, problemMessage, QueryError, useCan, useProductTypes } from "../console";
import { DetailSkeleton } from "../console/DetailSkeleton";
import { rewardActionsOf } from "./reward-item";
import { RewardItemForm } from "./RewardItemForm";

const STATUS_TONE = { draft: "neutral", active: "success", paused: "warning", archived: "neutral" } as const;
const REDEMPTION_TONE = { issued: "info", used: "success", expired: "neutral", cancelled: "neutral" } as const;

/**
 * `/marketing/loyalty/rewards` (loyalty P3, D-498): the reward catalogue — code and name, kind, cost, tier, status,
 * redemptions in the last 30 days and open coupons — with activate / pause / archive on the row, and (`?tab=
 * redemptions`) every redemption with the staff cancel. Each item is backed by a hidden system promotion the API
 * keeps; it never appears among the promotions and never leaves `hidden` (D-487).
 */
export function RewardCatalog({ tab }: { tab: "items" | "redemptions" }) {
  const t = useTranslations("marketing.rewards");
  const canManage = useCan("promotions.manage");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ViewTabs
          label={t("tabs.label")}
          current={tab}
          items={[
            { key: "items", href: "/marketing/loyalty/rewards", label: t("tabs.items") },
            { key: "redemptions", href: "/marketing/loyalty/rewards?tab=redemptions", label: t("tabs.redemptions") },
          ]}
        />
        {tab === "items" && canManage ? (
          <Button asChild iconStart="plus">
            <Link href="/marketing/loyalty/rewards/new">{t("new")}</Link>
          </Button>
        ) : null}
      </div>
      {tab === "items" ? <RewardItems /> : <RewardRedemptions />}
    </div>
  );
}

function RewardItems() {
  const t = useTranslations("marketing.rewards");
  const en = useLocale() === "en";
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("promotions.manage");
  const [busy, setBusy] = useState<string | null>(null);
  const items = useQuery({
    queryKey: queryKeys.list("admin", "reward_item", {}),
    queryFn: async () => (await adminBrowserApis().requests.call("GET /v1/admin/loyalty/rewards")).items,
  });

  const run = async (row: RewardCatalogItem, action: "activate" | "pause" | "archive") => {
    setBusy(`${row.id}:${action}`);
    try {
      await adminBrowserApis().requests.call("POST /v1/admin/loyalty/rewards/{itemId}/actions/{action}", {
        path: { itemId: row.id, action },
      });
      toast.success(t(`form.actions.${action}.done`));
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "reward_item") });
    } catch (error) {
      toast.error(problemMessage(error, t("form.failed")));
    } finally {
      setBusy(null);
    }
  };

  if (items.isError) return <QueryError error={items.error} onRetry={() => void items.refetch()} />;

  return (
    <DeskSection title={t("itemsTitle")} description={t("itemsNote")}>
      <DataTable<RewardCatalogItem>
        caption={t("itemsTitle")}
        rows={items.data ?? []}
        loading={items.isPending}
        getRowId={(row) => row.id}
        empty={<EmptyState icon="gift" title={t("empty")} />}
        columns={[
          {
            id: "name",
            header: t("columns.name"),
            cell: (row) => (
              <div className="min-w-0">
                <Link
                  href={`/marketing/loyalty/rewards/${row.id}`}
                  className="text-primary font-medium hover:underline"
                >
                  {en ? row.name.en : row.name.th}
                </Link>
                <p className="text-muted font-mono text-xs">{row.code}</p>
              </div>
            ),
          },
          { id: "kind", header: t("columns.kind"), cell: (row) => t(`kinds.${row.kind}`) },
          {
            id: "cost",
            header: t("columns.cost"),
            numeric: true,
            cell: (row) => t("pointsValue", { points: format.number(row.costPoints) }),
          },
          {
            id: "tier",
            header: t("columns.tier"),
            cell: (row) =>
              row.tierRequired ? (
                t("form.tierAndUp", { tier: t(`tiers.${row.tierRequired}`) })
              ) : (
                <span className="text-muted">{t("form.everyone")}</span>
              ),
          },
          {
            id: "status",
            header: t("columns.status"),
            cell: (row) => (
              <Badge size="sm" tone={STATUS_TONE[row.status]}>
                {t(`statuses.${row.status}`)}
              </Badge>
            ),
          },
          {
            id: "redemptions",
            header: t("columns.redemptions30d"),
            numeric: true,
            cell: (row) => format.number(row.redemptions30d),
          },
          { id: "open", header: t("columns.open"), numeric: true, cell: (row) => format.number(row.openCoupons) },
          {
            id: "actions",
            header: <span className="sr-only">{t("columns.actions")}</span>,
            cell: (row) =>
              canManage ? (
                <span className="flex justify-end gap-1.5">
                  {rewardActionsOf(row.status)
                    .filter((action) => action !== "archive")
                    .map((action) => (
                      <Button
                        key={action}
                        size="sm"
                        variant="ghost"
                        loading={busy === `${row.id}:${action}`}
                        onClick={() => void run(row, action)}
                      >
                        {t(`form.actions.${action}.label`)}
                      </Button>
                    ))}
                </span>
              ) : null,
          },
        ]}
      />
    </DeskSection>
  );
}

const REDEMPTION_STATUSES: readonly RedemptionStatus[] = ["issued", "used", "expired", "cancelled"];

/** Every redemption — catalogue and tier perks — with the staff cancel of an unused catalogue coupon. */
export function RewardRedemptions() {
  const t = useTranslations("marketing.rewards.redemptions");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canCancel = useCan("loyalty.adjust");
  const [status, setStatus] = useState<RedemptionStatus | "">("");
  const [cancelling, setCancelling] = useState<AdminRedemption | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const rows = useQuery({
    queryKey: queryKeys.list("admin", "reward_redemption", { status }),
    queryFn: async () =>
      (
        await adminBrowserApis().requests.call("GET /v1/admin/loyalty/reward-redemptions", {
          query: { status: status || undefined, perPage: 100 },
        })
      ).data,
  });

  const cancel = async () => {
    if (!cancelling) return;
    if (reason.trim().length < 10) {
      setRefused(t("reasonShort"));
      return;
    }
    setBusy(true);
    try {
      await adminBrowserApis().requests.call(
        "POST /v1/admin/loyalty/reward-redemptions/{redemptionId}/actions/cancel",
        { path: { redemptionId: cancelling.id }, body: { reason: reason.trim() } },
      );
      toast.success(t("cancelled", { points: format.number(cancelling.pointsSpent) }));
      setCancelling(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "reward_redemption") });
    } catch (error) {
      setRefused(isApiError(error) ? problemMessage(error, t("failed")) : t("failed"));
    } finally {
      setBusy(false);
    }
  };

  if (rows.isError) return <QueryError error={rows.error} onRetry={() => void rows.refetch()} />;

  return (
    <DeskSection
      title={t("title")}
      description={t("note")}
      actions={
        <Field label={t("status")} labelHidden>
          <NativeSelect<RedemptionStatus | "">
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "", label: t("allStatuses") },
              ...REDEMPTION_STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) })),
            ]}
          />
        </Field>
      }
    >
      <DataTable<AdminRedemption>
        caption={t("title")}
        rows={rows.data ?? []}
        loading={rows.isPending}
        getRowId={(row) => row.id}
        empty={<EmptyState icon="ticket" title={t("empty")} />}
        columns={[
          {
            id: "customer",
            header: t("columns.customer"),
            cell: (row) => (
              <div>
                <p className="font-medium">{row.customer.displayName}</p>
                <p className="text-muted text-xs tabular-nums">{row.customer.code}</p>
              </div>
            ),
          },
          {
            id: "item",
            header: t("columns.item"),
            cell: (row) => (
              <div>
                <p>{row.item.name}</p>
                <p className="text-muted text-xs">
                  {row.source === "tier_perk" ? t("perk") : t("bought", { points: format.number(row.pointsSpent) })}
                </p>
              </div>
            ),
          },
          {
            id: "coupon",
            header: t("columns.coupon"),
            cell: (row) => <span className="font-mono text-xs tracking-[0.04em]">{row.couponCode}</span>,
          },
          {
            id: "status",
            header: t("columns.status"),
            cell: (row) => (
              <div>
                <Badge size="sm" tone={REDEMPTION_TONE[row.status]}>
                  {t(`statuses.${row.status}`)}
                </Badge>
                {row.usedOrderCode ? (
                  <p className="text-muted mt-0.5 text-xs tabular-nums">{row.usedOrderCode}</p>
                ) : null}
                {row.cancelReason ? <p className="text-muted mt-0.5 text-xs">{row.cancelReason}</p> : null}
              </div>
            ),
          },
          { id: "created", header: t("columns.created"), cell: (row) => format.dateTime(row.createdAt) },
          { id: "expires", header: t("columns.expires"), cell: (row) => format.date(row.expiresAt) },
          {
            id: "actions",
            header: <span className="sr-only">{t("columns.actions")}</span>,
            cell: (row) =>
              canCancel && row.status === "issued" && row.source === "catalogue" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReason("");
                    setRefused(null);
                    setCancelling(row);
                  }}
                >
                  {t("cancel")}
                </Button>
              ) : null,
          },
        ]}
      />
      <Dialog
        open={cancelling !== null}
        onOpenChange={(open) => (open ? null : setCancelling(null))}
        title={t("confirmTitle")}
        description={
          cancelling
            ? t("confirmBody", {
                code: cancelling.couponCode,
                customer: cancelling.customer.displayName,
                points: format.number(cancelling.pointsSpent),
              })
            : undefined
        }
        closeLabel={t("close")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              {t("keep")}
            </Button>
            <Button variant="destructive" loading={busy} onClick={() => void cancel()}>
              {t("confirm")}
            </Button>
          </>
        }
      >
        <Field label={t("reason")} hint={t("reasonHint")} error={refused ?? undefined} required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </Dialog>
    </DeskSection>
  );
}

/** `/marketing/loyalty/rewards/new` and `/[itemId]`: the editor around the form — the read with its ETag, the route. */
export function RewardItemEditor({ itemId }: { itemId?: string }) {
  const t = useTranslations("marketing.rewards");
  const en = useLocale() === "en";
  const router = useRouter();
  const queryClient = useQueryClient();
  const productTypes = useProductTypes();
  const canManage = useCan("promotions.manage");
  const key = queryKeys.detail("admin", "reward_item", itemId ?? "new");
  const read = useQuery({
    queryKey: key,
    queryFn: () =>
      adminBrowserApis().requests.read("GET /v1/admin/loyalty/rewards/{itemId}", { path: { itemId: itemId! } }),
    enabled: Boolean(itemId),
  });
  if (read.isError) return <QueryError error={read.error} onRetry={() => void read.refetch()} />;
  if (itemId && !read.data) return <DetailSkeleton />;
  const item = read.data?.data ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={item ? (en ? item.name.en : item.name.th) : t("newTitle")}
        description={item ? <span className="font-mono">{item.code}</span> : t("newNote")}
        back={{ href: "/marketing/loyalty/rewards", label: t("title") }}
      />
      <RewardItemForm
        key={item ? `${item.id}:${item.updatedAt}:${item.status}` : "new"}
        item={item}
        etag={read.data?.etag ?? null}
        editable={canManage && item?.status !== "archived"}
        productTypes={productTypes.options}
        onSaved={(saved, etag) => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "reward_item") });
          if (!itemId) router.replace(`/marketing/loyalty/rewards/${saved.id}`);
          else queryClient.setQueryData(key, { data: saved, etag: etag ?? read.data?.etag ?? null });
        }}
      />
    </div>
  );
}
