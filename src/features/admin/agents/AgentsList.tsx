"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AGENT_STATUS } from "@/domain/status";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { useFormat, When } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import type { ComboboxOption } from "@/ui/components/Combobox";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  FormDialog,
  FormError,
  QueueTabs,
  ResourceList,
  StatusChip,
  useCan,
  type InitialPage,
} from "../console";
import { RecordPicker } from "./Pickers";
import { AGENT_KINDS, AGENT_STATUSES, agentsList, type Agent } from "./resources";
import { KindBadge, planOptions, usePlans, useRefreshAgents } from "./shared";

/**
 * Every sales agent (D-416): freelance agents approved from an application and employees Sales
 * set up, with what they have brought in and what they are owed. An employee is created here from
 * their existing customer account — the account they sign in with to see their link and earnings.
 */
export function AgentsList({ initial }: { initial: InitialPage<Agent> | null }) {
  const t = useTranslations("agents.list");
  const tKinds = useTranslations("agents.kinds");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canManage = useCan("agents.manage");
  const [creating, setCreating] = useState(false);

  const columns: DataTableColumn<Agent>[] = [
    {
      id: "legalName",
      header: t("columns.agent"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link href={`/agents/${row.id}`} className="text-primary truncate font-medium hover:underline">
            {row.legalName}
          </Link>
          <span className="text-muted text-xs tabular-nums">{row.code}</span>
        </div>
      ),
    },
    { id: "kind", header: t("columns.kind"), cell: (row) => <KindBadge kind={row.kind} /> },
    { id: "status", header: t("columns.status"), cell: (row) => <StatusChip map={AGENT_STATUS} value={row.status} /> },
    { id: "plan", header: t("columns.plan"), hideable: true, cell: (row) => row.plan.nameTh },
    {
      id: "customers",
      header: t("columns.customers"),
      numeric: true,
      cell: (row) => format.number(row.totals.activeLinks),
    },
    {
      id: "pending",
      header: t("columns.pending"),
      numeric: true,
      cell: (row) => format.thb(row.totals.pending),
    },
    {
      id: "earned",
      header: t("columns.earned"),
      numeric: true,
      cell: (row) => format.thb(row.totals.earned),
    },
    {
      id: "paidThisYear",
      header: t("columns.paidThisYear"),
      numeric: true,
      hideable: true,
      cell: (row) => format.thb(row.totals.paidThisYear),
    },
    { id: "joinedAt", header: t("columns.joined"), hideable: true, cell: (row) => <When at={row.joinedAt} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...AGENT_STATUSES.map((status) => ({ value: status, label: tStatus(AGENT_STATUS[status].labelKey) })),
        ]}
      />
      <ResourceList
        resource={agentsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        searchPlaceholder={t("searchPlaceholder")}
        rowHref={(row) => `/agents/${row.id}`}
        rowTone={(row) => (row.status === "suspended" ? "warning" : undefined)}
        filters={[
          {
            id: "kind",
            label: t("columns.kind"),
            kind: "select",
            options: AGENT_KINDS.map((kind) => ({ value: kind, label: tKinds(kind) })),
          },
        ]}
        toolbarEnd={
          canManage ? (
            <Button iconStart="user-plus" onClick={() => setCreating(true)}>
              {t("createEmployee")}
            </Button>
          ) : null
        }
        empty={{ title: t("empty"), description: t("emptyHint") }}
      />
      {creating ? <CreateEmployeeDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

/** Making an employee an agent (`admin.agents.createEmployee`): no application, no WHT — payroll pays. */
function CreateEmployeeDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("agents.createEmployee");
  const router = useRouter();
  const refresh = useRefreshAgents();
  const plans = usePlans();
  const [customer, setCustomer] = useState<ComboboxOption | null>(null);
  const [staff, setStaff] = useState<ComboboxOption | null>(null);
  const [legalName, setLegalName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const options = planOptions(plans.data, "employee");
  const [planId, setPlanId] = useState("");
  const plan = planId || options[0]?.value || "";

  return (
    <FormDialog
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!customer) throw new FormError(t("needCustomer"));
        if (legalName.trim().length < 2) throw new FormError(t("needName"));
        if (!employeeCode.trim()) throw new FormError(t("needCode"));
        if (!plan) throw new FormError(t("needPlan"));
        const { data } = await adminBrowserApis().contract.POST("/v1/admin/agents", {
          body: {
            customerId: customer.value,
            legalName: legalName.trim(),
            employeeCode: employeeCode.trim(),
            planId: plan,
            staffUserId: staff?.value ?? null,
          },
        });
        refresh();
        toast.success(t("created", { code: data!.code }));
        router.push(`/agents/${data!.id}`);
      }}
    >
      <Field label={t("customer")} hint={t("customerHint")} required>
        <RecordPicker
          kind="customer"
          value={customer}
          onValueChange={(option) => {
            setCustomer(option);
            if (option && !legalName) setLegalName(option.label);
          }}
        />
      </Field>
      <Field label={t("legalName")} hint={t("legalNameHint")} required>
        <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("employeeCode")} required>
          <Input value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} />
        </Field>
        <Field label={t("plan")} required>
          <SearchableSelect value={plan} onValueChange={setPlanId} options={options} />
        </Field>
      </div>
      <Field label={t("staffUser")} hint={t("staffUserHint")}>
        <RecordPicker kind="staff" value={staff} onValueChange={setStaff} />
      </Field>
    </FormDialog>
  );
}
