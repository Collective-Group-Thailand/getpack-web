"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_TAX_DECLARATION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
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
import { TAX_DECLARATION_STATUSES, taxDeclarationsList, type AgentTaxDeclaration } from "./resources";
import { useRefreshAgents } from "./shared";

/** ล.ย.01 allowance declarations waiting for Finance, newest first (D-465). */
export function TaxDeclarationsQueue({ initial }: { initial: InitialPage<AgentTaxDeclaration> | null }) {
  const t = useTranslations("agents.taxDeclarations");
  const tStatus = useTranslations("status");
  const format = useFormat();

  const columns: DataTableColumn<AgentTaxDeclaration>[] = [
    {
      id: "agent",
      header: t("columns.agent"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link href={`/agents/tax-declarations/${row.id}`} className="text-primary truncate font-medium hover:underline">
            {row.agent.legalName}
          </Link>
          <span className="text-muted text-xs tabular-nums">{row.agent.code}</span>
        </div>
      ),
    },
    { id: "taxYear", header: t("columns.taxYear"), cell: (row) => <span className="tabular-nums">{row.taxYear}</span> },
    {
      id: "total",
      header: t("columns.total"),
      cell: (row) => <span className="tabular-nums">{format.thb(row.allowancesTotal)}</span>,
    },
    {
      id: "evidence",
      header: t("columns.evidence"),
      cell: (row) => <span className="text-sm">{t("evidenceCount", { count: row.evidenceCount })}</span>,
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={AGENT_TAX_DECLARATION_STATUS} value={row.status} />,
    },
    { id: "submittedAt", header: t("columns.submitted"), cell: (row) => <When at={row.submittedAt} /> },
  ];

  return (
    <ResourceList
      views={
        <QueueTabs
          countFrom={taxDeclarationsList}
          hideEmpty
          label={t("statusesLabel")}
          param="status"
          tabs={[
            { value: null, label: t("all") },
            ...TAX_DECLARATION_STATUSES.map((status) => ({
              value: status,
              label: tStatus(AGENT_TAX_DECLARATION_STATUS[status].labelKey),
            })),
          ]}
        />
      }
      resource={taxDeclarationsList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      rowHref={(row) => `/agents/tax-declarations/${row.id}`}
      rowTone={(row) => (row.status === "submitted" ? "warning" : undefined)}
      empty={{ title: t("empty") }}
    />
  );
}

/**
 * One ล.ย.01 (D-465): the allowances by group with the agent's evidence. Accepting makes them count in the next
 * statement's progressive withholding of that tax year; a rejection needs a reason the agent reads.
 */
export function TaxDeclarationReview({ declarationId }: { declarationId: string }) {
  const t = useTranslations("agents.taxDeclarations");
  const tField = useTranslations("agents.taxDeclarations.fields");
  const format = useFormat();
  const refresh = useRefreshAgents();
  const canReview = useCan("agent_tax_declarations.review");
  const [deciding, setDeciding] = useState<"accepted" | "rejected" | null>(null);

  const query = useQuery({
    queryKey: queryKeys.detail("admin", "agent_tax_declaration", declarationId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/agent-tax-declarations/{declarationId}", {
          params: { path: { declarationId } },
        })
      ).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;
  if (!d) return <DetailSkeleton />;
  const open = d.status === "submitted" && canReview;
  const allowances = Object.entries(d.allowances as Record<string, string>);

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <PageHeader
        back={{ href: "/agents/tax-declarations", label: t("title") }}
        title={d.agent.legalName}
        meta={
          <>
            <StatusChip map={AGENT_TAX_DECLARATION_STATUS} value={d.status} size="md" />
            <span className="text-muted text-sm">{t("yearOf", { year: d.taxYear })}</span>
          </>
        }
        description={
          <Link href={`/agents/${d.agent.id}`} className="text-primary tabular-nums hover:underline">
            {d.agent.code}
          </Link>
        }
      />
      <DetailLayout
        aside={
          <ActionPanel
            id="tax-declaration-decision"
            tone={open ? "primary" : "neutral"}
            title={open ? t("decidePanel") : t("decision")}
            description={
              d.decidedAt ? (
                <>
                  {d.decisionReason ? <p className="whitespace-pre-line">{d.decisionReason}</p> : null}
                  <p className="mt-1 text-xs">
                    {d.decidedBy?.displayName} · {format.dateTime(d.decidedAt)}
                  </p>
                </>
              ) : (
                t("decideHint")
              )
            }
          >
            {open ? (
              <div data-fill="row" className="flex flex-col gap-2">
                <Button iconStart="check" onClick={() => setDeciding("accepted")}>
                  {t("accept")}
                </Button>
                <Button variant="ghost" className="text-danger" onClick={() => setDeciding("rejected")}>
                  {t("reject")}
                </Button>
              </div>
            ) : null}
          </ActionPanel>
        }
      >
        <Section title={t("allowances")} description={t("allowancesNote")}>
          {allowances.length ? (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {allowances.map(([key, amount]) => (
                <div key={key} className="flex justify-between gap-3 border-b py-1">
                  <dt className="text-muted">{tField.has(key) ? tField(key) : key}</dt>
                  <dd className="font-medium tabular-nums">{format.thb(amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 py-1 sm:col-span-2">
                <dt className="font-semibold">{t("columns.total")}</dt>
                <dd className="font-semibold tabular-nums">{format.thb(d.allowancesTotal)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted text-sm">{t("noAllowances")}</p>
          )}
        </Section>
        <Section title={t("columns.evidence")}>
          {d.evidence.length ? (
            <ul className="flex flex-wrap gap-2">
              {d.evidence.map((file) => (
                <li key={file.fileId}>
                  {file.url ? (
                    <Button size="sm" variant="secondary" iconStart="external" asChild>
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        {file.fileName}
                      </a>
                    </Button>
                  ) : (
                    <span className="text-muted text-sm">{file.fileName}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Callout tone="warning" title={t("noEvidence")} />
          )}
        </Section>
      </DetailLayout>

      <ConfirmAction
        open={deciding !== null}
        onOpenChange={(next) => (next ? undefined : setDeciding(null))}
        title={deciding === "rejected" ? t("rejectTitle") : t("acceptTitle")}
        description={
          deciding === "rejected"
            ? t("rejectBody", { name: d.agent.legalName })
            : t("acceptBody", { name: d.agent.legalName, amount: format.thb(d.allowancesTotal), year: d.taxYear })
        }
        confirmLabel={deciding === "rejected" ? t("reject") : t("accept")}
        tone={deciding === "rejected" ? "destructive" : "primary"}
        reason={deciding === "rejected" ? { label: t("reason"), required: true, minLength: 3 } : undefined}
        onConfirm={async ({ reason }) => {
          try {
            await adminBrowserApis().contract.POST("/v1/admin/agent-tax-declarations/{declarationId}/actions/decide", {
              params: { path: { declarationId } },
              body: { decision: deciding!, reason: reason ?? null },
            });
            refresh();
            void query.refetch();
            toast.success(t(deciding === "rejected" ? "rejected" : "accepted"));
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}
