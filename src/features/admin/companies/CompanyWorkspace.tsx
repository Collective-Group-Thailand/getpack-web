"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  COMPANY_STATUS,
  CREDIT_STATUS,
  KYC_STATUS,
  MEMBER_STATUS,
  SETTING_VERSION_STATUS,
  STATEMENT_STATUS,
} from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { Tabs } from "@/ui/components/Tabs";
import { toast } from "@/ui/components/Toast";

import {
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  StatusChip,
  useCan,
} from "../console";
import { adminBrowserApis } from "../console/api";
import { PartyOrders } from "../orders";
import type { Company, CompanyBranch, CompanyKyc, CompanyMember, CompanyStatement, CompanyTab } from "./resources";

type Action = Company["allowedActions"][number];
const DESTRUCTIVE = new Set<Action>(["suspend", "close"]);

/** Reads the company with its ETag: status actions are sent under `If-Match`. */
async function readCompany(companyId: string) {
  return browserRequests().read("GET /v1/admin/companies/{companyId}", { path: { companyId } });
}

/**
 * One B2B company (F2 2.7, D-120…D-125): terms and what it owes, KYC review, members and their
 * company roles, branches (a tax invoice each), credit — prepaid until a limit is approved by
 * the `credit_limit` policy — monthly statements and its orders. The header restates the code
 * and status on every tab and carries the account actions.
 */
