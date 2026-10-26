"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, problemMessage, ResourceList, shortRef, type InitialPage } from "../console";
import { outboxList, type OutboxMessage } from "./resources";

const STATUSES: OutboxMessage["status"][] = ["pending", "dispatched", "failed", "dead"];
const TONES = { pending: "neutral", dispatched: "success", failed: "warning", dead: "danger" } as const;

/**
 * Domain events that could not be delivered (B1.3 outbox). Opens on the dead letters — the ones
 * a person has to look at — and replays one at a time, after reading why it failed.
 */
export function Outbox({ initial }: { initial: InitialPage<OutboxMessage> | null }) {
  const t = useTranslations("platform.outbox");
  const queryClient = useQueryClient();
  const [replaying, setReplaying] = useState<OutboxMessage | null>(null);

  const columns: DataTableColumn<OutboxMessage>[] = [
    { id: "occurredAt", header: t("columns.occurredAt"), sortable: true, cell: (row) => <When at={row.occurredAt} /> },
    { id: "type", header: t("columns.type"), cell: (row) => <span className="text-xs tabular-nums">{row.type}</span> },
    {
      id: "aggregate",
      header: t("columns.aggregate"),
      cell: (row) => <span className="text-xs">{shortRef(row.aggregateType, row.aggregateId)}</span>,
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <Badge
          size="sm"
          tone={TONES[row.status]}
          icon={row.status === "dead" ? "error" : row.status === "dispatched" ? "check" : "clock"}
        >
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    { id: "attempts", header: t("columns.attempts"), numeric: true, cell: (row) => row.attempts },
    {
      id: "lastError",
      header: t("columns.lastError"),
      cell: (row) => <span className="text-danger text-xs">{row.lastError ?? ""}</span>,
    },
    {
      id: "replay",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      hideable: false,
      className: "text-end",
      cell: (row) =>
        row.status === "dispatched" ? null : (
          <Button size="sm" variant="secondary" iconStart="refresh" onClick={() => setReplaying(row)}>
            {t("replay")}
          </Button>
        ),
    },
  ];

  return (
    <>
      <ResourceList
        resource={outboxList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        savedViews={false}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) })),
          },
        ]}
        rowTone={(row) => (row.status === "dead" ? "danger" : undefined)}
        empty={{ title: t("empty"), description: t("emptyBody") }}
      />
      <ConfirmAction
        open={replaying !== null}
        onOpenChange={(open) => (open ? undefined : setReplaying(null))}
        title={t("replayTitle", { type: replaying?.type ?? "" })}
        description={t("replayBody", { error: replaying?.lastError ?? "—" })}
        confirmLabel={t("replay")}
        onConfirm={async () => {
          try {
            await adminBrowserApis().contract.POST("/v1/admin/outbox/{eventId}/actions/replay", {
              params: { path: { eventId: replaying!.eventId } },
            });
            toast.success(t("replayed"));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "outbox") });
          } catch (error) {
            toast.error(problemMessage(error, t("replayFailed")));
            throw error;
          }
        }}
      />
    </>
  );
}
