"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_APPLICATION_STATUS } from "@/domain/status";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  QueueTabs,
  ResourceList,
  Section,
  StatusChip,
  useCan,
  type InitialPage,
} from "../console";
import { APPLICATION_STATUSES, applicationsList, type AgentApplication } from "./resources";
import { planOptions, TermsList, usePlans, useRefreshAgents } from "./shared";

/** Applications to become a freelance agent, oldest waiting first (D-416). */
export function ApplicationsQueue({ initial }: { initial: InitialPage<AgentApplication> | null }) {
  const t = useTranslations("agents.applications");
  const tStatus = useTranslations("status");
  const tJuristic = useTranslations("agents.juristic");

  const columns: DataTableColumn<AgentApplication>[] = [
    {
      id: "legalName",
      header: t("columns.applicant"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link href={`/agents/applications/${row.id}`} className="text-primary truncate font-medium hover:underline">
            {row.legalName}
          </Link>
          <span className="text-muted text-xs">{tJuristic(row.juristicType)}</span>
        </div>
      ),
    },
    {
      id: "contact",
      header: t("columns.contact"),
      cell: (row) => <span className="text-sm">{[row.phone, row.email].filter(Boolean).join(" · ") || "–"}</span>,
    },
    {
      id: "checks",
      header: t("columns.checks"),
      cell: (row) =>
        row.checks.length ? (
          <Badge size="sm" tone="warning" icon="shield-alert">
            {t("checksCount", { count: row.checks.length })}
          </Badge>
        ) : (
          <span className="text-muted text-sm">{t("noChecks")}</span>
        ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={AGENT_APPLICATION_STATUS} value={row.status} />,
    },
    { id: "submittedAt", header: t("columns.submitted"), cell: (row) => <When at={row.submittedAt} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...APPLICATION_STATUSES.map((status) => ({
            value: status,
            label: tStatus(AGENT_APPLICATION_STATUS[status].labelKey),
          })),
        ]}
      />
      <ResourceList
        resource={applicationsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        rowHref={(row) => `/agents/applications/${row.id}`}
        rowTone={(row) => (row.status === "submitted" && row.checks.length ? "warning" : undefined)}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}

/** Opens a stored file (identity card, bank book) through a short-lived link. */
function FileButton({ fileId, name }: { fileId: string; name: string }) {
  const t = useTranslations("agents.application");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      iconStart="external"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await adminBrowserApis().contract.GET("/v1/admin/files/{fileId}/download", {
            params: { path: { fileId } },
          });
          window.open(data!.url, "_blank", "noopener");
        } catch (error) {
          toast.error(problemMessage(error, t("fileFailed")));
        } finally {
          setBusy(false);
        }
      }}
    >
      {name}
    </Button>
  );
}

/**
 * One application (D-416): who they are for tax, where to pay them, their documents and the
 * agreement version they accepted, with the API's checks — an id already used by another agent,
 * a bank account shared with a customer. Approving puts them on a freelance plan, makes them a
 * vendor for withholding tax and proposes their bank account for Finance to approve.
 */
