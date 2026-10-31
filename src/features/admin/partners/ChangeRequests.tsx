"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, FormError, QueueTabs, ResourceList, useCan } from "../console";
import { ALL_REQUESTS, changeRequestsList } from "./resources";

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
  const queryClient = useQueryClient();
  const canManage = useCan("partners.manage");
  const [answering, setAnswering] = useState<{ request: Request; status: Answer; response: string } | null>(null);

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
                  variant="ghost"
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

  return (
    <div className="flex flex-col gap-4">
      <ResourceList
        views={
          <QueueTabs
            countFrom={changeRequestsList}
            label={t("status")}
            param="status"
            tabs={[
              { value: null, label: t("statuses.open") },
              ...(["in_progress", "done", "declined"] as const).map((s) => ({ value: s, label: t(`statuses.${s}`) })),
              { value: ALL_REQUESTS, label: t("all") },
            ]}
          />
        }
        resource={changeRequestsList}
        columns={columns}
        caption={t("title")}
        savedViews={false}
        filters={[
          {
            id: "topic",
            label: t("topic"),
            kind: "select",
            options: TOPICS.map((x) => ({ value: x, label: t(`topics.${x}`) })),
          },
        ]}
        empty={{
          title: t("empty"),
          action: (
            <Button asChild variant="secondary" iconEnd="arrow-right">
              <Link href="/partners">{t("emptyAction")}</Link>
            </Button>
          ),
        }}
      />
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
