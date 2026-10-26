"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Pagination } from "@/ui/components/Pagination";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, FormError, problemMessage, QueryError, useCan } from "../console";

type Review = Schemas["AdminReviewDto"];
type Status = Schemas["ReviewStatus"];
const STATUSES = ["pending", "published", "hidden"] as const satisfies readonly Status[];

/**
 * Customer reviews (D-265): new ones wait for moderation; a moderator publishes or hides each, and
 * those who may reply answer on getpack's behalf (one reply, shown under the review). The order and
 * the loyalty points the review earned are on the row.
 */
export function ReviewsDesk() {
  const t = useTranslations("content.reviews");
  const tList = useTranslations("console.list");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canModerate = useCan("reviews.moderate");
  const canReply = useCan("reviews.reply");
  const [status, setStatus] = useState<Status | "all">("pending");
  const [page, setPage] = useState(1);
  const [replying, setReplying] = useState<{ review: Review; body: string } | null>(null);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "review", { status, page }),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/reviews", {
          params: { query: { page, perPage: 25, ...(status === "all" ? {} : { status }) } },
        })
      ).data!,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "review") });
  const moderate = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "hide" }) =>
      adminBrowserApis().contract.POST("/v1/admin/reviews/{reviewId}/actions/{action}", {
        params: { path: { reviewId: id, action } },
      }),
    onSuccess: (_, { action }) => {
      toast.success(t(action === "publish" ? "publishedToast" : "hiddenToast"));
      refresh();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  const columns: DataTableColumn<Review>[] = [
    {
      id: "rating",
      header: t("rating"),
      cell: (row) => (
        <span aria-label={t("stars", { count: row.rating })} className="text-warning whitespace-nowrap">
          {"★".repeat(row.rating)}
          <span className="text-muted">{"★".repeat(5 - row.rating)}</span>
        </span>
      ),
    },
    {
      id: "comment",
      header: t("comment"),
      cell: (row) => (
        <div className="max-w-xl">
          <p className="text-sm whitespace-pre-line">
            {row.comment ?? <span className="text-muted">{t("noComment")}</span>}
          </p>
          {row.reply ? (
            <p className="text-muted border-border mt-1 border-s-2 ps-2 text-xs">
              {t("replied")}: {row.reply.body}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "order",
      header: t("order"),
      cell: (row) => (
        <div>
          <Link href={`/orders/${row.orderId}`} className="text-primary text-sm tabular-nums hover:underline">
            {row.orderCode}
          </Link>
          <p className="text-muted text-xs">{row.customer.displayName}</p>
        </div>
      ),
    },
    { id: "points", header: t("points"), numeric: true, cell: (row) => format.number(row.rewardPoints) },
    { id: "createdAt", header: t("createdAt"), cell: (row) => <When at={row.createdAt} /> },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <Badge
          tone={row.status === "published" ? "success" : row.status === "pending" ? "warning" : "neutral"}
          size="sm"
        >
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {canModerate && row.status !== "published" ? (
            <Button size="sm" variant="secondary" onClick={() => moderate.mutate({ id: row.id, action: "publish" })}>
              {t("publish")}
            </Button>
          ) : null}
          {canModerate && row.status !== "hidden" ? (
            <Button size="sm" variant="ghost" onClick={() => moderate.mutate({ id: row.id, action: "hide" })}>
              {t("hide")}
            </Button>
          ) : null}
          {canReply ? (
            <Button size="sm" variant="ghost" onClick={() => setReplying({ review: row, body: row.reply?.body ?? "" })}>
              {row.reply ? t("editReply") : t("reply")}
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  const data = query.data;
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("status")}
        value={status}
        onValueChange={(value) => {
          setStatus(value as Status | "all");
          setPage(1);
        }}
        options={[...STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })), { value: "all", label: t("all") }]}
      />
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          empty={<EmptyState icon="star" title={t("empty")} />}
        />
      )}
      {data && data.meta.total > data.meta.perPage ? (
        <Pagination
          page={data.meta.page}
          perPage={data.meta.perPage}
          total={data.meta.total}
          onPageChange={setPage}
          labels={{
            nav: tList("pagination"),
            previous: tList("previous"),
            next: tList("next"),
            range: (from, to, total) => tList("range", { from, to, total }),
            pageOf: (current, pages) => tList("pageOf", { page: current, pages }),
            perPage: tList("perPage"),
          }}
        />
      ) : null}
      {replying ? (
        <FormDialog
          title={t("replyTitle", { order: replying.review.orderCode })}
          description={replying.review.comment ?? undefined}
          submitLabel={t("sendReply")}
          onClose={() => setReplying(null)}
          onSubmit={async () => {
            if (replying.body.trim().length < 2) throw new FormError(t("replyRequired"));
            await adminBrowserApis().contract.PUT("/v1/admin/reviews/{reviewId}/reply", {
              params: { path: { reviewId: replying.review.id } },
              body: { body: replying.body.trim() },
            });
            toast.success(t("replySaved"));
            refresh();
          }}
        >
          <Field label={t("replyLabel")} hint={t("replyHint")} required>
            <Textarea
              rows={5}
              value={replying.body}
              onChange={(e) => setReplying({ ...replying, body: e.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
