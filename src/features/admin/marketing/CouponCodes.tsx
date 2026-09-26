"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { COUPON_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, FormDialog, FormError, problemMessage, Section, StatusChip, useCan } from "../console";
import type { CouponCode, Promotion } from "./resources";

/**
 * A coupon promotion's codes (D-053): one named code customers type, or a batch of unique
 * generated codes to hand out. Generating is one intent with one idempotency key, so a retry
 * never makes a second batch. A leaked code is disabled with a reason; its redemptions stay.
 */
export function CouponCodes({ promotion }: { promotion: Promotion }) {
  const t = useTranslations("marketing.coupons");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("marketing.manage") && promotion.status !== "ended";
  const [generating, setGenerating] = useState<{ key: string } | null>(null);
  const [kind, setKind] = useState<"single" | "bulk_unique">("single");
  const [code, setCode] = useState("");
  const [count, setCount] = useState("100");
  const [prefix, setPrefix] = useState("");
  const [disabling, setDisabling] = useState<CouponCode | null>(null);

  const batches = useQuery({
    queryKey: queryKeys.related("admin", "promotion", promotion.id, "batches"),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/promotions/{promotionId}/coupon-batches", {
        path: { promotionId: promotion.id },
      }),
  });
  const codes = useQuery({
    queryKey: queryKeys.related("admin", "promotion", promotion.id, "codes"),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/promotions/{promotionId}/coupon-codes", {
        path: { promotionId: promotion.id },
        query: { perPage: 100 },
      }),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.related("admin", "promotion", promotion.id, "batches") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.related("admin", "promotion", promotion.id, "codes") });
  };

  const columns: DataTableColumn<CouponCode>[] = [
    { id: "code", header: t("columns.code"), cell: (row) => <span className="font-mono">{row.code}</span> },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={COUPON_STATUS} value={row.status} />,
    },
    {
      id: "used",
      header: t("columns.used"),
      numeric: true,
      cell: (row) =>
        row.usageLimit ? t("usedOf", { used: row.usedCount, limit: row.usageLimit }) : format.number(row.usedCount),
    },
    ...(canManage
      ? [
          {
            id: "disable",
            header: <span className="sr-only">{t("disable")}</span>,
            cell: (row: CouponCode) =>
              row.status === "active" ? (
                <Button size="sm" variant="ghost" onClick={() => setDisabling(row)}>
                  {t("disableCode", { code: row.code })}
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <Section
      title={t("title")}
      description={t("note")}
      actions={
        canManage ? (
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
              {t(`batch.${batch.kind}`, { count: batch.count, prefix: batch.prefix ?? "" })} ·{" "}
              {batch.generatedBy.displayName} · <When at={batch.generatedAt} />
            </li>
          ))}
        </ul>
      ) : null}
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={codes.data?.data ?? []}
        getRowId={(row) => row.id}
        loading={codes.isPending}
        density="compact"
        empty={<EmptyState icon="ticket" title={t("empty")} description={t("emptyBody")} />}
      />
      {(codes.data?.meta.total ?? 0) > (codes.data?.data.length ?? 0) ? (
        <p className="text-muted mt-2 text-xs">
          {t("more", { shown: codes.data!.data.length, total: codes.data!.meta.total })}
        </p>
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
              await browserRequests().call("POST /v1/admin/promotions/{promotionId}/coupon-batches", {
                path: { promotionId: promotion.id },
                body:
                  kind === "single"
                    ? { kind, code: code.trim().toUpperCase() }
                    : {
                        kind,
                        count: Math.trunc(Number(count)),
                        ...(prefix.trim() ? { prefix: prefix.trim().toUpperCase() } : {}),
                      },
                idempotencyKey: generating.key,
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

      {disabling ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setDisabling(null))}
          title={t("disableTitle", { code: disabling.code })}
          description={t("disableBody", { code: disabling.code, used: disabling.usedCount })}
          confirmLabel={t("disable")}
          tone="destructive"
          reason={{ label: t("reason"), required: true, minLength: 3 }}
          onConfirm={async ({ reason }) => {
            try {
              await browserRequests().call("POST /v1/admin/coupon-codes/{codeId}/actions/disable", {
                path: { codeId: disabling.id },
                body: { reason },
              });
              toast.success(t("disabled"));
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
