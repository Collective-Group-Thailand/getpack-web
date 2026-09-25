"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { APPROVAL_STATUS, statusMeta } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { DataTable } from "@/ui/components/DataTable";
import { Dialog } from "@/ui/components/Dialog";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import {
  adminBrowserApis,
  problemMessage,
  QueryError,
  ResourceList,
  useActor,
  useCan,
  useRoleLabel,
  useSlaFormat,
  type InitialPage,
} from "../console";
import { CRITICAL_FLAGS, currentStep, POLICY_ICONS, type Approval } from "./presentation";
import { approvalsList, POLICIES } from "./resources";

export type ApprovalsTab = "inbox" | "all" | "delegations";

export function ApprovalsWorkspace({
  tab,
  initialInbox,
  initialAll,
}: {
  tab: ApprovalsTab;
  initialInbox: Approval[] | null;
  initialAll: InitialPage<Approval> | null;
}) {
  const t = useTranslations("approvals");
  const canAct = useCan("approvals.act");
  const tabs: { value: ApprovalsTab; label: string; href: string }[] = [
    ...(canAct ? [{ value: "inbox" as const, label: t("tabs.inbox"), href: "/approvals" }] : []),
    { value: "all", label: t("tabs.all"), href: canAct ? "/approvals?tab=all" : "/approvals" },
    { value: "delegations", label: t("tabs.delegations"), href: "/approvals?tab=delegations" },
  ];
  const active = tab === "inbox" && !canAct ? "all" : tab;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("tabs.label")} className="border-border flex gap-1 border-b">
        {tabs.map((item) => (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active === item.value ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              active === item.value ? "border-primary text-fg" : "text-muted hover:text-fg border-transparent",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {active === "inbox" ? <Inbox initial={initialInbox} /> : active === "all" ? <AllRequests initial={initialAll} /> : <Delegations />}
    </div>
  );
}

function usePolicyLabel() {
  const t = useTranslations("approvals.policies");
  return (policy: string) => (t.has(policy) ? t(policy) : policy);
}

/** What is waiting on me: the only list that is a queue, so it leads with the SLA. */
function Inbox({ initial }: { initial: Approval[] | null }) {
  const t = useTranslations("approvals");
  const format = useFormat();
  const sla = useSlaFormat();
  const policyLabel = usePolicyLabel();
  const roleLabel = useRoleLabel();

  const inbox = useQuery({
    queryKey: queryKeys.list("admin", "approval", { inbox: true }),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/approvals/inbox")).data!,
    initialData: initial ?? undefined,
    staleTime: STALE_TIME.live,
  });

  if (inbox.isError) return <QueryError error={inbox.error} onRetry={() => void inbox.refetch()} />;
  const items = [...(inbox.data ?? [])].sort(
    (a, b) => Date.parse(currentStep(a)?.dueAt ?? "9999") - Date.parse(currentStep(b)?.dueAt ?? "9999"),
  );
  if (!inbox.isPending && items.length === 0) {
    return <EmptyState icon="stamp" title={t("inboxEmptyTitle")} description={t("inboxEmptyBody")} />;
  }

  return (
    <ul className="flex flex-col gap-2" aria-label={t("tabs.inbox")}>
      {items.map((item) => {
        const step = currentStep(item);
        return (
          <li key={item.id}>
            <Link
              href={`/approvals/${item.id}`}
              className="border-border bg-surface hover:bg-surface-subtle flex flex-wrap items-center gap-4 rounded-lg border p-4"
            >
              <Icon name={POLICY_ICONS[item.policy] ?? "stamp"} size={20} className="text-muted" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {policyLabel(item.policy)}
                  {item.flags.map((flag) => (
                    <Badge key={flag} size="sm" tone={CRITICAL_FLAGS.has(flag) ? "danger" : "warning"} icon="warning">
                      {t.has(`flags.${flag}`) ? t(`flags.${flag}`) : flag}
                    </Badge>
                  ))}
                </p>
                <p className="text-muted text-sm">
                  {t("requestedBy", { name: item.requester.displayName })}
                  {step ? ` · ${t("stepOf", { no: step.stepNo, role: roleLabel(step.role) })}` : null}
                </p>
              </div>
              {item.amount ? <span className="font-medium tabular-nums">{format.thb(item.amount)}</span> : null}
              {item.pct ? <span className="text-muted tabular-nums">{format.percent(item.pct)}</span> : null}
              <SlaTimer dueAt={step?.dueAt ?? null} format={sla} absolute={step?.dueAt ? format.dateTime(step.dueAt) : undefined} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AllRequests({ initial }: { initial: InitialPage<Approval> | null }) {
  const t = useTranslations("approvals");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const policyLabel = usePolicyLabel();

  const columns: DataTableColumn<Approval>[] = [
    {
      id: "policy",
      header: t("columns.policy"),
      cell: (row) => (
        <Link href={`/approvals/${row.id}`} className="text-primary font-medium hover:underline">
          {policyLabel(row.policy)}
        </Link>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => {
        const meta = statusMeta(APPROVAL_STATUS, row.status);
        return <StatusBadge size="sm" meta={meta} label={tStatus(meta.labelKey)} />;
      },
    },
    { id: "requester", header: t("columns.requester"), cell: (row) => row.requester.displayName },
    { id: "amount", header: t("columns.amount"), numeric: true, cell: (row) => (row.amount ? format.thb(row.amount) : "—") },
    { id: "createdAt", header: t("columns.createdAt"), sortable: true, cell: (row) => <When at={row.createdAt} /> },
  ];

  return (
    <ResourceList
      resource={approvalsList}
      columns={columns}
      caption={t("tabs.all")}
      initial={initial}
      searchLabel={t("search")}
      filters={[
        {
          id: "status",
          label: t("columns.status"),
          kind: "select",
          options: Object.entries(APPROVAL_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
        },
        { id: "policy", label: t("columns.policy"), kind: "select", options: POLICIES.map((value) => ({ value, label: policyLabel(value) })) },
      ]}
    />
  );
}

type Delegation = Schemas["DelegationDto"];

/** Time-boxed delegations: while I am away, someone else approves on my behalf (ADR-0006). */
function Delegations() {
  const t = useTranslations("approvals.delegations");
  const tCommon = useTranslations("common");
  const policyLabel = usePolicyLabel();
  const actor = useActor();
  const queryClient = useQueryClient();
  const key = queryKeys.list("admin", "approval_delegation");
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: key,
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/approval-delegations")).data!,
  });

  const revoke = useMutation({
    mutationFn: async (delegationId: string) =>
      (await adminBrowserApis().contract.POST("/v1/admin/approval-delegations/{delegationId}/actions/revoke", {
        params: { path: { delegationId } },
      })).data,
    onSuccess: () => {
      toast.success(t("revoked"));
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => toast.error(problemMessage(error, t("revokeFailed"))),
  });

  const columns: DataTableColumn<Delegation>[] = [
    { id: "delegate", header: t("delegate"), cell: (row) => (row.delegator.id === actor.id ? row.delegate.displayName : t("from", { name: row.delegator.displayName })) },
    { id: "policy", header: t("policy"), cell: (row) => (row.policy ? policyLabel(row.policy) : t("allPolicies")) },
    { id: "validFrom", header: t("validFrom"), cell: (row) => <When at={row.validFrom} absoluteOnly /> },
    { id: "validTo", header: t("validTo"), cell: (row) => <When at={row.validTo} absoluteOnly /> },
    { id: "reason", header: t("reason"), cell: (row) => row.reason },
    {
      id: "state",
      header: t("state"),
      cell: (row) =>
        row.revokedAt ? (
          <Badge size="sm">{t("revokedState")}</Badge>
        ) : row.delegator.id === actor.id ? (
          <Button size="sm" variant="ghost" onClick={() => revoke.mutate(row.id)}>
            {t("revoke")}
          </Button>
        ) : (
          <Badge size="sm" tone="info">
            {t("activeState")}
          </Badge>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted text-sm">{t("explain")}</p>
        <Button size="sm" iconStart="plus" onClick={() => setCreating(true)}>
          {t("create")}
        </Button>
      </div>
      {list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={list.data ?? []}
          getRowId={(row) => row.id}
          loading={list.isPending}
          empty={<EmptyState icon="users" title={t("empty")} />}
        />
      )}
      {creating ? (
        <CreateDelegation
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            toast.success(t("created"));
            void queryClient.invalidateQueries({ queryKey: key });
          }}
          closeLabel={tCommon("actions.close")}
        />
      ) : null}
    </div>
  );
}

/** `datetime-local` gives wall-clock text; the API wants an instant, and Packio's wall clock is Bangkok. */
function bangkokInstant(local: string): string {
  return local.length === 16 ? `${local}:00+07:00` : local;
}

function CreateDelegation({ onClose, onCreated, closeLabel }: { onClose: () => void; onCreated: () => void; closeLabel: string }) {
  const t = useTranslations("approvals.delegations");
  const tCommon = useTranslations("common");
  const policyLabel = usePolicyLabel();
  const roleLabel = useRoleLabel();
  const actor = useActor();
  const [delegate, setDelegate] = useState<ComboboxOption | null>(null);
  const [query, setQuery] = useState("");
  const [policy, setPolicy] = useState("__all");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [reason, setReason] = useState("");

  const people = useQuery({
    queryKey: queryKeys.list("admin", "staff_directory", { q: query }),
    queryFn: () => browserRequests().call("GET /v1/admin/staff-directory", { query: { q: query || undefined, limit: 20 } }),
    staleTime: STALE_TIME.reference,
  });

  const create = useMutation({
    mutationFn: async () =>
      (await adminBrowserApis().contract.POST("/v1/admin/approval-delegations", {
        body: {
          delegateId: delegate!.value,
          reason: reason.trim(),
          validFrom: bangkokInstant(validFrom),
          validTo: bangkokInstant(validTo),
          ...(policy === "__all" ? {} : { policy }),
        },
      })).data,
    onSuccess: onCreated,
  });

  const ready = delegate && validFrom && validTo && reason.trim() && validTo > validFrom;

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("createTitle")}
      description={t("createDescription")}
      closeLabel={closeLabel}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!ready}>
            {t("create")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error ? <p className="text-danger text-sm">{problemMessage(create.error, t("createFailed"))}</p> : null}
        <Field label={t("delegate")} required requiredLabel={tCommon("state.required")}>
          <Combobox
            value={delegate}
            onValueChange={setDelegate}
            query={query}
            onQueryChange={setQuery}
            loading={people.isFetching}
            options={(people.data?.data ?? [])
              .filter((person) => person.id !== actor.id)
              .map((person) => ({ value: person.id, label: person.displayName, description: person.roles.map(roleLabel).join(", ") }))}
            placeholder={t("delegatePlaceholder")}
            labels={{ loading: tCommon("state.loading"), empty: t("noPeople"), clear: t("clearDelegate") }}
          />
        </Field>
        <Field label={t("policy")}>
          <Select
            value={policy}
            onValueChange={setPolicy}
            options={[{ value: "__all", label: t("allPolicies") }, ...POLICIES.map((value) => ({ value, label: policyLabel(value) }))]}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("validFrom")} required requiredLabel={tCommon("state.required")} hint={t("bangkokTime")}>
            <Input type="datetime-local" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
          </Field>
          <Field
            label={t("validTo")}
            required
            requiredLabel={tCommon("state.required")}
            error={validFrom && validTo && validTo <= validFrom ? t("endAfterStart") : undefined}
          >
            <Input type="datetime-local" value={validTo} onChange={(event) => setValidTo(event.target.value)} />
          </Field>
        </div>
        <Field label={t("reason")} required requiredLabel={tCommon("state.required")}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
        </Field>
      </div>
    </Dialog>
  );
}
