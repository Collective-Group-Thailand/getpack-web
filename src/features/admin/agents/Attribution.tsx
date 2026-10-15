"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_FACTORY_LINK_STATUS, AGENT_LEAD_STATUS, AGENT_LINK_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import type { ComboboxOption } from "@/ui/components/Combobox";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueueTabs,
  ResourceList,
  StatusChip,
  useCan,
  type InitialPage,
} from "../console";
import { RecordPicker } from "./Pickers";
import {
  FACTORY_LINK_STATUSES,
  factoryLinksList,
  LEAD_KINDS,
  LEAD_STATUSES,
  leadsList,
  LINK_STATUSES,
  linksList,
  type AgentFactoryLink,
  type AgentLead,
  type AgentLink,
} from "./resources";
import { AgentCell, useRefreshAgents } from "./shared";

/** A row action that ends or releases something, with the reason the API records. */
function EndButton({
  label,
  title,
  body,
  done,
  run,
}: {
  label: string;
  title: string;
  body: string;
  done: string;
  run: (reason: string) => Promise<unknown>;
}) {
  const t = useTranslations("agents");
  const refresh = useRefreshAgents();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={body}
        confirmLabel={label}
        tone="destructive"
        reason={{ label: t("reason"), required: true, minLength: 3 }}
        onConfirm={async ({ reason }) => {
          try {
            await run(reason);
            refresh();
            toast.success(done);
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </>
  );
}

/**
 * Who is attributed to whom (D-417): a customer or company is an agent's for the plan's months
 * after they signed up through the agent's link, converted from the agent's protected lead, or
 * were assigned here. Commission accrues on their completed orders while the link is active.
 */
export function LinksList({ initial }: { initial: InitialPage<AgentLink> | null }) {
  const t = useTranslations("agents.links");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canManage = useCan("agents.manage");
  const [assigning, setAssigning] = useState(false);

  const columns: DataTableColumn<AgentLink>[] = [
    {
      id: "name",
      header: t("columns.customer"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          {row.customer ? (
            <Link href={`/customers/${row.customer.id}`} className="text-primary truncate hover:underline">
              {row.name}
            </Link>
          ) : row.companyId ? (
            <Link href={`/companies/${row.companyId}`} className="text-primary truncate hover:underline">
              {row.name}
            </Link>
          ) : (
            row.name
          )}
          <span className="text-muted text-xs">{t(`subjects.${row.subject}`)}</span>
        </div>
      ),
    },
    { id: "agent", header: t("columns.agent"), cell: (row) => <AgentCell agent={row.agent} /> },
    { id: "source", header: t("columns.source"), cell: (row) => t(`sources.${row.source}`) },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={AGENT_LINK_STATUS} value={row.status} />,
    },
    { id: "orders", header: t("columns.orders"), numeric: true, cell: (row) => format.number(row.orders) },
    { id: "commission", header: t("columns.commission"), numeric: true, cell: (row) => format.thb(row.commission) },
    { id: "attributedAt", header: t("columns.since"), hideable: true, cell: (row) => format.date(row.attributedAt) },
    {
      id: "endsAt",
      header: t("columns.until"),
      cell: (row) =>
        row.endedAt ? <span className="text-muted">{format.date(row.endedAt)}</span> : format.date(row.endsAt),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) =>
        canManage && row.status === "active" ? (
          <EndButton
            label={t("end")}
            title={t("endTitle")}
            body={t("endBody", { name: row.name, agent: row.agent.legalName })}
            done={t("ended")}
            run={(reason) =>
              adminBrowserApis().contract.POST("/v1/admin/agent-links/{linkId}/actions/end", {
                params: { path: { linkId: row.id } },
                body: { reason },
              })
            }
          />
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...LINK_STATUSES.map((status) => ({ value: status, label: tStatus(AGENT_LINK_STATUS[status].labelKey) })),
        ]}
      />
      <ResourceList
        resource={linksList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        toolbarEnd={
          canManage ? (
            <Button iconStart="link" onClick={() => setAssigning(true)}>
              {t("assign")}
            </Button>
          ) : null
        }
        empty={{ title: t("empty") }}
      />
      {assigning ? <AssignDialog onClose={() => setAssigning(false)} /> : null}
    </div>
  );
}

/** Attributing a customer or company to an agent by hand (`admin.agentLinks.assign`), with the reason. */
function AssignDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("agents.assign");
  const refresh = useRefreshAgents();
  const [subject, setSubject] = useState<"customer" | "company">("customer");
  const [agent, setAgent] = useState<ComboboxOption | null>(null);
  const [target, setTarget] = useState<ComboboxOption | null>(null);
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!agent) throw new FormError(t("needAgent"));
        if (!target) throw new FormError(t(subject === "customer" ? "needCustomer" : "needCompany"));
        if (reason.trim().length < 3) throw new FormError(t("needReason"));
        await adminBrowserApis().contract.POST("/v1/admin/agent-links", {
          body: {
            agentId: agent.value,
            ...(subject === "customer" ? { customerId: target.value } : { companyId: target.value }),
            reason: reason.trim(),
          },
        });
        refresh();
        toast.success(t("done", { name: target.label, agent: agent.label }));
      }}
    >
      <Field label={t("agent")} required>
        <RecordPicker kind="agent" value={agent} onValueChange={setAgent} />
      </Field>
      <SegmentedControl
        label={t("subject")}
        value={subject}
        onValueChange={(value) => {
          setSubject(value as "customer" | "company");
          setTarget(null);
        }}
        options={(["customer", "company"] as const).map((value) => ({ value, label: t(`subjects.${value}`) }))}
      />
      <Field label={t(`subjects.${subject}`)} hint={t("targetHint")} required>
        <RecordPicker key={subject} kind={subject} value={target} onValueChange={setTarget} />
      </Field>
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

