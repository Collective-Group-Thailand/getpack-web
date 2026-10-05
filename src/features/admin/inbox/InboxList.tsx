"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { CONVERSATION_SLA, CONVERSATION_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { inboxList, type Conversation } from "./resources";

/**
 * The CS inbox (U5.3 §3, D-300, D-221): every customer conversation — the support chat and the
 * threads about orders, designs, RFQs and baskets, from the web and LINE — latest activity first,
 * with the first-response clock. Queues: overdue first, then waiting, mine, unassigned.
 */
export function InboxList({ initial }: { initial: InitialPage<Conversation> | null }) {
  const t = useTranslations("cs.inbox");
  const tStatus = useTranslations("status");

  const columns: DataTableColumn<Conversation>[] = [
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/inbox/${row.id}`} className="text-primary font-medium hover:underline">
            {row.customer?.displayName ?? row.lineDisplayName ?? t("unknownCustomer")}
          </Link>
          <p className="text-muted truncate text-xs">{row.lastMessage ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "subject",
      header: t("columns.subject"),
      cell: (row) => (row.subject ? `${t(`subjects.${row.subjectType}`)} ${row.subject.label}` : t("subjects.support")),
    },
    { id: "channel", header: t("columns.channel"), cell: (row) => t(`channels.${row.channel}`) },
    {
      id: "sla",
      header: t("columns.sla"),
      cell: (row) => (row.sla.state ? <StatusChip map={CONVERSATION_SLA} value={row.sla.state} /> : "—"),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={CONVERSATION_STATUS} value={row.status} />,
    },
    { id: "assignee", header: t("columns.assignee"), cell: (row) => row.assignee?.displayName ?? t("unassigned") },
    { id: "lastMessageAt", header: t("columns.last"), cell: (row) => <When at={row.lastMessageAt} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("queuesLabel")}
        param="sla"
        tabs={[
          { value: null, label: t("all") },
          { value: "overdue", label: tStatus(CONVERSATION_SLA.overdue.labelKey) },
          { value: "waiting", label: tStatus(CONVERSATION_SLA.waiting.labelKey) },
          { value: "answered", label: tStatus(CONVERSATION_SLA.answered.labelKey) },
        ]}
      />
      <ResourceList
        resource={inboxList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        filters={[
          {
            id: "assigned",
            label: t("filters.assigned"),
            kind: "select",
            options: [
              { value: "me", label: t("mine") },
              { value: "unassigned", label: t("unassigned") },
            ],
          },
          {
            id: "status",
            label: t("filters.status"),
            kind: "select",
            options: (["open", "pending", "closed"] as const).map((value) => ({
              value,
              label: tStatus(CONVERSATION_STATUS[value].labelKey),
            })),
          },
          {
            id: "subjectType",
            label: t("filters.subject"),
            kind: "select",
            options: (["support", "order", "design", "rfq", "rfq_basket"] as const).map((value) => ({
              value,
              label: t(`subjects.${value}`),
            })),
          },
        ]}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
