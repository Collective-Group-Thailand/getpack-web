"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PAYABLE_STATUS, PAYOUT_ITEM_STATUS, PAYOUT_RUN_STATUS } from "@/domain/status";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Dialog } from "@/ui/components/Dialog";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { useActor, useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { NextActionBar } from "../console/NextActionBar";
import { Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { ResourceList } from "../console/ResourceList";
import type { InitialPage } from "../console/resource";
import { StatusChip } from "../console/StatusChip";
import { payoutRunsList, type PayoutRun } from "./resources";
import { AccountNo, Figure } from "./shared";
import { invalidateMoney } from "./slips";

type Item = Schemas["PayoutItemDto"];

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

function useCompanyAccounts() {
  return useQuery({
    queryKey: queryKeys.list("admin", "company-bank-account"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/company-bank-accounts", {})).data!,
    staleTime: 5 * 60_000,
  });
}

/**
 * Payout runs (D-022, D-093, D-166): Finance builds a run from what is payable by a date, proposes
 * it, a C-Level other than the proposer approves it, the bank file goes out, and the bank's
 * confirmation posts each payment.
 */
export function PayoutRunsList({ initial }: { initial: InitialPage<PayoutRun> | null }) {
  const t = useTranslations("finance.payouts");
  const format = useFormat();
  const canManage = useCan("payouts.manage");
  const [creating, setCreating] = useState(false);
  const columns: DataTableColumn<PayoutRun>[] = [
    {
      id: "runNo",
      header: t("columns.run"),
      cell: (row) => (
        <Link
          href={`/finance/payouts/${row.id}`}
          className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
        >
          {row.runNo}
        </Link>
      ),
    },
    { id: "payOn", header: t("columns.payOn"), sortable: true, cell: (row) => format.date(row.payOn) },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={PAYOUT_RUN_STATUS} value={row.status} />,
    },
    {
      id: "items",
      header: t("columns.items"),
      numeric: true,
      cell: (row) => format.number(row.items.filter((item) => item.status !== "excluded").length),
    },
    { id: "cash", header: t("columns.cash"), numeric: true, cell: (row) => format.thb(row.cashAmount) },
    { id: "wht", header: t("columns.wht"), numeric: true, hideable: true, cell: (row) => format.thb(row.whtAmount) },
    {
      id: "retention",
      header: t("columns.retention"),
      numeric: true,
      hideable: true,
      cell: (row) => format.thb(row.retentionAmount),
    },
    {
      id: "bank",
      header: t("columns.bank"),
      cell: (row) => <AccountNo bank={row.bankAccount.bankCode} last4={row.bankAccount.accountNoLast4} />,
    },
  ];
  return (
    <>
      <ResourceList
        resource={payoutRunsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        toolbarEnd={
          <>
            <Button asChild variant="ghost" size="sm" iconStart="warning">
              <Link href="/finance/payouts/exceptions">{t("exceptions")}</Link>
            </Button>
            {canManage ? (
              <Button size="sm" iconStart="plus" onClick={() => setCreating(true)}>
                {t("new")}
              </Button>
            ) : null}
          </>
        }
        empty={{ title: t("empty") }}
      />
      {creating ? <NewRun onClose={() => setCreating(false)} /> : null}
    </>
  );
}

/** Builds a draft run: the pay date, the account the money leaves from, its bank-file format. */
function NewRun({ onClose }: { onClose: () => void }) {
  const t = useTranslations("finance.payouts.create");
  const tOpen = useTranslations("finance.payables.open");
  const tFinance = useTranslations("finance.common");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const accounts = useCompanyAccounts();
  const payoutAccounts = (accounts.data ?? []).filter(
    (account) => account.status === "active" && account.purpose !== "collection",
  );
  const [payOn, setPayOn] = useState(bangkokToday);
  const [accountId, setAccountId] = useState("");
  const chosen = accountId || payoutAccounts[0]?.id || "";
  const account = payoutAccounts.find((item) => item.id === chosen);
  const [bankFormat, setBankFormat] = useState<string>("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const eligible = useQuery({
    queryKey: queryKeys.list("admin", "payable", { eligible: payOn }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/payouts/eligible", { params: { query: { payOn } } })).data!,
  });

  async function create() {
    setBusy(true);
    try {
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/payout-runs", {
        params: { header: { "Idempotency-Key": idempotencyKey } },
        body: { payOn, companyBankAccountId: chosen, ...(bankFormat ? { bankFormat } : {}) },
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "payout-run") });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "payable") });
      toast.success(t("created", { run: data!.runNo }));
      router.push(`/finance/payouts/${data!.id}`);
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title")}
      description={t("description")}
      closeLabel={tCommon("actions.close")}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button loading={busy} disabled={!chosen || (eligible.data?.length ?? 0) === 0} onClick={() => void create()}>
            {t("create")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("payOn")} required requiredLabel={tCommon("state.required")}>
            <Input
              type="date"
              value={payOn}
              min={bangkokToday()}
              onChange={(event) => setPayOn(event.target.value || bangkokToday())}
            />
          </Field>
          <Field label={t("account")} required requiredLabel={tCommon("state.required")}>
            <Select
              value={chosen || undefined}
              onValueChange={setAccountId}
              placeholder={t("pickAccount")}
              options={payoutAccounts.map((item) => ({
                value: item.id,
                label: tFinance("accountOption", {
                  bank: item.bankCode,
                  last4: item.accountNoLast4,
                  gl: item.glAccountCode,
                }),
              }))}
            />
          </Field>
          <Field
            label={t("format")}
            hint={account ? t("formatDefault", { format: account.defaultBulkFormat }) : undefined}
          >
            <Select
              value={bankFormat || "default"}
              onValueChange={(value) => setBankFormat(value === "default" ? "" : value)}
              options={[
                { value: "default", label: t("formatAccount") },
                ...["scb_bulk_csv", "kbank_bulk_csv", "generic_csv"].map((value) => ({
                  value,
                  label: t(`formats.${value}`),
                })),
              ]}
            />
          </Field>
        </div>
        <Callout tone="info" title={t("rules")}>
          {t("rulesBody")}
        </Callout>
        <DataTable
          caption={t("eligible")}
          showCaption
          density="compact"
          rows={eligible.data ?? []}
          loading={eligible.isPending}
          getRowId={(row) => row.id}
          empty={<EmptyState icon="wallet" title={t("nothing")} />}
          columns={[
            { id: "vendor", header: tOpen("columns.vendor"), cell: (row) => row.vendorName },
            { id: "source", header: tOpen("columns.source"), cell: (row) => tOpen(`sources.${row.source}`) },
            { id: "eligibleAt", header: tOpen("columns.eligibleAt"), cell: (row) => format.date(row.eligibleAt) },
            { id: "net", header: tOpen("columns.net"), numeric: true, cell: (row) => format.thb(row.openNetAmount) },
            { id: "vat", header: tOpen("columns.vat"), numeric: true, cell: (row) => format.thb(row.openVatAmount) },
            {
              id: "status",
              header: tOpen("columns.status"),
              cell: (row) => <StatusChip map={PAYABLE_STATUS} value={row.status} />,
            },
          ]}
        />
      </div>
    </Dialog>
  );
}