/**
 * Prospects agents registered (D-417): protected for the lead window so another agent cannot
 * claim them; converted when they sign up, their company activates or their factory is created.
 * Sales can release one — a duplicate, a dispute — with the reason.
 */
export function LeadsList({ initial }: { initial: InitialPage<AgentLead> | null }) {
  const t = useTranslations("agents.leads");
  const tStatus = useTranslations("status");
  const tKinds = useTranslations("agents.leadKinds");
  const format = useFormat();
  const canManage = useCan("agents.manage");

  const columns: DataTableColumn<AgentLead>[] = [
    {
      id: "contactName",
      header: t("columns.prospect"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{row.contactName}</span>
          <span className="text-muted text-xs">
            {[tKinds(row.kind), row.organisationName].filter(Boolean).join(" · ")}
          </span>
        </div>
      ),
    },
    {
      id: "contact",
      header: t("columns.contact"),
      cell: (row) => (
        <span className="text-sm">{[row.phone, row.email, row.taxId].filter(Boolean).join(" · ") || "–"}</span>
      ),
    },
    { id: "agent", header: t("columns.agent"), cell: (row) => <AgentCell agent={row.agent} /> },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={AGENT_LEAD_STATUS} value={row.status} />,
    },
    {
      id: "protectedUntil",
      header: t("columns.protectedUntil"),
      cell: (row) =>
        row.status === "registered" ? (
          format.date(row.protectedUntil)
        ) : row.convertedAt ? (
          <span className="text-muted text-sm">{t("convertedAt", { date: format.date(row.convertedAt) })}</span>
        ) : (
          <span className="text-muted text-sm">{row.closedReason ?? "–"}</span>
        ),
    },
    { id: "createdAt", header: t("columns.registered"), hideable: true, cell: (row) => <When at={row.createdAt} /> },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) =>
        canManage && row.status === "registered" ? (
          <EndButton
            label={t("release")}
            title={t("releaseTitle")}
            body={t("releaseBody", { name: row.contactName, agent: row.agent.legalName })}
            done={t("released")}
            run={(reason) =>
              adminBrowserApis().contract.POST("/v1/admin/agent-leads/{leadId}/actions/release", {
                params: { path: { leadId: row.id } },
                body: { reason },
              })
            }
          />
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...LEAD_STATUSES.map((status) => ({ value: status, label: tStatus(AGENT_LEAD_STATUS[status].labelKey) })),
        ]}
      />
      <ResourceList
        resource={leadsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        filters={[
          {
            id: "kind",
            label: t("columns.kind"),
            kind: "select",
            options: LEAD_KINDS.map((kind) => ({ value: kind, label: tKinds(kind) })),
          },
        ]}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}

