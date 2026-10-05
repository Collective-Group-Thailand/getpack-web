"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { ProgressTracker } from "@/ui/components/ProgressTracker";
import { Skeleton } from "@/ui/components/Skeleton";

const STATE = { completed: "done", in_progress: "current", pending: "upcoming", skipped: "skipped" } as const;

/**
 * The success state after paying (U5.7 §1): the first order's stages from here to delivery, as the
 * API lists them (`store.timeline.progress`), with the factory plan's dates where it has them. A
 * group of several orders shows the first; each order's page has its own.
 */
export function WhatHappensNext({ groupId }: { groupId: string }) {
  const t = useTranslations("fulfilment.stages");
  const locale = useLocale();
  const format = useFormat();
  const progress = useQuery({
    queryKey: queryKeys.related("customer", "order-group", groupId, "first-progress"),
    queryFn: async () => {
      const api = browserApi();
      const group = (await api.GET("/v1/store/order-groups/{groupId}", { params: { path: { groupId } } })).data!;
      const first = group.orders[0];
      if (!first) return null;
      return (await api.GET("/v1/store/orders/{orderId}/progress", { params: { path: { orderId: first.id } } })).data!;
    },
  });
  if (progress.isPending) return <Skeleton lines={4} />;
  if (!progress.data) return null;
  return (
    <ProgressTracker
      label={t("label")}
      stateLabels={{
        done: t("state.done"),
        current: t("state.current"),
        upcoming: t("state.upcoming"),
        skipped: t("state.skipped"),
      }}
      stages={progress.data.steps.map((step) => ({
        key: step.key,
        title: pick(locale, step.labelTh, step.labelEn),
        state: STATE[step.status],
        time: step.completedAt ? (
          <time dateTime={step.completedAt}>{format.date(step.completedAt)}</time>
        ) : step.promisedAt && step.status !== "skipped" ? (
          <time dateTime={step.promisedAt}>{t("promised", { date: format.date(step.promisedAt) })}</time>
        ) : undefined,
      }))}
    />
  );
}