export function ApplicationReview({ applicationId }: { applicationId: string }) {
  const t = useTranslations("agents.application");
  const tJuristic = useTranslations("agents.juristic");
  const format = useFormat();
  const router = useRouter();
  const refresh = useRefreshAgents();
  const canManage = useCan("agents.manage");
  const plans = usePlans();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [planId, setPlanId] = useState("");
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: queryKeys.detail("admin", "agent_application", applicationId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/agent-applications/{applicationId}", {
          params: { path: { applicationId } },
        })
      ).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const app = query.data;
  if (!app) return null;

  const options = planOptions(plans.data, "freelance");
  const plan = planId || options[0]?.value || "";
  const chosen = plans.data?.find((p) => p.id === plan);
  const open = app.status === "submitted";

  const rows: [string, React.ReactNode][] = [
    [t("juristicType"), tJuristic(app.juristicType)],
    [
      t("taxId"),
      <span key="taxId" className="font-mono">
        {app.taxId}
      </span>,
    ],
    [t("branch"), app.branchCode],
    [t("vat"), app.isVatRegistered ? t("yes") : t("no")],
    [t("address"), `${app.address} ${app.postcode}`],
    [t("phone"), app.phone ?? "–"],
    [t("email"), app.email ?? "–"],
    [t("account"), app.user.displayName],
  ];
  const bank: [string, React.ReactNode][] = [
    [t("bank"), app.bankCode],
    [t("bankBranch"), app.bankBranchName ?? "–"],
    [t("bankAccountName"), app.bankAccountName],
    [
      t("bankAccountNo"),
      <span key="accountNo" className="font-mono">
        {t("accountMasked", { last4: app.bankAccountNoLast4 })}
      </span>,
    ],
  ];
  const list = (items: [string, React.ReactNode][]) => (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([term, value]) => (
        <div key={term} className="flex flex-col">
          <dt className="text-muted text-xs">{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("applications"), href: "/agents/applications" }, { label: app.legalName }]}
          />
        }
        title={app.legalName}
        meta={
          <>
            <StatusChip map={AGENT_APPLICATION_STATUS} value={app.status} size="md" />
            <span className="text-muted text-sm">{t("submittedAt", { date: format.dateTime(app.submittedAt) })}</span>
          </>
        }
        actions={
          open && canManage ? (
            <>
              <Button variant="ghost" onClick={() => setRejecting(true)}>
                {t("reject")}
              </Button>
              <Button iconStart="check" onClick={() => setApproving(true)}>
                {t("approve")}
              </Button>
            </>
          ) : app.agentId ? (
            <Button variant="secondary" asChild>
              <Link href={`/agents/${app.agentId}`}>{t("openAgent")}</Link>
            </Button>
          ) : null
        }
      />

      {app.checks.length ? (
        <Callout tone="warning" title={t("checksTitle")}>
          <ul className="list-disc ps-5">
            {app.checks.map((check) => (
              <li key={check}>{t.has(`checks.${check}`) ? t(`checks.${check}`) : check}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {app.decisionReason ? (
        <Callout tone={app.status === "rejected" ? "danger" : "info"} title={t("decision")}>
          {app.decisionReason}
          {app.decidedBy ? (
            <p className="text-muted mt-1 text-xs">
              {app.decidedBy.displayName} · {app.decidedAt ? format.dateTime(app.decidedAt) : null}
            </p>
          ) : null}
        </Callout>
      ) : null}

      <Section title={t("who")}>{list(rows)}</Section>
      <Section title={t("payment")} description={t("paymentNote")}>
        {list(bank)}
      </Section>
      <Section title={t("documents")}>
        <div className="flex flex-wrap gap-2">
          <FileButton fileId={app.idDocument.id} name={t("idDocument")} />
          {app.bankBook ? <FileButton fileId={app.bankBook.id} name={t("bankBook")} /> : null}
        </div>
        <p className="text-muted mt-2 text-sm">
          {t("agreement", {
            version: app.agreementVersionNo,
            date: format.dateTime(app.agreementAcceptedAt),
          })}
        </p>
      </Section>
      {app.pitch ? (
        <Section title={t("pitch")}>
          <p className="text-sm whitespace-pre-line">{app.pitch}</p>
        </Section>
      ) : null}

      {approving ? (
        <FormDialog
          title={t("approveTitle")}
          description={t("approveBody", { name: app.legalName })}
          submitLabel={t("approve")}
          onClose={() => setApproving(false)}
          onSubmit={async () => {
            if (!plan) throw new FormError(t("needPlan"));
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/agent-applications/{applicationId}/actions/approve",
              { params: { path: { applicationId } }, body: { planId: plan, note: note.trim() || null } },
            );
            refresh();
            toast.success(t("approved", { code: data!.code }));
            router.push(`/agents/${data!.id}`);
          }}
        >
          <Field label={t("plan")} required>
            <SearchableSelect value={plan} onValueChange={setPlanId} options={options} />
          </Field>
          {chosen?.current ? <TermsList terms={chosen.current} /> : null}
          <Field label={t("note")} hint={t("noteHint")}>
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}

      <ConfirmAction
        open={rejecting}
        onOpenChange={setRejecting}
        title={t("rejectTitle")}
        description={t("rejectBody", { name: app.legalName })}
        confirmLabel={t("reject")}
        tone="destructive"
        reason={{ label: t("reason"), required: true, minLength: 3, hint: t("rejectHint") }}
        onConfirm={async ({ reason }) => {
          try {
            await adminBrowserApis().contract.POST("/v1/admin/agent-applications/{applicationId}/actions/reject", {
              params: { path: { applicationId } },
              body: { reason },
            });
            refresh();
            void query.refetch();
            toast.success(t("rejected"));
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}