/**
 * Factories agents brought in (D-419): the bounty is earned once the factory completes the plan's
 * qualifying jobs within its days. Partner managers can link a factory an agent introduced.
 */
export function FactoryLinksList({ initial }: { initial: InitialPage<AgentFactoryLink> | null }) {
  const t = useTranslations("agents.factories");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canLink = useCan("agents.manage", "partners.manage");
  const canEnd = useCan("agents.manage");
  const [linking, setLinking] = useState(false);

  const columns: DataTableColumn<AgentFactoryLink>[] = [
    {
      id: "factoryName",
      header: t("columns.factory"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link href={`/partners/${row.factoryId}`} className="text-primary truncate hover:underline">
            {row.factoryName}
          </Link>
          <span className="text-muted font-mono text-xs">{row.factoryCode}</span>
        </div>
      ),
    },
    { id: "agent", header: t("columns.agent"), cell: (row) => <AgentCell agent={row.agent} /> },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={AGENT_FACTORY_LINK_STATUS} value={row.status} />,
    },
    { id: "jobs", header: t("columns.jobs"), numeric: true, cell: (row) => format.number(row.completedJobs) },
    { id: "linkedAt", header: t("columns.linked"), cell: (row) => format.date(row.linkedAt) },
    {
      id: "qualifiedAt",
      header: t("columns.qualified"),
      hideable: true,
      cell: (row) => (row.qualifiedAt ? format.date(row.qualifiedAt) : "–"),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) =>
        canEnd && row.status === "pending" ? (
          <EndButton
            label={t("end")}
            title={t("endTitle")}
            body={t("endBody", { name: row.factoryName, agent: row.agent.legalName })}
            done={t("ended")}
            run={(reason) =>
              adminBrowserApis().contract.POST("/v1/admin/agent-factory-links/{factoryLinkId}/actions/end", {
                params: { path: { factoryLinkId: row.id } },
                body: { reason },
              })
            }
          />
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...FACTORY_LINK_STATUSES.map((status) => ({
            value: status,
            label: tStatus(AGENT_FACTORY_LINK_STATUS[status].labelKey),
          })),
        ]}
      />
      <ResourceList
        resource={factoryLinksList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        toolbarEnd={
          canLink ? (
            <Button iconStart="factory" onClick={() => setLinking(true)}>
              {t("link")}
            </Button>
          ) : null
        }
        empty={{ title: t("empty") }}
      />
      {linking ? <LinkFactoryDialog onClose={() => setLinking(false)} /> : null}
    </div>
  );
}

function LinkFactoryDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("agents.linkFactory");
  const refresh = useRefreshAgents();
  const [agent, setAgent] = useState<ComboboxOption | null>(null);
  const [factory, setFactory] = useState<ComboboxOption | null>(null);
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!agent) throw new FormError(t("needAgent"));
        if (!factory) throw new FormError(t("needFactory"));
        if (reason.trim().length < 3) throw new FormError(t("needReason"));
        await adminBrowserApis().contract.POST("/v1/admin/agent-factory-links", {
          body: { agentId: agent.value, factoryId: factory.value, reason: reason.trim() },
        });
        refresh();
        toast.success(t("done", { name: factory.label, agent: agent.label }));
      }}
    >
      <Field label={t("agent")} required>
        <RecordPicker kind="agent" value={agent} onValueChange={setAgent} />
      </Field>
      <Field label={t("factory")} required>
        <RecordPicker kind="factory" value={factory} onValueChange={setFactory} />
      </Field>
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </FormDialog>
  );
}
