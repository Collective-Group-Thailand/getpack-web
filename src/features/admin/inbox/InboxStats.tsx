"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { adminBrowserApis, QueryError } from "../console";

const bangkokDay = (offset: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(Date.now() + offset * 86_400_000));

/**
 * How fast the inbox answers (D-300, D-221): threads opened and closed over Bangkok days, the first
 * response — median, 90th percentile and the share answered by its due time — the time to resolve,
 * and the live threads overdue now.
 */
export function InboxStats() {
  const t = useTranslations("cs.inbox.stats");
  const format = useFormat();
  const [days, setDays] = useState("7");
  const period = { from: bangkokDay(-(Number(days) - 1)), to: bangkokDay(0) };
  const stats = useQuery({
    queryKey: queryKeys.list("admin", "conversation_stats", period),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/conversations/stats", { params: { query: period } })).data!,
  });
  const minutes = (value: string | null) =>
    value === null ? "—" : t("minutes", { minutes: format.number(Number(value)) });
  if (stats.isError) return <QueryError error={stats.error} onRetry={() => void stats.refetch()} />;
  const data = stats.data;
  const tile = (label: string, value: string, note?: string, danger = false) => (
    <div className="rounded-md border p-3">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${danger ? "text-danger" : ""}`}>{value}</dd>
      {note ? <dd className="text-muted text-xs">{note}</dd> : null}
    </div>
  );
  return (
    <section aria-label={t("label")} className="flex flex-col gap-2">
      <SegmentedControl
        label={t("period")}
        size="sm"
        value={days}
        onValueChange={setDays}
        options={["1", "7", "30"].map((value) => ({ value, label: t(`periods.${value}`) }))}
      />
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tile(
          t("opened"),
          data ? format.number(data.opened) : "—",
          data ? t("closed", { count: data.closed }) : undefined,
        )}
        {tile(
          t("firstResponse"),
          minutes(data?.firstResponse.medianMinutes ?? null),
          data ? t("p90", { value: minutes(data.firstResponse.p90Minutes) }) : undefined,
        )}
        {tile(
          t("withinTarget"),
          data?.firstResponse.withinTargetPct ? format.percent(data.firstResponse.withinTargetPct, 0) : "—",
          data ? t("answered", { count: data.firstResponse.count }) : undefined,
        )}
        {tile(
          t("resolution"),
          minutes(data?.resolution.medianMinutes ?? null),
          data ? t("p90", { value: minutes(data.resolution.p90Minutes) }) : undefined,
        )}
        {tile(t("overdue"), data ? format.number(data.overdueNow) : "—", undefined, Boolean(data?.overdueNow))}
      </dl>
    </section>
  );
}
