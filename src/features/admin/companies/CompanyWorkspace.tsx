"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import Link from "next/link";

import { COMPANY_STATUS, CREDIT_STATUS, KYC_STATUS, MEMBER_STATUS, SETTING_VERSION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
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
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Tabs } from "@/ui/components/Tabs";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  download,
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
import { companyActions, type CompanyAction } from "./actions";
import type {
  Company,
  CompanyBranch,
  CompanyKyc,
  CompanyMember,
  CompanyTab,
  CreditVersion,
  IssuedStatement,
} from "./resources";

type Basis = "paid_orders" | "financial_statement";

/** The company and the `ETag` it came with, for the next staff action's `If-Match` (v0.5.0). */
interface Loaded {
  company: Company;
  etag: string | null;
}

async function readCompany(companyId: string): Promise<Loaded> {
  const { data, response } = await adminBrowserApis().contract.GET("/v1/admin/companies/{companyId}", {
    params: { path: { companyId } },
  });
  return { company: data!, etag: response.headers.get("ETag") };
}

/** `If-Match` when the company came with an `ETag`: a staff action on a stale page is refused (412). */
const ifMatch = (etag: string | null) => (etag ? { "If-Match": etag } : {});

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
 * On the published contract: `admin.companies.get` carries the members (with their contacts),
 * branches and KYC documents (with file names and review stamps) inline, the receivables summary
 * and the active discount, and an `ETag` every staff action sends back as `If-Match`; credit is
 * `admin.companyCredit.get` (eligibility, limit versions, the pending request and its approval)
 * with `.receivables` (aging, D-122 notices); statements are the issued months
 * (`.listStatements`) with their PDF. The account actions are still read from the status
 * (`./actions.ts`, CONTRACT-GAP admin.companies).
 */
export function CompanyWorkspace({ companyId, tab }: { companyId: string; tab: CompanyTab }) {
  const t = useTranslations("companies.detail");
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const actor = useActor();
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<CompanyAction | null>(null);
  const key = queryKeys.detail("admin", "company", companyId);
  const query = useQuery({ queryKey: key, queryFn: () => readCompany(companyId) });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  const { company, etag } = query.data;

  const code = company.companyCode ?? t("noCode");
  const actions = companyActions(company.status, (permission) => actor.permissions.includes(permission));
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "company") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
  const changed = (updated: Company, nextEtag: string | null) => {
    queryClient.setQueryData<Loaded>(key, { company: updated, etag: nextEtag });
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

      {company.creditStatus === "blocked_overdue" ? (
        <Callout
          tone="danger"
          title={
            company.receivables.oldestOverdueDays
              ? t("blockedDays", { days: company.receivables.oldestOverdueDays })
              : t("blocked")
          }
        >
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
          { value: "kyc", label: t("tabs.kyc"), content: <Kyc company={company} etag={etag} onChanged={changed} /> },
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
            const header = ifMatch(etag);
            const chosen = action.key;
            try {
              const { data, response } =
                chosen === "approve-kyc"
                  ? await contract.POST("/v1/admin/companies/{companyId}/actions/approve-kyc", {
                      params: { path, header },
                    })
                  : chosen === "reject-kyc"
                    ? await contract.POST("/v1/admin/companies/{companyId}/actions/reject-kyc", {
                        params: { path, header },
                        body: { reason },
                      })
                    : await contract.POST("/v1/admin/companies/{companyId}/actions/{action}", {
                        params: { path: { companyId, action: chosen }, header },
                        body: { reason },
                      });
              changed(data!, response.headers.get("ETag"));
              toast.success(t("changed"));
            } catch (error) {
              // A stale page (412) reloads the company, so the next try acts on what it now is.
              if (isApiError(error) && error.status === 412) void query.refetch();
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
  const { receivables, discount } = company;
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("receivables")} description={t("receivablesNote")}>
        <dl className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("open")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{format.thb(receivables.openAmount)}</dd>
          </div>
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("overdue")}</dt>
            <dd
              className={`text-lg font-semibold tabular-nums ${receivables.overdueAmount !== "0.00" ? "text-danger" : ""}`}
            >
              {format.thb(receivables.overdueAmount)}
            </dd>
            {receivables.oldestOverdueDays ? (
              <dd className="text-muted text-xs">{t("oldestDays", { days: receivables.oldestOverdueDays })}</dd>
            ) : null}
          </div>
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("nextDue")}</dt>
            <dd className="text-lg font-semibold">
              {receivables.nextDueAt ? <When at={receivables.nextDueAt} absoluteOnly /> : "–"}
            </dd>
          </div>
          <div className="rounded-md border p-3">
            <dt className="text-muted text-xs">{t("discount")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{discount ? format.percent(discount.pct) : "–"}</dd>
            {discount ? (
              <dd className="text-muted text-xs">
                {discount.validTo ? (
                  <>
                    {t("discountUntil")} <When at={discount.validTo} absoluteOnly />
                  </>
                ) : (
                  t("discountOpen")
                )}
              </dd>
            ) : null}
          </div>
        </dl>
      </Section>
      <Section title={t("terms")} description={t("termsNote")}>
        <DescriptionList
          columns={3}
          items={[
            { term: t("tradeName"), description: company.tradeName ?? t("none") },
            { term: t("vat"), description: company.isVatRegistered ? t("vatYes") : t("vatNo") },
            { term: t("withholdsTax"), description: company.withholdsTax ? t("withholdsYes") : t("withholdsNo") },
            { term: t("documentEmail"), description: company.documentEmail ?? t("none") },
            { term: t("contactPhone"), description: company.contactPhone ?? t("none") },
            {
              term: t("signatory"),
              description: company.signatory
                ? t("signatoryValue", { name: company.signatory.name, position: company.signatory.position })
                : t("none"),
            },
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
            { term: t("paidOrders"), description: format.number(company.paidOrdersCount) },
          ]}
        />
      </Section>
    </div>
  );
}

