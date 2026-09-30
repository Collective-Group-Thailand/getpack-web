"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { adminCompanyActions, type AdminCompanyAction } from "@/domain/next-actions/admin";
import { COMPANY_STATUS, CREDIT_STATUS, KYC_STATUS, MEMBER_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { Tabs } from "@/ui/components/Tabs";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  StatusChip,
  useActor,
  useCan,
} from "../console";
import { PartyOrders } from "../orders";
import type { Company, CompanyBranch, CompanyKyc, CompanyMember, CompanyTab } from "./resources";

type Basis = "paid_orders" | "financial_statement";

async function readCompany(companyId: string) {
  const { data } = await adminBrowserApis().contract.GET("/v1/admin/companies/{companyId}", {
    params: { path: { companyId } },
  });
  return data!;
}

/** Today's month in Bangkok, `YYYY-MM` — a default for the month field, never date maths. */
function bangkokMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()).slice(0, 7);
}

/**
 * One B2B company (F2 2.7, D-120…D-125): terms, KYC review, members and their company roles,
 * branches (a tax invoice each), credit — prepaid until a limit is approved by the
 * `credit_limit` policy — monthly statements and its orders. The header restates the code and
 * status on every tab and carries the account actions.
 *
 * On the published contract (U-F0.3): `admin.companies.get` carries the members, branches and
 * KYC documents inline; credit is `admin.companyCredit.get`; a statement is one month of
 * `admin.receivables.companyStatement`. What the old page aggregate carried and the contract
 * does not — receivables, the company discount, credit eligibility and the limit history, the
 * allowed actions — is marked where it was shown (CONTRACT-GAP admin.companies, admin.company-credit).
 */
