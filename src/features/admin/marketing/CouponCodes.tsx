"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { adminCouponActions } from "@/domain/next-actions/admin";
import { COUPON_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  Section,
  StatusChip,
  useActor,
  useCan,
} from "../console";
import type { CouponCode, Promotion } from "./resources";

/**
 * A coupon promotion's codes (D-053): one named code customers type, or a batch of unique
 * generated codes to hand out. Generating is one intent with one idempotency key, so a retry
 * never makes a second batch. A leaked code is disabled; its redemptions stay, and it can be
 * enabled again.
 *
 * The batches are `admin.promotions.listCouponBatches`; the codes filter by batch and status, and
 * each names its batch and, for a per-customer code, its customer. Disabling records why.
 */
export function CouponCodes({ promotion }: { promotion: Promotion }) {
  const t = useTranslations("marketing.coupons");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const queryClient = useQueryClient();
  const actor = useActor();
  const can = (permission: string) => actor.permissions.includes(permission);
  const canGenerate = useCan("promotions.manage") && promotion.status !== "ended";
  const [generating, setGenerating] = useState<{ key: string } | null>(null);
  const [kind, setKind] = useState<"single" | "bulk_unique">("single");
  const [code, setCode] = useState("");
  const [count, setCount] = useState("100");
  const [prefix, setPrefix] = useState("");
  const [changing, setChanging] = useState<{ coupon: CouponCode; action: Schemas["CouponAction"] } | null>(null);
  const [batchId, setBatchId] = useState("");
  const [status, setStatus] = useState<Schemas["CouponStatus"] | "">("");

  const batches = useQuery({
    queryKey: queryKeys.related("admin", "promotion", promotion.id, "batches"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/promotions/{promotionId}/coupon-batches", {
          params: { path: { promotionId: promotion.id } },
        })
      ).data!,
  });
  const codes = useQuery({
    queryKey: [...queryKeys.related("admin", "promotion", promotion.id, "codes"), batchId, status],
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/promotions/{promotionId}/coupons", {
          params: {
            path: { promotionId: promotion.id },
            query: { perPage: 100, ...(batchId ? { batchId } : {}), ...(status ? { status } : {}) },
          },
        })
      ).data!,
  });
  const batchLabel = (id: string | null) => {
    const batch = (batches.data ?? []).find((item) => item.id === id);
    return batch ? t("batchLabel", { kind: t(`kinds.${batch.kind}`), date: format.date(batch.generatedAt) }) : "–";
  };
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.related("admin", "promotion", promotion.id, "batches") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.related("admin", "promotion", promotion.id, "codes") });
  };

  const rows = codes.data?.data ?? [];
  const withActions = rows.some((row) => adminCouponActions(row, promotion.status, can).length > 0);
  const columns: DataTableColumn<CouponCode>[] = [
    { id: "code", header: t("columns.code"), cell: (row) => <span className="font-mono">{row.code}</span> },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={COUPON_STATUS} value={row.status} />,
    },
    { id: "batch", header: t("columns.batch"), hideable: true, cell: (row) => batchLabel(row.batchId) },
    {
      id: "customer",
      header: t("columns.customer"),
      hideable: true,
      cell: (row) => row.assignedCustomer?.displayName ?? <span className="text-muted">–</span>,
    },
    {
      id: "used",
      header: t("columns.used"),
      numeric: true,
      cell: (row) =>
        row.usageLimit ? t("usedOf", { used: row.usedCount, limit: row.usageLimit }) : format.number(row.usedCount),
    },
    ...(withActions
      ? [
          {
            id: "actions",
            header: <span className="sr-only">{t("actionsHeader")}</span>,
            cell: (row: CouponCode) =>
              adminCouponActions(row, promotion.status, can).map((action) => (
                <Button key={action} size="sm" variant="ghost" onClick={() => setChanging({ coupon: row, action })}>
                  {t(`${action}Code`, { code: row.code })}
                </Button>
              )),
          },
        ]
      : []),
  ];

  return (
    <Section
      title={t("title")}
      description={t("note")}
      actions={
        canGenerate ? (
          <Button
            size="sm"
            variant="secondary"
            iconStart="plus"
            onClick={() => {
              setKind(batches.data?.length ? "bulk_unique" : "single");
              setCode("");
              setCount("100");
              setPrefix("");
              setGenerating({ key: newIdempotencyKey() });
            }}
          >
            {t("generate")}
          </Button>
        ) : null
      }
    >
      {(batches.data ?? []).length > 0 ? (
        <ul className="text-muted mb-3 flex flex-col gap-1 text-sm">
          {(batches.data ?? []).map((batch) => (
            <li key={batch.id}>
              {t(`batch.${batch.kind}`, { count: batch.count, prefix: batch.prefix ?? "" })}
              {batch.generatedBy ? ` · ${batch.generatedBy.displayName}` : null} · <When at={batch.generatedAt} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        {(batches.data ?? []).length > 1 ? (
          <Field label={t("filterBatch")}>
            <SearchableSelect
              value={batchId || "all"}
              onValueChange={(value) => setBatchId(value === "all" ? "" : value)}
              options={[
                { value: "all", label: t("allBatches") },
                ...(batches.data ?? []).map((batch) => ({ value: batch.id, label: batchLabel(batch.id) })),
              ]}
            />
          </Field>
        ) : null}
        <Field label={t("filterStatus")}>
          <SearchableSelect
            value={status || "all"}
            onValueChange={(value) => setStatus(value === "all" ? "" : (value as Schemas["CouponStatus"]))}
            options={[
              { value: "all", label: t("allStatuses") },
              ...Object.entries(COUPON_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
            ]}
          />
        </Field>
      </div>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={codes.isPending}
        density="compact"
        empty={<EmptyState icon="ticket" title={t("empty")} description={t("emptyBody")} />}
      />
      {(codes.data?.meta.total ?? 0) > rows.length ? (
        <p className="text-muted mt-2 text-xs">{t("more", { shown: rows.length, total: codes.data!.meta.total })}</p>
      ) : null}

      {generating ? (
        <FormDialog
          title={t("generateTitle")}
          description={t("generateBody", { name: promotion.name })}
          submitLabel={t("generateSubmit")}
          onClose={() => setGenerating(null)}
          onSubmit={async () => {
            if (kind === "single" && !code.trim()) throw new FormError(t("needCode"));
            try {
              await adminBrowserApis().contract.POST("/v1/admin/promotions/{promotionId}/coupons", {
                params: { path: { promotionId: promotion.id }, header: { "Idempotency-Key": generating.key } },
                body:
                  kind === "single"
                    ? { kind, code: code.trim().toUpperCase() }
                    : {
                        kind,
                        count: Math.trunc(Number(count)),
                        ...(prefix.trim() ? { prefix: prefix.trim().toUpperCase() } : {}),
                      },
              });
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
            toast.success(t("generated"));
            refresh();
          }}
        >
          <SegmentedControl
            label={t("kind")}
            value={kind}
            onValueChange={(value) => setKind(value as typeof kind)}
            options={[
              { value: "single", label: t("kinds.single") },
              { value: "bulk_unique", label: t("kinds.bulk_unique") },
            ]}
          />
          {kind === "single" ? (
            <Field label={t("code")} hint={t("codeHint")} required>
              <Input className="font-mono uppercase" value={code} onChange={(event) => setCode(event.target.value)} />
            </Field>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("count")} hint={t("countHint")} required>
                <NumberInput min={1} max={10000} value={count} onChange={(event) => setCount(event.target.value)} />
              </Field>
              <Field label={t("prefix")} hint={t("prefixHint")}>
                <Input
                  className="font-mono uppercase"
                  value={prefix}
                  onChange={(event) => setPrefix(event.target.value)}
                />
              </Field>
            </div>
          )}
        </FormDialog>
      ) : null}

      {changing ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setChanging(null))}
          title={t(`${changing.action}Title`, { code: changing.coupon.code })}
          description={t(`${changing.action}Body`, { code: changing.coupon.code, used: changing.coupon.usedCount })}
          confirmLabel={t(changing.action)}
          tone={changing.action === "disable" ? "destructive" : "primary"}
          reason={
            changing.action === "disable"
              ? { label: t("disableReason"), required: true, minLength: 3, hint: t("disableReasonHint") }
              : undefined
          }
          onConfirm={async ({ reason }) => {
            try {
              await adminBrowserApis().contract.POST(
                "/v1/admin/promotions/{promotionId}/coupons/{couponId}/actions/{action}",
                {
                  params: {
                    path: { promotionId: promotion.id, couponId: changing.coupon.id, action: changing.action },
                  },
                  body: reason ? { reason } : {},
                },
              );
              toast.success(t(`${changing.action}d`));
              refresh();
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </Section>
  );
}
