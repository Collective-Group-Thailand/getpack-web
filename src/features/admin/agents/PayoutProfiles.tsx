"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_PAYOUT_PROFILE_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { PageHeader } from "@/ui/components/PageHeader";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  problemMessage,
  QueryError,
  QueueTabs,
  ResourceList,
  Section,
  StatusChip,
  useCan,
  type InitialPage,
} from "../console";
import { DetailSkeleton } from "../console/DetailSkeleton";
import { FileButton } from "./Applications";
import { PAYOUT_PROFILE_STATUSES, payoutProfilesList, type AgentPayoutProfile } from "./resources";
import { useRefreshAgents } from "./shared";

/** Agents' payout profiles waiting for Finance, newest first (D-466 step 2). */
export function PayoutProfilesQueue({ initial }: { initial: InitialPage<AgentPayoutProfile> | null }) {
  const t = useTranslations("agents.payoutProfiles");
  const tStatus = useTranslations("status");

  const columns: DataTableColumn<AgentPayoutProfile>[] = [
    {
      id: "agent",
      header: t("columns.agent"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/agents/payout-profiles/${row.id}`}
            className="text-primary truncate font-medium hover:underline"
          >
            {row.legalName ?? row.agent.legalName}
          </Link>
          <span className="text-muted text-xs tabular-nums">{row.agent.code}</span>
        </div>
      ),
    },
    {
      id: "bank",
      header: t("columns.bank"),
      cell: (row) =>
        row.bankAccountNoLast4 ? (
          <span className="text-sm tabular-nums">
            {row.bankCode} · {t("accountMasked", { last4: row.bankAccountNoLast4 })}
          </span>
        ) : (
          "–"
        ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={AGENT_PAYOUT_PROFILE_STATUS} value={row.status} />,
    },
    {
      id: "submittedAt",
      header: t("columns.submitted"),
      cell: (row) => (row.submittedAt ? <When at={row.submittedAt} /> : "–"),
    },
  ];

  return (
    <ResourceList
      views={
        <QueueTabs
          countFrom={payoutProfilesList}
          hideEmpty
          label={t("statusesLabel")}
          param="status"
          tabs={[
            { value: null, label: t("all") },
            ...PAYOUT_PROFILE_STATUSES.map((status) => ({
              value: status,
              label: tStatus(AGENT_PAYOUT_PROFILE_STATUS[status].labelKey),
            })),
          ]}
        />
      }
      resource={payoutProfilesList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      rowHref={(row) => `/agents/payout-profiles/${row.id}`}
      rowTone={(row) => (row.status === "submitted" ? "warning" : undefined)}
      empty={{ title: t("empty") }}
    />
  );
}

/**
 * One payout profile (D-466): who the agent is paid as, the documents, the bank account (last four only). Verifying
 * creates or updates the agent's vendor and proposes the bank account through the existing dual approval; a
 * rejection needs a reason the agent reads.
 */
export function PayoutProfileReview({ payoutProfileId }: { payoutProfileId: string }) {
  const t = useTranslations("agents.payoutProfiles");
  const tApp = useTranslations("agents.application");
  const format = useFormat();
  const refresh = useRefreshAgents();
  const canVerify = useCan("agent_payout_profiles.verify");
  const [deciding, setDeciding] = useState<"verify" | "reject" | null>(null);

  const query = useQuery({
    queryKey: queryKeys.detail("admin", "agent_payout_profile", payoutProfileId),
    queryFn: async () => {
      const result = await adminBrowserApis().contract.GET("/v1/admin/agent-payout-profiles/{payoutProfileId}", {
        params: { path: { payoutProfileId } },
      });
      return { data: result.data!, etag: result.response.headers.get("ETag") };
    },
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <DetailSkeleton />;
  const { data: p, etag } = query.data;
  const open = p.status === "submitted" && canVerify;
  const name = p.legalName ?? p.agent.legalName;

  const rows: [string, React.ReactNode][] = [
    [
      tApp("taxId"),
      <span key="taxId" className="tabular-nums">
        {p.taxId ?? "–"}
      </span>,
    ],
    [tApp("branch"), p.branchCode],
    [tApp("vat"), p.isVatRegistered ? tApp("yes") : tApp("no")],
    [tApp("address"), p.address ? `${p.address} ${p.postcode ?? ""}` : "–"],
    [tApp("bank"), p.bankCode ?? "–"],
    [tApp("bankBranch"), p.bankBranchName ?? "–"],
    [tApp("bankAccountName"), p.bankAccountName ?? "–"],
    [
      tApp("bankAccountNo"),
      <span key="no" className="tabular-nums">
        {p.bankAccountNoLast4 ? tApp("accountMasked", { last4: p.bankAccountNoLast4 }) : "–"}
      </span>,
    ],
  ];

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <PageHeader
        back={{ href: "/agents/payout-profiles", label: t("title") }}
        title={name}
        meta={<StatusChip map={AGENT_PAYOUT_PROFILE_STATUS} value={p.status} size="md" />}
        description={
          <Link href={`/agents/${p.agent.id}`} className="text-primary tabular-nums hover:underline">
            {p.agent.code}
          </Link>
        }
      />
      <DetailLayout
        aside={
          <ActionPanel
            id="payout-profile-decision"
            tone={open ? "primary" : "neutral"}
            title={open ? t("decidePanel") : t("decision")}
            description={
              p.verifiedAt ? (
                <p className="text-xs">
                  {p.verifiedBy?.displayName} · {format.dateTime(p.verifiedAt)}
                </p>
              ) : p.rejectReason ? (
                <p className="whitespace-pre-line">{p.rejectReason}</p>
              ) : (
                t("decideHint")
              )
            }
          >
            {open ? (
              <div data-fill="row" className="flex flex-col gap-2">
                <Button iconStart="check" onClick={() => setDeciding("verify")}>
                  {t("verify")}
                </Button>
                <Button variant="ghost" className="text-danger" onClick={() => setDeciding("reject")}>
                  {t("reject")}
                </Button>
              </div>
            ) : null}
          </ActionPanel>
        }
      >
        <Section title={t("details")} description={t("detailsNote")}>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {rows.map(([term, value]) => (
              <div key={term} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-muted text-xs">{term}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section title={tApp("documents")}>
          <div className="flex flex-wrap gap-2">
            {p.idDocument ? <FileButton fileId={p.idDocument.id} name={tApp("idDocument")} /> : null}
            {p.bankBook ? <FileButton fileId={p.bankBook.id} name={tApp("bankBook")} /> : null}
            {!p.idDocument && !p.bankBook ? <p className="text-muted text-sm">–</p> : null}
          </div>
        </Section>
      </DetailLayout>

      <ConfirmAction
        open={deciding !== null}
        onOpenChange={(next) => (next ? undefined : setDeciding(null))}
        title={deciding === "reject" ? t("rejectTitle") : t("verifyTitle")}
        description={deciding === "reject" ? t("rejectBody", { name }) : t("verifyBody", { name })}
        confirmLabel={deciding === "reject" ? t("reject") : t("verify")}
        tone={deciding === "reject" ? "destructive" : "primary"}
        reason={deciding === "reject" ? { label: t("reason"), required: true, minLength: 3 } : undefined}
        onConfirm={async ({ reason }) => {
          try {
            const api = adminBrowserApis().contract;
            if (deciding === "reject") {
              await api.POST("/v1/admin/agent-payout-profiles/{payoutProfileId}/actions/reject", {
                params: { path: { payoutProfileId } },
                body: { reason: reason! },
              });
            } else {
              await api.POST("/v1/admin/agent-payout-profiles/{payoutProfileId}/actions/verify", {
                params: { path: { payoutProfileId }, header: { "If-Match": etag ?? "" } },
              });
            }
            refresh();
            void query.refetch();
            toast.success(t(deciding === "reject" ? "rejected" : "verified"));
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}