export function CompanyWorkspace({ companyId, tab }: { companyId: string; tab: CompanyTab }) {
  const t = useTranslations("companies.detail");
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const actor = useActor();
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<AdminCompanyAction | null>(null);
  const key = queryKeys.detail("admin", "company", companyId);
  const query = useQuery({ queryKey: key, queryFn: () => readCompany(companyId) });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const company = query.data;
  if (!company) return null;

  const code = company.companyCode ?? t("noCode");
  const actions = adminCompanyActions(company.status, (permission) => actor.permissions.includes(permission));
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "company") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
  const changed = (updated: Company) => {
    queryClient.setQueryData(key, updated);
    refresh();
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
            items={[{ label: t("companies"), href: "/companies" }, { label: company.companyCode ?? company.legalName }]}
          />
        }
        title={company.legalName}
        meta={
          <>
            <span className="text-muted font-mono text-sm">{code}</span>
            <StatusChip map={COMPANY_STATUS} value={company.status} size="md" />
            <StatusChip map={CREDIT_STATUS} value={company.creditStatus} size="md" />
          </>
        }
        description={t("taxId", { taxId: company.taxId })}
        actions={actions.map((item) => (
          <Button
            key={item.key}
            variant={item.destructive ? "ghost" : item.key === "approve-kyc" ? "primary" : "secondary"}
            onClick={() => setAction(item)}
          >
            {t(`actions.${item.key}.label`)}
          </Button>
        ))}
      />

      {/* CONTRACT-GAP admin.companies — no receivables on the company, so the block cannot say how many days overdue. */}
      {company.creditStatus === "blocked_overdue" ? (
        <Callout tone="danger" title={t("blocked")}>
          {t("blockedBody")}
        </Callout>
      ) : null}
      {company.statusReason ? (
        <Callout tone={company.status === "active" ? "info" : "warning"} title={t("statusReason")}>
          {company.statusReason}
        </Callout>
      ) : null}

      <Tabs
        label={t("tabsLabel")}
        value={current}
        onValueChange={go}
        items={[
          { value: "overview", label: t("tabs.overview"), content: <Overview company={company} /> },
          { value: "kyc", label: t("tabs.kyc"), content: <Kyc company={company} onChanged={changed} /> },
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
          title={t(`actions.${action.key}.title`)}
          description={t(`actions.${action.key}.body`, { name: company.legalName })}
          confirmLabel={t(`actions.${action.key}.label`)}
          tone={action.destructive ? "destructive" : "primary"}
          confirmationPhrase={action.destructive ? (company.companyCode ?? undefined) : undefined}
          reason={action.needsReason ? { label: t("reason"), required: true, minLength: 3 } : undefined}
          onConfirm={async ({ reason }) => {
            const { contract } = adminBrowserApis();
            const path = { companyId };
            const chosen = action.key;
            try {
              const { data } =
                chosen === "approve-kyc"
                  ? await contract.POST("/v1/admin/companies/{companyId}/actions/approve-kyc", { params: { path } })
                  : chosen === "reject-kyc"
                    ? await contract.POST("/v1/admin/companies/{companyId}/actions/reject-kyc", {
                        params: { path },
                        body: { reason },
                      })
                    : await contract.POST("/v1/admin/companies/{companyId}/actions/{action}", {
                        params: { path: { companyId, action: chosen } },
                        body: { reason },
                      });
              changed(data!);
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
  // CONTRACT-GAP admin.companies — no active company discount and no receivables summary (D-122,
  // D-124) on the published company; the overview shows the terms only.
  return (
    <Section title={t("terms")} description={t("termsNote")}>
      <DescriptionList
        columns={3}
        items={[
          { term: t("tradeName"), description: company.tradeName ?? t("none") },
          { term: t("vat"), description: company.isVatRegistered ? t("vatYes") : t("vatNo") },
          { term: t("withholdsTax"), description: company.withholdsTax ? t("withholdsYes") : t("withholdsNo") },
          { term: t("documentEmail"), description: company.documentEmail ?? t("none") },
          { term: t("poPolicy"), description: t(`poPolicies.${company.poNumberPolicy}`) },
          {
            term: t("approvalThreshold"),
            description: company.orderApprovalThreshold ? format.thb(company.orderApprovalThreshold) : t("noThreshold"),
          },
          {
            term: t("kycApproved"),
            description: company.kycApprovedAt ? <When at={company.kycApprovedAt} absoluteOnly /> : t("notYet"),
          },
          { term: t("paidOrders"), description: format.number(company.paidOrdersCount) },
        ]}
      />
    </Section>
  );
}

/** A KYC file, through a short-lived signed URL (`admin.files.download`): asked for, then opened. */
function KycFile({ fileId, name }: { fileId: string; name: string }) {
  const t = useTranslations("companies.kyc");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (url) {
    return (
      <Button asChild size="sm" variant="ghost" iconStart="external">
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${t("open")} ${name}`}>
          {t("open")}
        </a>
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      iconStart="download"
      loading={busy}
      aria-label={`${t("download")} ${name}`}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await adminBrowserApis().contract.GET("/v1/admin/files/{fileId}/download", {
            params: { path: { fileId } },
          });
          setUrl(data!.url);
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : t("downloadFailed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("download")}
    </Button>
  );
}

function Kyc({ company, onChanged }: { company: Company; onChanged: (company: Company) => void }) {
  const t = useTranslations("companies.kyc");
  // Each document is reviewed with `companies.kyc_review` (admin.companies.reviewKycDocument).
  const canReview = useCan("companies.kyc_review");
  const [reviewing, setReviewing] = useState<CompanyKyc | null>(null);
  const [outcome, setOutcome] = useState<"verified" | "rejected">("verified");
  const [note, setNote] = useState("");

  // CONTRACT-GAP admin.companies — a KYC document carries its file id only: no file name, no
  // upload time and no reviewer or review time.
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
      cell: (row) => <KycFile fileId={row.fileId} name={t(`types.${row.docType}`)} />,
    },
    { id: "note", header: t("note"), cell: (row) => row.note ?? "" },
    ...(canReview
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
      {company.missingKyc.length > 0 ? (
        <Callout tone="warning" className="mb-3" title={t("missing")}>
          {company.missingKyc.map((type) => t(`types.${type}`)).join(" · ")}
        </Callout>
      ) : null}
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={company.kycDocuments}
        getRowId={(row) => row.id}
        empty={<EmptyState icon="file-check" title={t("empty")} />}
      />
      {reviewing ? (
        <FormDialog
          title={t("reviewDoc", { doc: t(`types.${reviewing.docType}`) })}
          description={t("reviewBody", { code: company.companyCode ?? company.legalName })}
          submitLabel={t("save")}
          onClose={() => setReviewing(null)}
          onSubmit={async () => {
            if (outcome === "rejected" && !note.trim()) throw new FormError(t("needNote"));
            try {
              const { data } = await adminBrowserApis().contract.POST(
                "/v1/admin/companies/{companyId}/kyc-documents/{documentId}/actions/review",
                {
                  params: { path: { companyId: company.id, documentId: reviewing.id } },
                  body: { outcome, note: note.trim() || null },
                },
              );
              onChanged(data!);
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
            toast.success(t("reviewed"));
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
  // CONTRACT-GAP admin.companies — a member's user carries a name only: no e-mail, no phone.
  const columns: DataTableColumn<CompanyMember>[] = [
    { id: "name", header: t("member"), cell: (row) => <span className="font-medium">{row.user.displayName}</span> },
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
        rows={company.members}
        getRowId={(row) => row.id}
        density="compact"
      />
    </Section>
  );
}

function Branches({ company }: { company: Company }) {
  const t = useTranslations("companies.branches");
  const columns: DataTableColumn<CompanyBranch>[] = [
    { id: "code", header: t("code"), cell: (row) => <span className="font-mono">{row.branchCode}</span> },
    {
      id: "name",
      header: t("name"),
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {row.branchType === "head_office" ? t("headOffice") : row.name}
          {row.isDefault ? <Badge size="sm">{t("default")}</Badge> : null}
        </span>
      ),
    },
    {
      id: "address",
      header: t("address"),
      cell: (row) => [row.line1, row.line2, row.postcode].filter(Boolean).join(" "),
    },
  ];
  return (
    <Section title={t("title")} description={t("note")}>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={company.branches}
        getRowId={(row) => row.id}
        density="compact"
      />
    </Section>
  );
}

function Credit({ company, onChanged }: { company: Company; onChanged: () => void }) {
  const t = useTranslations("companies.credit");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("company_credit.manage");
  const canReadSettings = useCan("settings.read");
  const [requesting, setRequesting] = useState(false);
  const [draft, setDraft] = useState<{ limitAmount: string; termDays: string; basis: Basis; reason: string }>({
    limitAmount: "",
    termDays: "",
    basis: "financial_statement",
    reason: "",
  });
  const key = queryKeys.related("admin", "company", company.id, "credit");
  const credit = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/companies/{companyId}/credit", {
          params: { path: { companyId: company.id } },
        })
      ).data!,
  });
  // The terms a company may be given are a setting (`b2b.credit_terms`, D-121), never a constant.
  const terms = useQuery({
    queryKey: queryKeys.list("admin", "setting", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/settings")).data!,
    enabled: canReadSettings && requesting,
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
  if (credit.isError) return <QueryError error={credit.error} onRetry={() => void credit.refetch()} />;
  const figures = credit.data;
  const pending = figures?.pendingRequest ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* CONTRACT-GAP admin.companies — no credit eligibility (paid orders / financial review) and no
          limit history; CONTRACT-GAP admin.company-credit — a request answers no approval id. */}
      <Section
        title={t("title")}
        description={t("note")}
        actions={
          canManage && company.status === "active" ? (
            <Button
              size="sm"
              variant="secondary"
              iconStart="plus"
              disabled={!figures || pending !== null}
              onClick={() => {
                setDraft({
                  limitAmount: "",
                  termDays: "",
                  basis: company.creditStatus === "eligible" ? "paid_orders" : "financial_statement",
                  reason: "",
                });
                setRequesting(true);
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
            <dd className="text-lg font-semibold tabular-nums">
              {figures ? (figures.limitAmount ? format.thb(figures.limitAmount) : t("noLimit")) : "–"}
            </dd>
          </div>
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("term")}</dt>
            <dd className="text-lg font-semibold">
              {figures ? (figures.termDays === null ? t("prepaid") : t("termDays", { days: figures.termDays })) : "–"}
            </dd>
          </div>
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("available")}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {figures ? format.thb(figures.availableAmount) : "–"}
            </dd>
          </div>
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("exposure")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{figures ? format.thb(figures.exposureAmount) : "–"}</dd>
          </div>
        </dl>
        {pending ? (
          <Callout tone="info" className="mt-3" title={t("pending")}>
            {t("pendingBody", { limit: format.thb(pending.limitAmount), days: pending.termDays })}{" "}
            <When at={pending.requestedAt} absoluteOnly />
          </Callout>
        ) : null}
      </Section>

      {requesting ? (
        <FormDialog
          title={t("requestTitle")}
          description={t("requestBody", { code: company.companyCode ?? "–", name: company.legalName })}
          submitLabel={t("send")}
          onClose={() => setRequesting(false)}
          onSubmit={async () => {
            if (!draft.limitAmount || Number(draft.limitAmount) <= 0) throw new FormError(t("needLimit"));
            if (draft.reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              // No Idempotency-Key: admin.companyCredit.requestLimit does not declare one.
              const { data } = await adminBrowserApis().contract.POST("/v1/admin/companies/{companyId}/credit-limits", {
                params: { path: { companyId: company.id } },
                body: {
                  limitAmount: Number(draft.limitAmount).toFixed(2),
                  ...(draft.termDays ? { termDays: Number(draft.termDays) } : {}),
                  basis: draft.basis,
                  reason: draft.reason.trim(),
                },
              });
              queryClient.setQueryData(key, data);
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
          <Field label={t("term")} hint={canReadSettings ? t("termHint") : t("termHidden")}>
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
            onValueChange={(basis) => setDraft({ ...draft, basis: basis as Basis })}
            options={[
              { value: "paid_orders", label: t("bases.paid_orders") },
              { value: "financial_statement", label: t("bases.financial_statement") },
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
  // admin.receivables.companyStatement is a receivables read (`receivables.read`).
  const canRead = useCan("receivables.read");
  const [month, setMonth] = useState(bangkokMonth);
  const statement = useQuery({
    queryKey: queryKeys.related("admin", "company", company.id, `statements:${month}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/companies/{companyId}/statements", {
          params: { path: { companyId: company.id }, query: { month } },
        })
      ).data!,
    enabled: canRead,
  });
  if (!canRead) {
    return (
      <Section title={t("title")} description={t("note")}>
        <Callout tone="info" title={t("noAccess")} />
      </Section>
    );
  }
  const data = statement.data;
  // CONTRACT-GAP admin.company-credit — one month per call: no list of statement months, no due
  // date, status or issue date, and no PDF download link (`pdfReady` only).
  return (
    <Section
      title={t("title")}
      description={t("note")}
      actions={
        <Field label={t("month")} className="w-44">
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value || month)} />
        </Field>
      }
    >
      {statement.isError ? (
        <QueryError error={statement.error} onRetry={() => void statement.refetch()} />
      ) : (
        <dl className="grid gap-3 sm:grid-cols-5">
          {(
            [
              ["opening", data?.opening],
              ["invoiced", data?.invoiced],
              ["credited", data?.credited],
              ["paid", data?.paid],
              ["closing", data?.closing],
            ] as const
          ).map(([name, amount]) => (
            <div key={name} className="rounded-md border p-3">
              <dt className="text-muted text-xs">{t(name)}</dt>
              <dd className="text-lg font-semibold tabular-nums">{amount ? format.thb(amount) : "–"}</dd>
            </div>
          ))}
        </dl>
      )}
    </Section>
  );
}
