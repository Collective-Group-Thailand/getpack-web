"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Pagination } from "@/ui/components/Pagination";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, FormError, QueryError, useCan } from "../console";

type Request = Schemas["FactoryChangeRequestDto"];
type Status = Schemas["FactoryChangeRequestStatus"];
type Topic = Schemas["FactoryChangeRequestTopic"];
type Answer = Schemas["FactoryChangeRequestAnswer"];

const TOPICS = [
  "capability",
  "capacity",
  "delivery_zones",
  "tolerance",
  "participation_tier",
  "pricing_arrangement",
  "payout_policy",
  "site_visit",
  "other",
] as const satisfies readonly Topic[];
const TONE: Record<Status, "warning" | "info" | "success" | "neutral"> = {
  open: "warning",
  in_progress: "info",
  done: "success",
  declined: "neutral",
};
/** Where each topic is changed on the factory's page — the change itself goes through its own flow. */
const TAB: Record<Topic, string> = {
  capability: "operations",
  capacity: "operations",
  delivery_zones: "operations",
  tolerance: "terms",
  participation_tier: "terms",
  pricing_arrangement: "terms",
  payout_policy: "terms",
  site_visit: "visits",
  other: "profile",
};

/**
 * What factories asked the Partner team to change (U-B0.3): capability, capacity, zones, terms,
 * a site visit. The answer — in progress, done or declined with a response the factory reads — is
 * recorded here; the change itself is made on the factory's page through its governed flow.
 */
export function ChangeRequests() {
  const t = useTranslations("partners.requests");
  const tList = useTranslations("console.list");
  const queryClient = useQueryClient();
  const canManage = useCan("partners.manage");
  const [status, setStatus] = useState<Status | "all">("open");
  const [topic, setTopic] = useState<Topic | "">("");
  const [page, setPage] = useState(1);
  const [answering, setAnswering] = useState<{ request: Request; status: Answer; response: string } | null>(null);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "factory_change_request", { status, topic, page }),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/factory-change-requests", {
          params: {
            query: { page, perPage: 25, ...(status === "all" ? {} : { status }), ...(topic ? { topic } : {}) },
          },
        })
      ).data!,
  });

  const columns: DataTableColumn<Request>[] = [
    {
      id: "factory",
      header: t("factory"),
      cell: (row) => (
        <Link
          href={`/partners/${row.factoryId}?tab=${TAB[row.topic]}`}
          className="text-primary tabular-nums hover:underline"
        >
          {row.factoryCode}
        </Link>
      ),
    },
    { id: "topic", header: t("topic"), cell: (row) => <Badge size="sm">{t(`topics.${row.topic}`)}</Badge> },
    {
      id: "message",
      header: t("message"),
      cell: (row) => (
        <div className="max-w-xl text-sm">
          <p className="whitespace-pre-line">{row.message}</p>
          {row.proposedTier ? <p className="text-muted text-xs">{t("tier", { tier: row.proposedTier })}</p> : null}
          {row.preferredDates.length ? (
            <p className="text-muted text-xs">{t("dates", { dates: row.preferredDates.join(", ") })}</p>
          ) : null}
          {row.response ? (
            <p className="border-border mt-1 border-s-2 ps-2 text-xs">
              {row.response} — {row.respondedBy?.displayName ?? ""}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "from",
      header: t("from"),
      cell: (row) => (
        <div className="text-sm">
          {row.createdBy.displayName}
          <p className="text-muted text-xs">
            <When at={row.createdAt} />
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <Badge size="sm" tone={TONE[row.status]}>
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t("actions"),
            cell: (row: Request) =>
              row.status === "open" || row.status === "in_progress" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setAnswering({ request: row, status: row.status === "open" ? "in_progress" : "done", response: "" })
                  }
                >
                  {t("answer")}
                </Button>
              ) : null,
          } satisfies DataTableColumn<Request>,
        ]
      : []),
  ];

  const data = query.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl
          label={t("status")}
          value={status}
          onValueChange={(value) => {
            setStatus(value as Status | "all");
            setPage(1);
          }}
          options={[
            ...(["open", "in_progress", "done", "declined"] as const).map((s) => ({
              value: s,
              label: t(`statuses.${s}`),
            })),
            { value: "all", label: t("all") },
          ]}
        />
        <Field label={t("topic")} className="w-56">
          <NativeSelect
            value={topic}
            onValueChange={(value) => {
              setTopic(value as Topic | "");
              setPage(1);
            }}
            options={[
              { value: "", label: t("allTopics") },
              ...TOPICS.map((x) => ({ value: x, label: t(`topics.${x}`) })),
            ]}
          />
        </Field>
      </div>
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          empty={<EmptyState icon="inbox" title={t("empty")} />}
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
      {answering ? (
        <FormDialog
          title={t("answerTitle", { code: answering.request.factoryCode })}
          description={t("answerIntro")}
          submitLabel={t("send")}
          onClose={() => setAnswering(null)}
          onSubmit={async () => {
            const response = answering.response.trim();
            if (answering.status !== "in_progress" && response.length < 3) throw new FormError(t("responseRequired"));
            await adminBrowserApis().contract.POST("/v1/admin/factory-change-requests/{requestId}/actions/answer", {
              params: { path: { requestId: answering.request.id } },
              body: { status: answering.status, ...(response ? { response } : {}) },
            });
            toast.success(t("answered"));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "factory_change_request") });
          }}
        >
          <p className="bg-surface-subtle rounded-md p-3 text-sm whitespace-pre-line">{answering.request.message}</p>
          <SegmentedControl
            label={t("decision")}
            value={answering.status}
            onValueChange={(value) => setAnswering({ ...answering, status: value as Answer })}
            options={(["in_progress", "done", "declined"] as const).map((s) => ({
              value: s,
              label: t(`answers.${s}`),
            }))}
          />
          <Field label={t("response")} hint={t("responseHint")} required={answering.status !== "in_progress"}>
            <Textarea
              rows={4}
              value={answering.response}
              onChange={(e) => setAnswering({ ...answering, response: e.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