type Action = "propose" | "cancel" | "file" | "confirm";

/** The verbs of `payout_run.*` this page performs, and the page's own words for them. */
const RUN_VERBS: ReadonlySet<string> = new Set(["propose", "cancel", "generate_bank_file", "confirm"]);
const RUN_LABELS: Record<string, "propose" | "cancel" | "generate" | "importConfirmation"> = {
  propose: "propose",
  cancel: "cancel",
  generate_bank_file: "generate",
  confirm: "importConfirmation",
};

/**
 * One payout run: what it pays each vendor (net, VAT, WHT and its form, retention held, cash) and
 * the step it is at. Every step that moves money restates the run number and the cash total, and
 * sends one idempotency key per intent.
 */
export function PayoutRunDetail({ runId }: { runId: string }) {
  const t = useTranslations("finance.payouts.detail");
  const tList = useTranslations("finance.payouts");
  const format = useFormat();
  const queryClient = useQueryClient();
  const actor = useActor();
  const canExecute = useCan("payouts.execute");
  const [action, setAction] = useState<Action | null>(null);
  const [documentsOf, setDocumentsOf] = useState<Item | null>(null);
  const key = queryKeys.detail("admin", "payout-run", runId);
  const run = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/payout-runs/{runId}", { params: { path: { runId } } })).data!,
  });
  const approval = useQuery({
    queryKey: queryKeys.detail("admin", "approval", run.data?.approvalRequestId ?? "none"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/approvals/{requestId}", {
          params: { path: { requestId: run.data!.approvalRequestId! } },
        })
      ).data!,
    enabled: Boolean(run.data?.approvalRequestId),
  });
  if (run.isError) return <QueryError error={run.error} onRetry={() => void run.refetch()} />;
  const data = run.data;
  if (!data) return null;

  const refresh = (updated?: PayoutRun) => {
    if (updated) queryClient.setQueryData(key, updated);
    invalidateMoney(queryClient);
    for (const resource of ["payout-run", "payable", "approval"])
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
  };
  const isProposer = approval.data?.requester.id === actor.id;

  async function step(path: "propose" | "generate-bank-file", idempotencyKey: string) {
    try {
      const { data: updated } =
        path === "propose"
          ? await adminBrowserApis().contract.POST("/v1/admin/payout-runs/{runId}/actions/propose", {
              params: { path: { runId }, header: { "Idempotency-Key": idempotencyKey } },
            })
          : await adminBrowserApis().contract.POST("/v1/admin/payout-runs/{runId}/actions/generate-bank-file", {
              params: { path: { runId }, header: { "Idempotency-Key": idempotencyKey } },
            });
      refresh(updated);
      toast.success(path === "propose" ? t("proposed") : t("fileReady"));
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
      throw error;
    }
  }

  async function downloadFile() {
    try {
      const { data: file } = await adminBrowserApis().contract.GET("/v1/admin/payout-runs/{runId}/bank-file", {
        params: { path: { runId } },
      });
      const link = document.createElement("a");
      link.href = file!.url;
      link.download = `${data!.runNo}-${data!.bankFormat}.csv`;
      link.click();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    }
  }

  const columns: DataTableColumn<Item>[] = [
    {
      id: "vendor",
      header: t("columns.vendor"),
      cell: (row) => (
        <div>
          <Link href={`/finance/payables/vendors/${row.vendorId}`} className="text-primary hover:underline">
            {row.vendorName}
          </Link>
          <p className="text-muted text-xs">{t(`kinds.${row.kind}`)}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={PAYOUT_ITEM_STATUS} value={row.status} />,
    },
    { id: "net", header: t("columns.net"), numeric: true, cell: (row) => format.thb(row.apNetAmount) },
    {
      id: "vat",
      header: t("columns.vat"),
      numeric: true,
      cell: (row) => (
        <span>
          {format.thb(row.vatAmount)}
          {row.vatAmount !== "0.00" && !row.vatClaimable ? (
            <span className="text-muted block text-xs">{t("vatPending")}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "wht",
      header: t("columns.wht"),
      numeric: true,
      cell: (row) => (
        <span>
          {format.thb(row.whtAmount)}
          {row.whtForm ? <span className="text-muted block text-xs">{t(`forms.${row.whtForm}`)}</span> : null}
        </span>
      ),
    },
    { id: "retention", header: t("columns.retention"), numeric: true, cell: (row) => format.thb(row.retentionAmount) },
    {
      id: "cash",
      header: t("columns.cash"),
      numeric: true,
      cell: (row) => <span className="font-semibold">{format.thb(row.cashAmount)}</span>,
    },
    {
      id: "bank",
      header: t("columns.bank"),
      cell: (row) =>
        row.bankAccountLast4 ? (
          <AccountNo last4={row.bankAccountLast4} />
        ) : (
          <span className="text-danger text-sm">{t("noAccount")}</span>
        ),
    },
    {
      id: "result",
      header: t("columns.result"),
      cell: (row) =>
        row.status === "paid" ? (
          <button type="button" className="text-primary text-start hover:underline" onClick={() => setDocumentsOf(row)}>
            <span className="font-mono text-sm whitespace-nowrap">{row.pvNumber}</span>
            <span className="block text-xs">{t("documents")}</span>
          </button>
        ) : row.failureReason ? (
          <span className="text-danger text-sm">{row.failureReason}</span>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: tList("title"), href: "/finance/payouts" }, { label: data.runNo }]}
          />
        }
        title={t("title", { run: data.runNo })}
        meta={<StatusChip map={PAYOUT_RUN_STATUS} value={data.status} size="md" />}
        description={t("description", { payOn: format.date(data.payOn), format: data.bankFormat })}
        actions={
          <>
            {canExecute && data.bankFileReady ? (
              <Button variant="secondary" iconStart="download" onClick={() => void downloadFile()}>
                {t("download")}
              </Button>
            ) : null}
            {/* What the API offers on this run, for this person (`nextActions`, D-093). */}
            <NextActionBar
              actions={data.nextActions}
              supported={RUN_VERBS}
              labelOf={(verb) => RUN_LABELS[verb] && t(RUN_LABELS[verb])}
              onAction={(verb) => setAction(verb === "generate_bank_file" ? "file" : (verb as Action))}
            />
          </>
        }
      />

      {data.status === "proposed" ? (
        <Callout tone="warning" title={t("waitingTitle")}>
          {isProposer ? t("waitingProposer") : t("waitingBody")}{" "}
          {data.approvalRequestId ? (
            <Link href={`/approvals/${data.approvalRequestId}`} className="text-primary hover:underline">
              {t("openApproval")}
            </Link>
          ) : null}
        </Callout>
      ) : null}
      {data.status === "rejected" ? (
        <Callout tone="danger" title={t("rejectedTitle")}>
          {t("rejectedBody")}
        </Callout>
      ) : null}
      {data.items.some((item) => item.status === "excluded") ? (
        <Callout tone="warning" title={t("excludedTitle")}>
          {t("excludedBody")}
        </Callout>
      ) : null}

      <Section title={t("totals")}>
        <dl className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Figure label={t("apNet")} amount={data.apNetAmount} />
          <Figure label={t("vat")} amount={data.vatAmount} />
          <Figure label={t("wht")} amount={data.whtAmount} />
          <Figure label={t("retention")} amount={data.retentionAmount} />
          <Figure label={t("cash")} amount={data.cashAmount} />
        </dl>
        <DescriptionList
          className="mt-4"
          columns={3}
          items={[
            {
              term: t("account"),
              description: (
                <AccountNo
                  bank={data.bankAccount.bankCode}
                  last4={data.bankAccount.accountNoLast4}
                  gl={data.bankAccount.glAccountCode}
                />
              ),
            },
            { term: t("format"), description: data.bankFormat },
            {
              term: t("approval"),
              description: data.approvalRequestId ? (
                <Link href={`/approvals/${data.approvalRequestId}`} className="text-primary hover:underline">
                  {approval.data ? t("approvalBy", { name: approval.data.requester.displayName }) : t("openApproval")}
                </Link>
              ) : (
                "—"
              ),
            },
          ]}
        />
      </Section>

      <Section title={t("items")}>
        <DataTable
          caption={t("items")}
          columns={columns}
          rows={data.items}
          getRowId={(row) => row.id}
          density="compact"
          rowTone={(row) => (row.status === "failed" ? "danger" : row.status === "excluded" ? "warning" : undefined)}
        />
      </Section>

      {action === "propose" || action === "file" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={action === "propose" ? t("proposeTitle") : t("generateTitle")}
          description={
            action === "propose"
              ? t("proposeBody", { run: data.runNo, cash: format.thb(data.cashAmount) })
              : t("generateBody", { run: data.runNo, cash: format.thb(data.cashAmount), format: data.bankFormat })
          }
          confirmLabel={action === "propose" ? t("propose") : t("generate")}
          confirmationPhrase={data.runNo}
          onConfirm={({ idempotencyKey }) =>
            step(action === "propose" ? "propose" : "generate-bank-file", idempotencyKey)
          }
        />
      ) : null}
      {action === "cancel" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("cancelTitle")}
          description={t("cancelBody", { run: data.runNo })}
          confirmLabel={t("cancel")}
          tone="destructive"
          reason={{ label: t("cancelReason"), required: true, minLength: 3 }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              const { data: updated } = await adminBrowserApis().contract.POST(
                "/v1/admin/payout-runs/{runId}/actions/cancel",
                {
                  params: { path: { runId }, header: { "Idempotency-Key": idempotencyKey } },
                  body: { reason },
                },
              );
              refresh(updated);
              toast.success(t("cancelled"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
      {action === "confirm" ? <ImportConfirmation run={data} onClose={() => setAction(null)} onDone={refresh} /> : null}
      {documentsOf ? <ItemDocuments run={data} item={documentsOf} onClose={() => setDocumentsOf(null)} /> : null}
    </div>
  );
}

/**
 * The bank's result per item, typed in or as the bank's own file (parsed by the run's adapter).
 * Paid items get a PV number and post; failed ones go back to the queue as exceptions.
 */
function ImportConfirmation({
  run,
  onClose,
  onDone,
}: {
  run: PayoutRun;
  onClose: () => void;
  onDone: (run?: PayoutRun) => void;
}) {
  const t = useTranslations("finance.payouts.confirm");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const included = run.items.filter((item) => item.status === "included");
  const [mode, setMode] = useState<"lines" | "file">("lines");
  const [results, setResults] = useState<
    Record<string, { status: "paid" | "failed"; bankRef: string; reason: string }>
  >(Object.fromEntries(included.map((item) => [item.id, { status: "paid" as const, bankRef: "", reason: "" }])));
  const [file, setFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const failed = Object.values(results).filter((result) => result.status === "failed").length;

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title", { run: run.runNo })}
      description={t("description")}
      closeLabel={tCommon("actions.close")}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button disabled={mode === "file" && !file} onClick={() => setConfirming(true)}>
            {t("review")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl<"lines" | "file">
          label={t("mode")}
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "lines", label: t("modes.lines"), icon: "list-bullet" },
            { value: "file", label: t("modes.file"), icon: "upload" },
          ]}
        />
        {mode === "file" ? (
          <FileDropzone
            accept=".csv,.txt,text/csv"
            maxBytes={5 * 1024 * 1024}
            onFiles={([picked]) => setFile(picked ?? null)}
            labels={{
              prompt: file ? t("chosen", { name: file.name }) : t("drop"),
              browse: t("browse"),
              tooLarge: (name) => t("tooLarge", { name }),
              wrongType: (name) => t("wrongType", { name }),
            }}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {included.map((item) => {
              const result = results[item.id]!;
              const set = (patch: Partial<typeof result>) =>
                setResults({ ...results, [item.id]: { ...result, ...patch } });
              return (
                <li key={item.id} className="border-border grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium">{item.vendorName}</p>
                    <p className="text-muted text-sm tabular-nums">
                      {format.thb(item.cashAmount)} · <AccountNo last4={item.bankAccountLast4} />
                    </p>
                  </div>
                  <SegmentedControl<"paid" | "failed">
                    label={t("outcome", { vendor: item.vendorName })}
                    size="sm"
                    value={result.status}
                    onValueChange={(status) => set({ status })}
                    options={[
                      { value: "paid", label: t("paid") },
                      { value: "failed", label: t("failedOption") },
                    ]}
                  />
                  <Field label={result.status === "paid" ? t("bankRef") : t("reason")} className="sm:col-span-2">
                    <Input
                      value={result.status === "paid" ? result.bankRef : result.reason}
                      onChange={(event) =>
                        set(result.status === "paid" ? { bankRef: event.target.value } : { reason: event.target.value })
                      }
                    />
                  </Field>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle")}
        description={
          mode === "file"
            ? t("confirmFile", { run: run.runNo, name: file?.name ?? "" })
            : t("confirmLines", { run: run.runNo, paid: included.length - failed, failed })
        }
        confirmLabel={t("post")}
        confirmationPhrase={run.runNo}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            const uploaded = mode === "file" && file ? await uploadFile("admin", file, "document") : null;
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/payout-runs/{runId}/actions/confirm", {
              params: { path: { runId: run.id }, header: { "Idempotency-Key": idempotencyKey } },
              body: uploaded
                ? { fileId: uploaded.id }
                : {
                    confirmations: included.map((item) => {
                      const result = results[item.id]!;
                      return result.status === "paid"
                        ? {
                            reference: item.id,
                            status: "paid" as const,
                            ...(result.bankRef.trim() ? { bankRef: result.bankRef.trim() } : {}),
                          }
                        : {
                            reference: item.id,
                            status: "failed" as const,
                            ...(result.reason.trim() ? { reason: result.reason.trim() } : {}),
                          };
                    }),
                  },
            });
            onDone(data);
            toast.success(t("posted"));
            onClose();
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </Dialog>
  );
}

/** A paid item's remittance advice and 50 ทวิ (`admin.payouts.itemDocuments`, D-022), as signed URLs. */
function ItemDocuments({ run, item, onClose }: { run: PayoutRun; item: Item; onClose: () => void }) {
  const t = useTranslations("finance.payouts.itemDocuments");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const docs = useQuery({
    queryKey: queryKeys.related("admin", "payout-run", run.id, `documents:${item.id}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/payout-runs/{runId}/items/{itemId}/documents", {
          params: { path: { runId: run.id, itemId: item.id } },
        })
      ).data!,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title", { pv: item.pvNumber ?? "" })}
      description={item.vendorName}
      closeLabel={tCommon("actions.close")}
    >
      {docs.isError ? (
        <QueryError error={docs.error} onRetry={() => void docs.refetch()} />
      ) : !docs.data ? null : (
        <ul className="flex flex-col gap-3">
          <li>
            <a
              href={docs.data.remittanceAdvice.url}
              download={`${item.pvNumber}-remittance.pdf`}
              className="text-primary hover:underline"
            >
              {t("remittance")}
            </a>
          </li>
          {docs.data.whtCertificates.map((certificate) => (
            <li key={certificate.id}>
              {certificate.download ? (
                <a
                  href={certificate.download.url}
                  download={`${certificate.wtNumber}.pdf`}
                  className="text-primary hover:underline"
                >
                  {t("certificate", { number: certificate.wtNumber, form: t(`forms.${certificate.form}`) })}
                </a>
              ) : (
                <span>
                  {t("certificate", { number: certificate.wtNumber, form: t(`forms.${certificate.form}`) })}
                  <span className="text-muted"> · {t("notRendered")}</span>
                </span>
              )}
              <span className="text-muted block text-sm tabular-nums">
                {t("certificateAmounts", {
                  paid: format.thb(certificate.paidAmount),
                  rate: format.percent(certificate.whtRatePct),
                  amount: format.thb(certificate.whtAmount),
                  date: format.date(certificate.paidOn),
                })}
              </span>
            </li>
          ))}
          {docs.data.whtCertificates.length === 0 ? <li className="text-muted text-sm">{t("noWht")}</li> : null}
        </ul>
      )}
    </Dialog>
  );
}

/** Failed transfers and items excluded for a missing bank account (§8 exception report). */
export function PayoutExceptions() {
  const t = useTranslations("finance.payouts.exceptionsPage");
  const format = useFormat();
  const rows = useQuery({
    queryKey: queryKeys.list("admin", "payout-exception"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/payout-exceptions", {})).data!,
  });
  if (rows.isError) return <QueryError error={rows.error} onRetry={() => void rows.refetch()} />;
  return (
    <Section title={t("title")} description={t("description")}>
      <DataTable
        caption={t("title")}
        density="compact"
        rows={rows.data ?? []}
        loading={rows.isPending}
        getRowId={(row) => row.id}
        empty={<EmptyState icon="check" title={t("empty")} />}
        columns={[
          {
            id: "run",
            header: t("run"),
            cell: (row) => (
              <Link href={`/finance/payouts/${row.runId}`} className="text-primary font-mono text-sm hover:underline">
                {row.runNo}
              </Link>
            ),
          },
          { id: "vendor", header: t("vendor"), cell: (row) => row.vendorName },
          {
            id: "status",
            header: t("status"),
            cell: (row) => <StatusChip map={PAYOUT_ITEM_STATUS} value={row.status} />,
          },
          { id: "cash", header: t("cash"), numeric: true, cell: (row) => format.thb(row.cashAmount) },
          { id: "reason", header: t("reason"), cell: (row) => row.failureReason ?? "–" },
        ]}
      />
    </Section>
  );
}