/**
 * A KYC file: the signed URL the company carries (`fileUrl`, v0.5.0) when it has one, else one
 * asked for (`admin.files.download`) and then opened.
 */
function KycFile({ fileId, fileUrl, name }: { fileId: string; fileUrl: string | null; name: string }) {
  const t = useTranslations("companies.kyc");
  const [url, setUrl] = useState<string | null>(fileUrl);
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

function Kyc({
  company,
  etag,
  onChanged,
}: {
  company: Company;
  etag: string | null;
  onChanged: (company: Company, etag: string | null) => void;
}) {
  const t = useTranslations("companies.kyc");
  // Each document is reviewed with `companies.kyc_review` (admin.companies.reviewKycDocument).
  const canReview = useCan("companies.kyc_review");
  const [reviewing, setReviewing] = useState<CompanyKyc | null>(null);
  const [outcome, setOutcome] = useState<"verified" | "rejected">("verified");
  const [note, setNote] = useState("");

  const columns: DataTableColumn<CompanyKyc>[] = [
    {
      id: "docType",
      header: t("doc"),
      cell: (row) => (
        <div className="min-w-0">
          <p>{t(`types.${row.docType}`)}</p>
          <p className="text-muted truncate text-xs">{row.fileName}</p>
        </div>
      ),
    },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={KYC_STATUS} value={row.status} /> },
    {
      id: "issuedOn",
      header: t("issuedOn"),
      cell: (row) => (row.issuedOn ? <When at={`${row.issuedOn}T00:00:00+07:00`} absoluteOnly /> : "–"),
    },
    { id: "uploadedAt", header: t("uploadedAt"), cell: (row) => <When at={row.uploadedAt} /> },
    {
      id: "file",
      header: t("file"),
      cell: (row) => <KycFile fileId={row.fileId} fileUrl={row.fileUrl} name={row.fileName} />,
    },
    {
      id: "reviewed",
      header: t("reviewed"),
      cell: (row) =>
        row.reviewedAt ? (
          <div className="text-sm">
            <p>{row.reviewedBy?.displayName ?? "–"}</p>
            <p className="text-muted text-xs">
              <When at={row.reviewedAt} />
            </p>
          </div>
        ) : (
          "–"
        ),
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
              const { data, response } = await adminBrowserApis().contract.POST(
                "/v1/admin/companies/{companyId}/kyc-documents/{documentId}/actions/review",
                {
                  params: { path: { companyId: company.id, documentId: reviewing.id }, header: ifMatch(etag) },
                  body: { outcome, note: note.trim() || null },
                },
              );
              onChanged(data!, response.headers.get("ETag"));
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
  // Staff see a member's contacts (v0.5.0); the company's own members do not (D-224).
  const columns: DataTableColumn<CompanyMember>[] = [
    { id: "name", header: t("member"), cell: (row) => <span className="font-medium">{row.user.displayName}</span> },
    {
      id: "contact",
      header: t("contact"),
      cell: (row) => (
        <div className="text-sm">
          <p>{row.user.phone ?? "–"}</p>
          <p className="text-muted text-xs">{row.user.email ?? ""}</p>
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
  const [requesting, setRequesting] = useState<{ key: string } | null>(null);
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
  const receivables = useQuery({
    queryKey: queryKeys.related("admin", "company", company.id, "receivables"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/companies/{companyId}/receivables", {
          params: { path: { companyId: company.id } },
        })
      ).data!,
  });
  if (credit.isError) return <QueryError error={credit.error} onRetry={() => void credit.refetch()} />;
  const figures = credit.data;
  const pending = figures?.pendingRequest ?? null;
  const eligibility = figures?.eligibility ?? null;
  // The terms a company may be given come with the credit (`b2b.credit_terms`, D-121), never a constant.
  const allowedTerms = eligibility?.allowedTermDays ?? [];
  const aging = receivables.data?.aging;

  const versionColumns: DataTableColumn<CreditVersion>[] = [
    { id: "versionNo", header: t("version"), numeric: true, cell: (row) => row.versionNo },
    { id: "limit", header: t("limit"), numeric: true, cell: (row) => format.thb(row.limitAmount) },
    { id: "term", header: t("term"), cell: (row) => t("termDays", { days: row.termDays }) },
    { id: "basis", header: t("basis"), cell: (row) => t(`bases.${row.basis}`) },
    {
      id: "status",
      header: t("versionStatus"),
      cell: (row) => <StatusChip map={SETTING_VERSION_STATUS} value={row.status} />,
    },
    {
      id: "requested",
      header: t("requested"),
      cell: (row) => (
        <div className="text-sm">
          <p>{row.requestedBy?.displayName ?? "–"}</p>
          <p className="text-muted text-xs">
            <When at={row.requestedAt} />
          </p>
        </div>
      ),
    },
    { id: "reason", header: t("reason"), cell: (row) => <span className="text-sm">{row.reason}</span> },
    {
      id: "approval",
      header: <span className="sr-only">{t("approval")}</span>,
      cell: (row) =>
        row.approvalId ? (
          <Link href={`/approvals/${row.approvalId}`} className="text-primary text-sm hover:underline">
            {t("openApproval")}
          </Link>
        ) : null,
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
              disabled={!figures || pending !== null}
              onClick={() => {
                setDraft({
                  limitAmount: "",
                  termDays: "",
                  basis: eligibility?.reason ?? "financial_statement",
                  reason: "",
                });
                // One intent per opening: a retry after a timeout replays the same request.
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
        {eligibility ? (
          <Callout
            tone={eligibility.eligible ? "success" : "info"}
            className="mt-3"
            title={
              eligibility.eligible && eligibility.reason
                ? t("eligibleBy", { basis: t(`bases.${eligibility.reason}`) })
                : t("notEligible")
            }
          >
            {t("eligibilityBody", {
              paid: format.number(eligibility.paidOrdersCount),
              needed: format.number(eligibility.paidOrdersNeeded),
            })}{" "}
            {eligibility.financialStatementOnFile ? t("statementOnFile") : t("noStatementOnFile")}
          </Callout>
        ) : null}
        {pending ? (
          <Callout tone="info" className="mt-3" title={t("pending")}>
            {t("pendingVersion", {
              no: pending.versionNo,
              limit: format.thb(pending.limitAmount),
              days: pending.termDays,
            })}{" "}
            <When at={pending.requestedAt} absoluteOnly />
            {pending.approvalId ? (
              <>
                {" · "}
                <Link href={`/approvals/${pending.approvalId}`} className="text-primary hover:underline">
                  {t("openApproval")}
                </Link>
              </>
            ) : null}
          </Callout>
        ) : null}
      </Section>

      <Section title={t("receivables")} description={t("receivablesNote")}>
        {receivables.isError ? (
          <QueryError error={receivables.error} onRetry={() => void receivables.refetch()} />
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-5">
              {(
                [
                  ["current", aging?.current],
                  ["d1_30", aging?.d1_30],
                  ["d31_60", aging?.d31_60],
                  ["d61_90", aging?.d61_90],
                  ["over_90", aging?.over_90],
                ] as const
              ).map(([bucket, amount]) => (
                <div key={bucket} className="rounded-md border p-3">
                  <dt className="text-muted text-xs">{t(`aging.${bucket}`)}</dt>
                  <dd
                    className={`text-lg font-semibold tabular-nums ${bucket !== "current" && amount && amount !== "0.00" ? "text-danger" : ""}`}
                  >
                    {amount ? format.thb(amount) : "–"}
                  </dd>
                </div>
              ))}
            </dl>
            {(receivables.data?.notices ?? []).length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {receivables.data!.notices.map((notice, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-2">
                    <Badge
                      size="sm"
                      tone={notice.code === "due_soon" || notice.code === "due_today" ? "warning" : "danger"}
                    >
                      {t(`notices.${notice.code}`)}
                    </Badge>
                    {notice.amount ? <span className="tabular-nums">{format.thb(notice.amount)}</span> : null}
                    {notice.dueAt ? <When at={notice.dueAt} absoluteOnly /> : null}
                    {notice.groupCode ? <span className="font-mono">{notice.groupCode}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {receivables.data ? (
              <p className="text-muted mt-2 text-xs">
                {t("asOf")} <When at={`${receivables.data.asOf}T00:00:00+07:00`} absoluteOnly />
              </p>
            ) : null}
          </>
        )}
      </Section>

      <Section title={t("history")}>
        <DataTable
          caption={t("history")}
          columns={versionColumns}
          rows={figures?.versions ?? []}
          getRowId={(row) => row.id}
          loading={credit.isPending}
          density="compact"
          empty={<EmptyState icon="credit-card" title={t("noHistory")} />}
        />
      </Section>

      {requesting ? (
        <FormDialog
          title={t("requestTitle")}
          description={t("requestBody", { code: company.companyCode ?? "–", name: company.legalName })}
          submitLabel={t("send")}
          onClose={() => setRequesting(null)}
          onSubmit={async () => {
            if (!/^\d{1,12}(\.\d{1,2})?$/.test(draft.limitAmount) || /^0+(\.0+)?$/.test(draft.limitAmount))
              throw new FormError(t("needLimit"));
            if (draft.reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const [whole, fraction = ""] = draft.limitAmount.split(".");
              const { data } = await adminBrowserApis().contract.POST("/v1/admin/companies/{companyId}/credit-limits", {
                params: { path: { companyId: company.id }, header: { "Idempotency-Key": requesting.key } },
                body: {
                  limitAmount: `${whole}.${fraction.padEnd(2, "0")}`,
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
          <Field label={t("term")} hint={t("termHint")}>
            <SearchableSelect
              value={draft.termDays || undefined}
              placeholder={t("chooseTerm")}
              onValueChange={(termDays) => setDraft({ ...draft, termDays })}
              options={allowedTerms.map((days) => ({
                value: String(days),
                label: t(days === eligibility?.defaultTermDays ? "termDefault" : "termDays", { days }),
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

/**
 * The monthly statements issued so far (`admin.companyCredit.listStatements`, newest first) with
 * their PDF (`admin.receivables.companyStatementPdf`), and one month's figures in detail
 * (`admin.receivables.companyStatement`). A statement has no due date or status of its own: each
 * invoice keeps its credit term (D-121, D-125).
 */
function Statements({ company }: { company: Company }) {
  const t = useTranslations("companies.statements");
  const format = useFormat();
  // The figures and the PDF are receivables reads (`receivables.read`); the list is `companies.read`.
  const canRead = useCan("receivables.read");
  const [month, setMonth] = useState(bangkokMonth);
  const issued = useQuery({
    queryKey: queryKeys.related("admin", "company", company.id, "issued_statements"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/companies/{companyId}/issued-statements", {
          params: { path: { companyId: company.id } },
        })
      ).data!,
  });
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
  const pdf = useMutation({
    mutationFn: async (chosen: string) =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/companies/{companyId}/statements/{month}/pdf", {
          params: { path: { companyId: company.id, month: chosen } },
        })
      ).data!,
    onSuccess: (file) => download(file.url),
    onError: (error) => toast.error(problemMessage(error, t("pdfFailed"))),
  });
  const data = statement.data;
  const columns: DataTableColumn<IssuedStatement>[] = [
    { id: "month", header: t("month"), cell: (row) => <span className="font-mono">{row.month}</span> },
    { id: "opening", header: t("opening"), numeric: true, cell: (row) => format.thb(row.openingAmount) },
    { id: "invoiced", header: t("invoiced"), numeric: true, cell: (row) => format.thb(row.invoicedAmount) },
    { id: "credited", header: t("credited"), numeric: true, cell: (row) => format.thb(row.creditedAmount) },
    { id: "paid", header: t("paid"), numeric: true, cell: (row) => format.thb(row.paidAmount) },
    { id: "closing", header: t("closing"), numeric: true, cell: (row) => format.thb(row.closingAmount) },
    { id: "sentAt", header: t("sentAt"), cell: (row) => (row.sentAt ? <When at={row.sentAt} absoluteOnly /> : "–") },
    {
      id: "pdf",
      header: <span className="sr-only">{t("pdf")}</span>,
      cell: (row) =>
        canRead ? (
          <Button
            size="sm"
            variant="ghost"
            iconStart="download"
            disabled={!row.pdfReady}
            loading={pdf.isPending && pdf.variables === row.month}
            aria-label={t("pdfOf", { month: row.month })}
            onClick={() => pdf.mutate(row.month)}
          >
            {t("pdf")}
          </Button>
        ) : null,
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("issued")} description={t("note")}>
        {issued.isError ? <QueryError error={issued.error} onRetry={() => void issued.refetch()} /> : null}
        <DataTable
          caption={t("issued")}
          columns={columns}
          rows={issued.data ?? []}
          getRowId={(row) => row.id}
          loading={issued.isPending}
          density="compact"
          empty={<EmptyState icon="document" title={t("noneIssued")} />}
        />
      </Section>
      <Section
        title={t("title")}
        actions={
          canRead ? (
            <Field label={t("month")} className="w-44">
              <Input type="month" value={month} onChange={(event) => setMonth(event.target.value || month)} />
            </Field>
          ) : null
        }
      >
        {!canRead ? (
          <Callout tone="info" title={t("noAccess")} />
        ) : statement.isError ? (
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
    </div>
  );
}
