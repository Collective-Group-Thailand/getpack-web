"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { displayPhone } from "@/features/shared/sales/phone";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { ErrorState } from "@/ui/components/ErrorState";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, download, problemMessage, ResourceList, useCan, type InitialPage } from "../console";
import { waitlistList, type AgentWaitlistEntry } from "./resources";

/**
 * The agent programme's waiting list (P7 pilot switch): people who asked to hear when sign-up opens, newest first,
 * with the consent they gave on the public form. Personal data — Sales Manager, C-Level and Superadmin only
 * (`agent_waitlist.read`); the export is a signed CSV link the API writes and audits.
 */
export function WaitlistList({ initial }: { initial: InitialPage<AgentWaitlistEntry> | null }) {
  const t = useTranslations("agents.waitlist");
  const tErrors = useTranslations("common.errors");
  const tChannels = useTranslations("agents.channels");
  const format = useFormat();
  const canRead = useCan("agent_waitlist.read");
  const [exporting, setExporting] = useState(false);

  if (!canRead) return <ErrorState title={tErrors("forbiddenTitle")} description={tErrors("forbiddenBody")} />;

  async function exportCsv() {
    setExporting(true);
    try {
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/agent-waitlist/actions/export");
      download(data!.url);
      toast.success(t("exported", { rows: data!.rows }));
    } catch (error) {
      toast.error(problemMessage(error, t("exportFailed")));
    } finally {
      setExporting(false);
    }
  }

  const columns: DataTableColumn<AgentWaitlistEntry>[] = [
    { id: "name", header: t("columns.name"), cell: (row) => <span className="font-medium">{row.name}</span> },
    {
      id: "contact",
      header: t("columns.contact"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          {row.phone ? <span className="tabular-nums">{displayPhone(row.phone)}</span> : null}
          {row.email ? <span className="text-muted truncate text-xs">{row.email}</span> : null}
        </div>
      ),
    },
    {
      id: "channel",
      header: t("columns.channel"),
      cell: (row) => (row.salesChannel ? tChannels(row.salesChannel) : <span className="text-muted">—</span>),
    },
    { id: "joinCount", header: t("columns.joinCount"), numeric: true, cell: (row) => format.number(row.joinCount) },
    { id: "createdAt", header: t("columns.createdAt"), cell: (row) => format.dateTime(row.createdAt) },
    {
      id: "lastJoinedAt",
      header: t("columns.lastJoinedAt"),
      hideable: true,
      cell: (row) => format.dateTime(row.lastJoinedAt),
    },
  ];

  return (
    <ResourceList
      resource={waitlistList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      toolbarEnd={
        <Button variant="secondary" iconStart="download" loading={exporting} onClick={() => void exportCsv()}>
          {t("export")}
        </Button>
      }
      empty={{ title: t("empty"), description: t("emptyBody") }}
    />
  );
}