export function CompanyWorkspace({ companyId, tab }: { companyId: string; tab: CompanyTab }) {
  const t = useTranslations("companies.detail");
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<Action | null>(null);
  const key = queryKeys.detail("admin", "company", companyId);
  const query = useQuery({ queryKey: key, queryFn: async () => (await readCompany(companyId)).data });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const company = query.data;
  if (!company) return null;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "company") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
  const go = (next: string) => {
    setCurrent(next);
    window.history.replaceState(null, "", next === "overview" ? pathname : `${pathname}?tab=${next}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("companies"), href: "/companies" }, { label: company.companyCode }]}
          />
        }
        title={company.legalName}
        meta={
          <>
            <span className="text-muted font-mono text-sm">{company.companyCode}</span>
            <StatusChip map={COMPANY_STATUS} value={company.status} size="md" />
            <StatusChip map={CREDIT_STATUS} value={company.creditStatus} size="md" />
          </>
        }
        description={t("taxId", { taxId: company.taxId })}
        actions={company.allowedActions.map((item) => (
          <Button
            key={item}
            variant={DESTRUCTIVE.has(item) ? "ghost" : item === "approve-kyc" ? "primary" : "secondary"}
            onClick={() => setAction(item)}
          >
            {t(`actions.${item}.label`)}
          </Button>
        ))}
      />

      {company.receivables.creditOrdersBlocked ? (
        <Callout
          tone="danger"
          title={t("blocked", {
            days: company.receivables.oldestOverdueDays,
          })}
        >
          {t("blockedBody")}
        </Callout>
      ) : null}

      <Tabs
        label={t("tabsLabel")}
        value={current}
        onValueChange={go}
        items={[
          { value: "overview", label: t("tabs.overview"), content: <Overview company={company} /> },
          { value: "kyc", label: t("tabs.kyc"), content: <Kyc company={company} onChanged={refresh} /> },
          { value: "members", label: t("tabs.members"), content: <Members company={company} /> },
          { value: "branches", label: t("tabs.branches"), content: <Branches company={company} /> },
          { value: "credit", label: t("tabs.credit"), content: <Credit company={company} onChanged={refresh} /> },
          { value: "statements", label: t("tabs.statements"), content: <Statements company={company} /> },
          { value: "orders", label: t("tabs.orders"), content: <PartyOrders companyId={company.id} /> },
        ]}
      />

      {action ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t(`actions.${action}.title`)}
          description={t(`actions.${action}.body`, { code: company.companyCode, name: company.legalName })}
          confirmLabel={t(`actions.${action}.label`)}
          tone={DESTRUCTIVE.has(action) ? "destructive" : "primary"}
          confirmationPhrase={DESTRUCTIVE.has(action) ? company.companyCode : undefined}
          reason={{ label: t("reason"), required: true, minLength: 3 }}
          onConfirm={async ({ reason }) => {
            try {
              const { etag } = await readCompany(companyId);
              const updated = await browserRequests().call("POST /v1/admin/companies/{companyId}/actions/{action}", {
                path: { companyId, action },
                body: { reason },
                etag: etag ?? undefined,
              });
              queryClient.setQueryData(key, updated);
              refresh();
              toast.success(t("changed"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}

function Overview({ company }: { company: Company }) {
  const t = useTranslations("companies.overview");
  const format = useFormat();
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("terms")} description={t("termsNote")}>
        <DescriptionList
          columns={3}
          items={[
            { term: t("vat"), description: company.isVatRegistered ? t("vatYes") : t("vatNo") },
            { term: t("poPolicy"), description: t(`poPolicies.${company.poNumberPolicy}`) },
            {
              term: t("approvalThreshold"),
              description: company.orderApprovalThreshold
                ? format.thb(company.orderApprovalThreshold)
                : t("noThreshold"),
            },
            {
              term: t("kycApproved"),
              description: company.kycApprovedAt ? <When at={company.kycApprovedAt} absoluteOnly /> : t("notYet"),
            },
            {
              term: t("discount"),
              description: company.discount ? (
                <span>
                  {format.percent(company.discount.pct)} ·{" "}
                  <Link
                    href={`/discount-memos?q=${encodeURIComponent(company.discount.memoCode)}`}
                    className="text-primary font-mono hover:underline"
                  >
                    {company.discount.memoCode}
                  </Link>
                </span>
              ) : (
                t("noDiscount")
              ),
            },
            { term: t("paidOrders"), description: format.number(company.paidOrdersCount) },
          ]}
        />
      </Section>
      <Section title={t("receivables")} description={t("receivablesNote")}>
        <dl className="grid gap-3 sm:grid-cols-4">
          {(
            [
              ["open", format.thb(company.receivables.openAmount)],
              ["overdue", format.thb(company.receivables.overdueAmount)],
              ["oldest", t("days", { days: company.receivables.oldestOverdueDays })],
              ["available", format.thb(company.credit.availableAmount)],
            ] as const
          ).map(([name, value]) => (
            <div key={name} className="rounded-md border p-3">
              <dt className="text-muted text-xs">{t(`figures.${name}`)}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {company.receivables.nextDueAt ? (
          <p className="text-muted mt-2 text-sm">
            {t("nextDue")} <When at={company.receivables.nextDueAt} absoluteOnly />
          </p>
        ) : null}
      </Section>
    </div>
  );
}

function Kyc({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const t = useTranslations("companies.kyc");
  const queryClient = useQueryClient();
  // Each document is reviewed with `companies.kyc_review`; approving the account is an action (companies.manage).
  const canManage = useCan("companies.kyc_review");
  const key = queryKeys.related("admin", "company", company.id, "kyc");
  const docs = useQuery({
    queryKey: key,
    queryFn: () =>
      browserRequests().call("GET /v1/admin/companies/{companyId}/kyc-documents", { path: { companyId: company.id } }),
  });
  const [reviewing, setReviewing] = useState<CompanyKyc | null>(null);
  const [outcome, setOutcome] = useState<"verified" | "rejected">("verified");
  const [note, setNote] = useState("");
  if (docs.isError) return <QueryError error={docs.error} onRetry={() => void docs.refetch()} />;

  const columns: DataTableColumn<CompanyKyc>[] = [
    { id: "docType", header: t("doc"), cell: (row) => t(`types.${row.docType}`) },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={KYC_STATUS} value={row.status} /> },
    {
      id: "issuedOn",
      header: t("issuedOn"),
      cell: (row) => (row.issuedOn ? <When at={`${row.issuedOn}T00:00:00+07:00`} absoluteOnly /> : "–"),
    },
    {
      id: "file",
      header: t("file"),
      cell: (row) =>
        row.file.url ? (
          <a href={row.file.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {row.file.originalName}
          </a>
        ) : (
          row.file.originalName
        ),
    },
    { id: "note", header: t("note"), cell: (row) => row.note ?? "" },
    ...(canManage
      ? [
          {
            id: "review",
            header: <span className="sr-only">{t("review")}</span>,
            cell: (row: CompanyKyc) =>
              row.status === "pending" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setOutcome("verified");
                    setNote("");
                    setReviewing(row);
                  }}
                >
                  {t("reviewDoc", { doc: t(`types.${row.docType}`) })}
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <Section title={t("title")} description={t("rule")}>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={docs.data ?? []}
        getRowId={(row) => row.id}
        loading={docs.isPending}
        empty={<EmptyState icon="file-check" title={t("empty")} />}
      />
      {reviewing ? (
        <FormDialog
          title={t("reviewDoc", { doc: t(`types.${reviewing.docType}`) })}
          description={t("reviewBody", { code: company.companyCode })}
          submitLabel={t("save")}
          onClose={() => setReviewing(null)}
          onSubmit={async () => {
            if (outcome === "rejected" && !note.trim()) throw new FormError(t("needNote"));
            try {
              await browserRequests().call(
                "POST /v1/admin/companies/{companyId}/kyc-documents/{documentId}/actions/review",
                {
                  path: { companyId: company.id, documentId: reviewing.id },
                  body: { outcome, note: note.trim() || null },
                },
              );
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
            toast.success(t("reviewed"));
            void queryClient.invalidateQueries({ queryKey: key });
            onChanged();
          }}
        >
          <SegmentedControl
            label={t("outcome")}
            value={outcome}
            onValueChange={(value) => setOutcome(value as typeof outcome)}
            options={[
              { value: "verified", label: t("verify"), icon: "check" },
              { value: "rejected", label: t("reject"), icon: "ban" },
            ]}
          />
          <Field label={t("note")} hint={outcome === "rejected" ? t("rejectHint") : t("noteHint")}>
            <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}
    </Section>
  );
}

function Members({ company }: { company: Company }) {
  const t = useTranslations("companies.members");
  const members = useQuery({
    queryKey: queryKeys.related("admin", "company", company.id, "members"),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/companies/{companyId}/members", { path: { companyId: company.id } }),
  });
  if (members.isError) return <QueryError error={members.error} onRetry={() => void members.refetch()} />;
  const columns: DataTableColumn<CompanyMember>[] = [
    {
      id: "name",
      header: t("member"),
      cell: (row) => (
        <div>
          <p className="font-medium">{row.user.displayName}</p>
          <p className="text-muted text-xs">{[row.user.email, row.user.phone].filter(Boolean).join(" · ")}</p>
        </div>
      ),
    },
    {
      id: "roles",
      header: t("roles"),
      cell: (row) => (
        <ul className="flex flex-wrap gap-1">
          {row.roles.map((role) => (
            <li key={role}>
              <Badge size="sm">{t(`roleNames.${role}`)}</Badge>
            </li>
          ))}
        </ul>
      ),
    },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={MEMBER_STATUS} value={row.status} /> },
    { id: "joinedAt", header: t("joined"), cell: (row) => (row.joinedAt ? <When at={row.joinedAt} /> : "–") },
  ];
  return (
    <Section title={t("title")} description={t("note")}>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={members.data ?? []}
        getRowId={(row) => row.id}
        loading={members.isPending}
        density="compact"
      />
    </Section>
  );
}

function Branches({ company }: { company: Company }) {
  const t = useTranslations("companies.branches");
  const branches = useQuery({
    queryKey: queryKeys.related("admin", "company", company.id, "branches"),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/companies/{companyId}/branches", { path: { companyId: company.id } }),
  });
  if (branches.isError) return <QueryError error={branches.error} onRetry={() => void branches.refetch()} />;
  const columns: DataTableColumn<CompanyBranch>[] = [
    { id: "code", header: t("code"), cell: (row) => <span className="font-mono">{row.branchCode}</span> },
    {
      id: "name",
      header: t("name"),
      cell: (row) => (row.branchType === "head_office" ? t("headOffice") : row.name),
    },
    { id: "address", header: t("address"), cell: (row) => row.address },
  ];
  return (
    <Section title={t("title")} description={t("note")}>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={branches.data ?? []}
        getRowId={(row) => row.id}
        loading={branches.isPending}
        density="compact"
      />
    </Section>
  );
}

function Credit({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const t = useTranslations("companies.credit");
  const format = useFormat();
  const canManage = useCan("company_credit.manage");
  const canReadSettings = useCan("settings.read");
  const [requesting, setRequesting] = useState<{ key: string } | null>(null);
  const [draft, setDraft] = useState({ limitAmount: "", termDays: "", basis: "financial_review", reason: "" });
  // The terms a company may be given are a setting (`b2b.credit_terms`, D-121), never a constant.
  const terms = useQuery({
    queryKey: queryKeys.list("admin", "setting", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/settings")).data!,
    enabled: canReadSettings && requesting !== null,
    select: (settings) => {
      const value = settings.find((setting) => setting.key === "b2b.credit_terms")?.current?.value;
      const record = value && typeof value === "object" && !Array.isArray(value) ? value : null;
      const allowed =
        record && Array.isArray(record.allowedDays) ? record.allowedDays.filter((day) => typeof day === "number") : [];
      return {
        allowed: allowed as number[],
        fallback: typeof record?.defaultDays === "number" ? record.defaultDays : null,
      };
    },
  });
  const pending = company.credit.versions.some((version) => version.status === "proposed");

  const columns: DataTableColumn<Company["credit"]["versions"][number]>[] = [
    { id: "versionNo", header: t("version"), numeric: true, cell: (row) => row.versionNo },
    { id: "limit", header: t("limit"), numeric: true, cell: (row) => format.thb(row.limitAmount) },
    { id: "term", header: t("term"), cell: (row) => t("termDays", { days: row.termDays }) },
    { id: "basis", header: t("basis"), cell: (row) => t(`bases.${row.basis}`) },
    {
      id: "status",
      header: t("status"),
      cell: (row) => <StatusChip map={SETTING_VERSION_STATUS} value={row.status} />,
    },
    { id: "reason", header: t("reason"), cell: (row) => row.reason },
    {
      id: "approval",
      header: t("approval"),
      cell: (row) =>
        row.approvalRequestId ? (
          <Link href={`/approvals/${row.approvalRequestId}`} className="text-primary hover:underline">
            {t("openApproval")}
          </Link>
        ) : (
          "–"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("title")}
        description={t("note")}
        actions={
          canManage && company.status === "active" ? (
            <Button
              size="sm"
              variant="secondary"
              iconStart="plus"
              disabled={pending}
              onClick={() => {
                setDraft({
                  limitAmount: "",
                  termDays: "",
                  basis: company.credit.eligibleReason === "paid_orders" ? "paid_orders" : "financial_review",
                  reason: "",
                });
                setRequesting({ key: newIdempotencyKey() });
              }}
            >
              {t("request")}
            </Button>
          ) : null
        }
      >
        <dl className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("limit")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{format.thb(company.credit.limitAmount)}</dd>
          </div>
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("term")}</dt>
            <dd className="text-lg font-semibold">
              {company.credit.termDays === null ? t("prepaid") : t("termDays", { days: company.credit.termDays })}
            </dd>
          </div>
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("available")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{format.thb(company.credit.availableAmount)}</dd>
          </div>
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("eligibility")}</dt>
            <dd className="text-sm font-medium">{t(`eligible.${company.credit.eligibleReason}`)}</dd>
          </div>
        </dl>
        {pending ? <Callout tone="info" className="mt-3" title={t("pending")} /> : null}
      </Section>
      <Section title={t("versions")}>
        <DataTable
          caption={t("versions")}
          columns={columns}
          rows={company.credit.versions}
          getRowId={(row) => String(row.versionNo)}
          density="compact"
          empty={<EmptyState icon="credit-card" title={t("noVersions")} />}
        />
      </Section>

      {requesting ? (
        <FormDialog
          title={t("requestTitle")}
          description={t("requestBody", { code: company.companyCode, name: company.legalName })}
          submitLabel={t("send")}
          onClose={() => setRequesting(null)}
          onSubmit={async () => {
            if (!draft.limitAmount || Number(draft.limitAmount) <= 0) throw new FormError(t("needLimit"));
            if (!draft.termDays) throw new FormError(t("needTerm"));
            if (draft.reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              await browserRequests().call("POST /v1/admin/companies/{companyId}/credit-limits", {
                path: { companyId: company.id },
                body: {
                  limitAmount: Number(draft.limitAmount).toFixed(2),
                  termDays: Number(draft.termDays),
                  basis: draft.basis as "paid_orders" | "financial_review",
                  reason: draft.reason.trim(),
                  evidenceFileIds: [],
                },
                idempotencyKey: requesting.key,
              });
              toast.success(t("sent"));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
            onChanged();
          }}
        >
          <Callout tone="info" title={t("routing")} />
          <Field label={t("limit")} hint={t("limitHint")} required>
            <NumberInput
              min={1}
              step="0.01"
              unit="฿"
              value={draft.limitAmount}
              onChange={(event) => setDraft({ ...draft, limitAmount: event.target.value })}
            />
          </Field>
          <Field label={t("term")} hint={canReadSettings ? t("termHint") : t("termHidden")} required>
            <Select
              value={draft.termDays || undefined}
              placeholder={t("chooseTerm")}
              onValueChange={(termDays) => setDraft({ ...draft, termDays })}
              options={(terms.data?.allowed ?? []).map((days) => ({
                value: String(days),
                label: t(days === terms.data?.fallback ? "termDefault" : "termDays", { days }),
              }))}
            />
          </Field>
          <SegmentedControl
            label={t("basis")}
            value={draft.basis}
            onValueChange={(basis) => setDraft({ ...draft, basis })}
            options={[
              {
                value: "paid_orders",
                label: t("bases.paid_orders"),
                disabled: company.credit.eligibleReason !== "paid_orders",
              },
              { value: "financial_review", label: t("bases.financial_review") },
            ]}
          />
          <Field label={t("reason")} required>
            <Textarea
              rows={3}
              value={draft.reason}
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}

function Statements({ company }: { company: Company }) {
  const t = useTranslations("companies.statements");
  const format = useFormat();
  const statements = useQuery({
    queryKey: queryKeys.related("admin", "company", company.id, "statements"),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/companies/{companyId}/statements", { path: { companyId: company.id } }),
  });
  if (statements.isError) return <QueryError error={statements.error} onRetry={() => void statements.refetch()} />;
  const columns: DataTableColumn<CompanyStatement>[] = [
    { id: "period", header: t("period"), cell: (row) => <span className="font-mono">{row.period}</span> },
    { id: "opening", header: t("opening"), numeric: true, cell: (row) => format.thb(row.openingBalance) },
    { id: "invoiced", header: t("invoiced"), numeric: true, cell: (row) => format.thb(row.invoicedAmount) },
    { id: "paid", header: t("paid"), numeric: true, cell: (row) => format.thb(row.paidAmount) },
    { id: "closing", header: t("closing"), numeric: true, cell: (row) => format.thb(row.closingBalance) },
    { id: "dueAt", header: t("due"), cell: (row) => (row.dueAt ? <When at={row.dueAt} absoluteOnly /> : "–") },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={STATEMENT_STATUS} value={row.status} /> },
    {
      id: "file",
      header: <span className="sr-only">{t("download")}</span>,
      cell: (row) =>
        row.file?.url ? (
          <a href={row.file.url} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline">
            {t("downloadPeriod", { period: row.period })}
          </a>
        ) : null,
    },
  ];
  return (
    <Section title={t("title")} description={t("note")}>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={statements.data ?? []}
        getRowId={(row) => row.id}
        loading={statements.isPending}
        density="compact"
        empty={<EmptyState icon="receipt" title={t("empty")} />}
      />
    </Section>
  );
}
