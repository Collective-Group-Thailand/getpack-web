"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { isZeroMoney } from "@/domain/money";
import { ASSET_STATUS, PERIOD_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { FormDialog, FormError, Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { ResourceList } from "../console/ResourceList";
import type { InitialPage } from "../console/resource";
import { SectionNav } from "../console/SectionNav";
import { StatusChip } from "../console/StatusChip";
import {
  AccountPicker,
  PostingPeriodNotice,
  postingPeriodOf,
  useAccounts,
  useCostCentres,
  useFiscalYears,
} from "./ledger";
import { fixedAssetsList, type FixedAsset } from "./resources";
import { Figure, fieldErrorsOf, SourceJournals } from "./shared";

type Category = Schemas["AssetCategoryDto"];

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const thisMonth = () => bangkokToday().slice(0, 7);

export function AssetsNav() {
  const t = useTranslations("finance.assets.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/finance/assets", label: t("register"), exact: true },
        { href: "/finance/assets/depreciation", label: t("depreciation") },
        { href: "/finance/assets/categories", label: t("categories") },
        { href: "/finance/assets/roll-forward", label: t("rollForward") },
      ]}
    />
  );
}

function useCategories() {
  return useQuery({
    queryKey: queryKeys.list("admin", "asset-category"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/asset-categories")).data!,
    staleTime: 60_000,
  });
}

/* ---------------------------------------------------------------------------------- register */

/** The fixed-asset register (D-150): cost, accumulated depreciation and net book value per asset. */
export function AssetRegister({ initial }: { initial: InitialPage<FixedAsset> | null }) {
  const t = useTranslations("finance.assets.register");
  const format = useFormat();
  const canManage = useCan("fixed_assets.manage");
  const categories = useCategories();
  const [registering, setRegistering] = useState(false);
  const columns: DataTableColumn<FixedAsset>[] = [
    {
      id: "assetNo",
      header: t("columns.asset"),
      cell: (row) => (
        <div>
          <Link
            href={`/finance/assets/${row.id}`}
            className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
          >
            {row.assetNo}
          </Link>
          <p className="text-sm">{row.name}</p>
        </div>
      ),
    },
    {
      id: "category",
      header: t("columns.category"),
      cell: (row) => categories.data?.find((item) => item.id === row.categoryId)?.nameTh ?? row.categoryCode,
    },
    { id: "acquiredOn", header: t("columns.acquiredOn"), sortable: true, cell: (row) => format.date(row.acquiredOn) },
    {
      id: "life",
      header: t("columns.life"),
      numeric: true,
      hideable: true,
      cell: (row) => t("months", { count: row.usefulLifeMonths }),
    },
    { id: "cost", header: t("columns.cost"), numeric: true, cell: (row) => format.thb(row.cost) },
    {
      id: "accumulated",
      header: t("columns.accumulated"),
      numeric: true,
      cell: (row) => format.thb(row.accumulatedDepreciation),
    },
    {
      id: "nbv",
      header: t("columns.nbv"),
      numeric: true,
      cell: (row) => <span className="font-semibold">{format.thb(row.netBookValue)}</span>,
    },
    { id: "status", header: t("columns.status"), cell: (row) => <StatusChip map={ASSET_STATUS} value={row.status} /> },
  ];
  return (
    <>
      <ResourceList
        resource={fixedAssetsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: (["active", "fully_depreciated", "disposed", "written_off"] as const).map((value) => ({
              value,
              label: t(`statuses.${value}`),
            })),
          },
          {
            id: "categoryId",
            label: t("columns.category"),
            kind: "select",
            options: (categories.data ?? []).map((item) => ({ value: item.id, label: item.nameTh })),
          },
        ]}
        toolbarEnd={
          canManage ? (
            <Button size="sm" iconStart="plus" onClick={() => setRegistering(true)}>
              {t("new")}
            </Button>
          ) : null
        }
        empty={{ title: t("empty") }}
      />
      {registering ? <RegisterAsset onClose={() => setRegistering(false)} /> : null}
    </>
  );
}

function RegisterAsset({ onClose }: { onClose: () => void }) {
  const t = useTranslations("finance.assets.new");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const accounts = useAccounts();
  const costCentres = useCostCentres();
  const bills = useQuery({
    queryKey: queryKeys.list("admin", "vendor-invoice", { assets: true }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/vendor-invoices", { params: { query: { perPage: 100 } } }))
        .data!,
  });
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    source: "manual" as Schemas["AssetSource"],
    categoryId: "",
    name: "",
    acquiredOn: bangkokToday(),
    cost: "",
    residualValue: "0.00",
    creditAccountCode: "",
    vendorInvoiceId: "",
    costCentreCode: "",
    location: "",
  });
  const category = categories.data?.find((item) => item.id === form.categoryId);
  const withAssetLines = (bills.data?.data ?? []).filter(
    (bill) =>
      ["recorded", "validated"].includes(bill.status) &&
      bill.lines.some((line) => line.accountCode === (category?.assetAccountCode ?? "1510")),
  );
  return (
    <FormDialog
      title={t("title")}
      description={t("description")}
      submitLabel={t("register")}
      onClose={onClose}
      onSubmit={async () => {
        if (!form.categoryId) throw new FormError(t("pickCategory"));
        setErrors({});
        try {
          const { data } = await adminBrowserApis().contract.POST("/v1/admin/fixed-assets", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: {
              source: form.source,
              categoryId: form.categoryId,
              name: form.name.trim(),
              acquiredOn: form.acquiredOn,
              cost: form.cost.trim(),
              residualValue: form.residualValue.trim() || "0.00",
              ...(form.source === "manual"
                ? { creditAccountCode: form.creditAccountCode }
                : { vendorInvoiceId: form.vendorInvoiceId }),
              ...(form.costCentreCode ? { costCentreCode: form.costCentreCode } : {}),
              ...(form.location.trim() ? { location: form.location.trim() } : {}),
            },
          });
          void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "fixed-asset") });
          void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "journal") });
          toast.success(t("registered", { asset: data!.assetNo }));
          router.push(`/finance/assets/${data!.id}`);
        } catch (error) {
          setErrors(fieldErrorsOf(error));
          throw error;
        }
      }}
    >
      <SegmentedControl<Schemas["AssetSource"]>
        label={t("source")}
        value={form.source}
        onValueChange={(source) => setForm({ ...form, source })}
        options={[
          { value: "manual", label: t("sources.manual") },
          { value: "vendor_bill", label: t("sources.vendor_bill") },
        ]}
      />
      <p className="text-muted text-sm">{t(`sourceNotes.${form.source}`)}</p>
      <Field label={t("category")} required requiredLabel={tCommon("state.required")}>
        <Select
          value={form.categoryId || undefined}
          onValueChange={(categoryId) => setForm({ ...form, categoryId })}
          placeholder={t("pickCategory")}
          options={(categories.data ?? [])
            .filter((item) => item.status === "active")
            .map((item) => ({
              value: item.id,
              label: t("categoryOption", { name: item.nameTh, months: item.usefulLifeMonths }),
            }))}
        />
      </Field>
      <Field label={t("name")} required requiredLabel={tCommon("state.required")} error={errors.name}>
        <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("acquiredOn")} error={errors.acquiredOn}>
          <Input
            type="date"
            value={form.acquiredOn}
            onChange={(event) => setForm({ ...form, acquiredOn: event.target.value })}
          />
        </Field>
        <Field label={t("cost")} hint={t("costHint")} error={errors.cost}>
          <Input
            inputMode="decimal"
            value={form.cost}
            onChange={(event) => setForm({ ...form, cost: event.target.value })}
          />
        </Field>
        <Field label={t("residual")} error={errors.residualValue}>
          <Input
            inputMode="decimal"
            value={form.residualValue}
            onChange={(event) => setForm({ ...form, residualValue: event.target.value })}
          />
        </Field>
      </div>
      {form.source === "manual" ? (
        <Field label={t("creditAccount")} hint={t("creditAccountHint")} error={errors.creditAccountCode}>
          <AccountPicker
            label={t("creditAccount")}
            value={form.creditAccountCode}
            onChange={(creditAccountCode) => setForm({ ...form, creditAccountCode })}
            accounts={accounts.data ?? []}
            filter={(account) =>
              ["asset", "liability", "equity"].includes(account.accountType) &&
              account.code !== category?.assetAccountCode
            }
          />
        </Field>
      ) : (
        <Field label={t("bill")} hint={t("billHint")} error={errors.vendorInvoiceId}>
          <Select
            value={form.vendorInvoiceId || undefined}
            onValueChange={(vendorInvoiceId) => setForm({ ...form, vendorInvoiceId })}
            placeholder={withAssetLines.length ? t("pickBill") : t("noBills")}
            disabled={!withAssetLines.length}
            options={withAssetLines.map((bill) => ({
              value: bill.id,
              label: `${bill.vendorInvoiceNo} · ${bill.vendorName}`,
            }))}
          />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("costCentre")}>
          <Select
            value={form.costCentreCode || "none"}
            onValueChange={(value) => setForm({ ...form, costCentreCode: value === "none" ? "" : value })}
            options={[
              { value: "none", label: t("noCostCentre") },
              ...(costCentres.data ?? []).map((item) => ({ value: item.code, label: `${item.code} · ${item.name}` })),
            ]}
          />
        </Field>
        <Field label={t("location")}>
          <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        </Field>
      </div>
      <PostingPeriodNotice date={form.acquiredOn} what={t("thePosting")} />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------------------------ detail */

/** One asset: its snapshot, the depreciation schedule posted so far, its journals, disposal. */
export function AssetDetail({ assetId }: { assetId: string }) {
  const t = useTranslations("finance.assets.detail");
  const tList = useTranslations("finance.assets.register");
  const format = useFormat();
  const canDispose = useCan("fixed_assets.dispose");
  const [disposing, setDisposing] = useState(false);
  const asset = useQuery({
    queryKey: queryKeys.detail("admin", "fixed-asset", assetId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/fixed-assets/{assetId}", { params: { path: { assetId } } }))
        .data!,
  });
  const schedule = useQuery({
    queryKey: queryKeys.related("admin", "fixed-asset", assetId, "depreciation"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/fixed-assets/{assetId}/depreciation", {
          params: { path: { assetId } },
        })
      ).data!,
  });
  const categories = useCategories();
  if (asset.isError) return <QueryError error={asset.error} onRetry={() => void asset.refetch()} />;
  const data = asset.data;
  if (!data) return null;
  const category = categories.data?.find((item) => item.id === data.categoryId);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: tList("title"), href: "/finance/assets" }, { label: data.assetNo }]}
          />
        }
        title={t("title", { asset: data.assetNo, name: data.name })}
        meta={<StatusChip map={ASSET_STATUS} value={data.status} size="md" />}
        actions={
          canDispose && ["active", "fully_depreciated"].includes(data.status) ? (
            <Button variant="secondary" onClick={() => setDisposing(true)}>
              {t("dispose")}
            </Button>
          ) : null
        }
      />
      <Section title={t("values")}>
        <dl className="grid gap-3 sm:grid-cols-4">
          <Figure label={t("cost")} amount={data.cost} />
          <Figure label={t("residual")} amount={data.residualValue} />
          <Figure label={t("accumulated")} amount={data.accumulatedDepreciation} />
          <Figure label={t("nbv")} amount={data.netBookValue} />
        </dl>
        <DescriptionList
          className="mt-4"
          columns={3}
          items={[
            {
              term: t("category"),
              description: category ? `${category.nameTh} (${category.code})` : data.categoryCode,
            },
            { term: t("acquiredOn"), description: format.date(data.acquiredOn) },
            { term: t("depreciationStart"), description: format.date(data.depreciationStartOn, { style: "month" }) },
            { term: t("life"), description: tList("months", { count: data.usefulLifeMonths }) },
            { term: t("method"), description: t("straightLine") },
            { term: t("source"), description: t(`sources.${data.source}`) },
            {
              term: t("accounts"),
              description: (
                <span className="font-mono text-sm">
                  {data.assetAccountCode}
                  {data.creditAccountCode ? ` / ${data.creditAccountCode}` : ""}
                </span>
              ),
            },
            { term: t("costCentre"), description: data.costCentreCode ?? "—" },
            { term: t("location"), description: data.location ?? "—" },
            ...(data.disposedOn
              ? [
                  { term: t("disposedOn"), description: format.date(data.disposedOn) },
                  { term: t("proceeds"), description: format.thb(data.disposalProceeds) },
                ]
              : []),
          ]}
        />
      </Section>
      <Section title={t("schedule")} description={t("scheduleNote")}>
        <DataTable
          caption={t("schedule")}
          rows={schedule.data ?? []}
          loading={schedule.isPending}
          getRowId={(row) => `${row.runId}-${row.period}`}
          density="compact"
          empty={<EmptyState icon="calendar" title={t("noDepreciation")} />}
          columns={[
            { id: "period", header: t("period"), cell: (row) => format.date(`${row.period}-01`, { style: "month" }) },
            { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.amount) },
            {
              id: "after",
              header: t("accumulatedAfter"),
              numeric: true,
              cell: (row) => format.thb(row.accumulatedAfter),
            },
          ]}
        />
      </Section>
      <SourceJournals sourceType="fixed_asset" sourceId={data.id} />
      {disposing ? <DisposeAsset asset={data} onClose={() => setDisposing(false)} /> : null}
    </div>
  );
}

function DisposeAsset({ asset, onClose }: { asset: FixedAsset; onClose: () => void }) {
  const t = useTranslations("finance.assets.dispose");
  const format = useFormat();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const [kind, setKind] = useState<Schemas["AssetDisposalKind"]>("sold");
  const [disposedOn, setDisposedOn] = useState(bangkokToday);
  const [proceeds, setProceeds] = useState("");
  const [proceedsAccountCode, setProceedsAccountCode] = useState("");
  return (
    <ConfirmAction
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title", { asset: asset.assetNo })}
      description={t("body", { cost: format.thb(asset.cost), accumulated: format.thb(asset.accumulatedDepreciation) })}
      confirmLabel={t(kind === "sold" ? "sell" : "writeOff")}
      tone="destructive"
      confirmationPhrase={asset.assetNo}
      reason={{ label: t("reason"), required: true, minLength: 3 }}
      onConfirm={async ({ idempotencyKey, reason }) => {
        try {
          await adminBrowserApis().contract.POST("/v1/admin/fixed-assets/{assetId}/actions/dispose", {
            params: { path: { assetId: asset.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              kind,
              disposedOn,
              reason,
              ...(kind === "sold" && proceeds.trim() ? { proceeds: proceeds.trim(), proceedsAccountCode } : {}),
            },
          });
          for (const resource of ["fixed-asset", "journal", "asset-roll-forward"])
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
          toast.success(t("done"));
        } catch (error) {
          toast.error(problemMessage(error, t("failed")));
          throw error;
        }
      }}
    >
      <SegmentedControl<Schemas["AssetDisposalKind"]>
        label={t("kind")}
        value={kind}
        onValueChange={setKind}
        options={[
          { value: "sold", label: t("kinds.sold") },
          { value: "written_off", label: t("kinds.written_off") },
        ]}
      />
      <Field label={t("disposedOn")} hint={t("disposedOnHint")}>
        <Input
          type="date"
          value={disposedOn}
          onChange={(event) => setDisposedOn(event.target.value || bangkokToday())}
        />
      </Field>
      {kind === "sold" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("proceeds")} hint={t("proceedsHint")}>
            <Input inputMode="decimal" value={proceeds} onChange={(event) => setProceeds(event.target.value)} />
          </Field>
          <Field label={t("proceedsAccount")}>
            <AccountPicker
              label={t("proceedsAccount")}
              value={proceedsAccountCode}
              onChange={setProceedsAccountCode}
              accounts={accounts.data ?? []}
              filter={(account) => account.accountType === "asset"}
            />
          </Field>
        </div>
      ) : null}
      <PostingPeriodNotice date={disposedOn} what={t("thePosting")} />
    </ConfirmAction>
  );
}

/* ------------------------------------------------------------------------------ depreciation */

/**
 * The month's depreciation (D-150): what it would post per asset, then posted as one FA02 entry.
 * One run per month, into an open month only — a month that no longer takes postings says so
 * and the post button is not offered.
 */
export function DepreciationView() {
  const t = useTranslations("finance.assets.depreciation");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("fixed_assets.manage");
  const years = useFiscalYears();
  const [month, setMonth] = useState(thisMonth);
  const preview = useQuery({
    queryKey: queryKeys.detail("admin", "depreciation-preview", month),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/depreciation-runs/preview", {
          params: { query: { period: month } },
        })
      ).data!,
  });
  const runs = useQuery({
    queryKey: queryKeys.list("admin", "depreciation-run"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/depreciation-runs")).data!,
  });
  const [confirming, setConfirming] = useState(false);
  const months = (years.data ?? [])
    .flatMap((year) => year.periods)
    .filter((period) => period.startDate <= bangkokToday())
    .map((period) => period.startDate.slice(0, 7))
    .reverse();
  const period = postingPeriodOf(years.data, `${month}-01`).own;
  const data = preview.data;
  const blocked = !period || period.status !== "open";
  return (
    <div className="flex flex-col gap-5">
      <Section
        title={t("title", { month: format.date(`${month}-01`, { style: "month" }) })}
        description={t("description")}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("month")} className="w-44">
              <Select
                value={month}
                onValueChange={setMonth}
                options={(months.length ? months : [month]).map((value) => ({
                  value,
                  label: format.date(`${value}-01`, { style: "month" }),
                }))}
              />
            </Field>
            {canManage ? (
              <Button
                disabled={blocked || !data || data.alreadyRun || data.assetCount === 0}
                onClick={() => setConfirming(true)}
              >
                {t("post")}
              </Button>
            ) : null}
          </div>
        }
      >
        {period ? (
          <p className="mb-3 flex items-center gap-2 text-sm">
            {t("periodIs")} <StatusChip map={PERIOD_STATUS} value={period.status} />
          </p>
        ) : null}
        {blocked ? (
          <Callout tone="warning" title={t("blockedTitle")} className="mb-3">
            {t("blockedBody")}
          </Callout>
        ) : data?.alreadyRun ? (
          <Callout tone="success" title={t("doneTitle")} className="mb-3">
            {t("doneBody")}
          </Callout>
        ) : null}
        {preview.isError ? <QueryError error={preview.error} onRetry={() => void preview.refetch()} /> : null}
        <DataTable
          caption={t("preview")}
          showCaption
          rows={data?.lines ?? []}
          loading={preview.isPending}
          getRowId={(row) => row.assetId}
          density="compact"
          empty={<EmptyState icon="calendar" title={data?.alreadyRun ? t("nothingLeft") : t("nothing")} />}
          columns={[
            {
              id: "asset",
              header: t("asset"),
              cell: (row) => (
                <Link href={`/finance/assets/${row.assetId}`} className="text-primary hover:underline">
                  <span className="font-mono text-sm">{row.assetNo}</span> {row.name}
                </Link>
              ),
            },
            // CONTRACT-GAP admin.depreciation-preview — a preview line carries no category, net book value or
            // "fully depreciated" flag, so those columns are left out (the asset page shows them).
            { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.amount) },
            {
              id: "after",
              header: t("accumulatedAfter"),
              numeric: true,
              cell: (row) => format.thb(row.accumulatedAfter),
            },
          ]}
        />
        {data ? (
          <p className="text-muted mt-2 text-end text-sm tabular-nums">
            {t("total", { count: data.assetCount, amount: format.thb(data.totalAmount) })}
          </p>
        ) : null}
      </Section>
      <Section title={t("runs")}>
        <DataTable
          caption={t("runs")}
          rows={runs.data ?? []}
          loading={runs.isPending}
          getRowId={(row) => row.id}
          density="compact"
          empty={<EmptyState icon="calendar" title={t("noRuns")} />}
          columns={[
            { id: "period", header: t("month"), cell: (row) => format.date(`${row.period}-01`, { style: "month" }) },
            { id: "runOn", header: t("runOn"), cell: (row) => format.date(row.runOn) },
            { id: "assets", header: t("assets"), numeric: true, cell: (row) => format.number(row.assetCount) },
            { id: "total", header: t("amount"), numeric: true, cell: (row) => format.thb(row.totalAmount) },
            {
              id: "journal",
              header: t("journal"),
              cell: (row) => (
                <Link
                  href={`/finance/ledger/journals?sourceType=depreciation_run&sourceId=${row.id}`}
                  className="text-primary text-sm hover:underline"
                >
                  {t("openJournal")}
                </Link>
              ),
            },
          ]}
        />
      </Section>
      {confirming && data ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setConfirming(false))}
          title={t("confirmTitle", { month: format.date(`${month}-01`, { style: "month" }) })}
          description={t("confirmBody", { count: data.assetCount, amount: format.thb(data.totalAmount) })}
          confirmLabel={t("post")}
          confirmationPhrase={month}
          onConfirm={async ({ idempotencyKey }) => {
            try {
              await adminBrowserApis().contract.POST("/v1/admin/depreciation-runs", {
                params: { header: { "Idempotency-Key": idempotencyKey } },
                body: { period: month },
              });
              for (const resource of [
                "depreciation-run",
                "depreciation-preview",
                "fixed-asset",
                "journal",
                "asset-roll-forward",
              ])
                void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
              toast.success(t("posted"));
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

/* -------------------------------------------------------------------------------- categories */

/** Asset categories (D-150): their accounts and useful life, snapshotted on each asset registered. */
export function AssetCategories() {
  const t = useTranslations("finance.assets.categories");
  const canManage = useCan("fixed_assets.manage");
  const categories = useCategories();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  if (categories.isError) return <QueryError error={categories.error} onRetry={() => void categories.refetch()} />;
  return (
    <Section
      title={t("title")}
      description={t("description")}
      actions={
        canManage ? (
          <Button size="sm" iconStart="plus" onClick={() => setEditing("new")}>
            {t("new")}
          </Button>
        ) : null
      }
    >
      <DataTable
        caption={t("title")}
        rows={categories.data ?? []}
        loading={categories.isPending}
        getRowId={(row) => row.id}
        density="compact"
        columns={[
          {
            id: "name",
            header: t("name"),
            cell: (row) => (
              <div>
                {row.nameTh}
                <p className="text-muted font-mono text-xs">{row.code}</p>
              </div>
            ),
          },
          { id: "life", header: t("life"), numeric: true, cell: (row) => t("months", { count: row.usefulLifeMonths }) },
          { id: "method", header: t("method"), cell: () => t("straightLine") },
          {
            id: "accounts",
            header: t("accounts"),
            cell: (row) => (
              <span className="font-mono text-xs">
                {t("accountsValue", {
                  asset: row.assetAccountCode,
                  accumulated: row.accumulatedAccountCode,
                  expense: row.expenseAccountCode,
                  gainLoss: row.gainLossAccountCode,
                })}
              </span>
            ),
          },
          {
            id: "status",
            header: t("status"),
            cell: (row) => (
              <Badge tone={row.status === "active" ? "success" : "neutral"} size="sm">
                {t(`statuses.${row.status}`)}
              </Badge>
            ),
          },
          ...(canManage
            ? [
                {
                  id: "edit",
                  header: t("edit"),
                  cell: (row: Category) => (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                      {t("edit")}
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
      {editing ? <CategoryForm category={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Section>
  );
}

function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const t = useTranslations("finance.assets.categories");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    code: category?.code ?? "",
    nameTh: category?.nameTh ?? "",
    nameEn: category?.nameEn ?? "",
    usefulLifeMonths: String(category?.usefulLifeMonths ?? 60),
    assetAccountCode: category?.assetAccountCode ?? "1510",
    accumulatedAccountCode: category?.accumulatedAccountCode ?? "1519",
    expenseAccountCode: category?.expenseAccountCode ?? "6150",
    gainLossAccountCode: category?.gainLossAccountCode ?? "6900",
    active: (category?.status ?? "active") === "active",
  });
  const accountField = (
    field: "assetAccountCode" | "accumulatedAccountCode" | "expenseAccountCode" | "gainLossAccountCode",
  ) => (
    <Field label={t(`fields.${field}`)} error={errors[field]}>
      <AccountPicker
        label={t(`fields.${field}`)}
        value={form[field]}
        onChange={(code) => setForm({ ...form, [field]: code })}
        accounts={accounts.data ?? []}
      />
    </Field>
  );
  return (
    <FormDialog
      title={category ? t("editTitle", { name: category.nameTh }) : t("new")}
      description={category ? t("editNote") : t("newNote")}
      submitLabel={category ? t("save") : t("create")}
      onClose={onClose}
      onSubmit={async () => {
        setErrors({});
        try {
          if (category)
            await adminBrowserApis().contract.PATCH("/v1/admin/asset-categories/{categoryId}", {
              params: { path: { categoryId: category.id }, header: { "If-Match": `W/"${category.rowVersion}"` } },
              body: {
                nameTh: form.nameTh.trim(),
                nameEn: form.nameEn.trim(),
                usefulLifeMonths: Number(form.usefulLifeMonths),
                status: form.active ? "active" : "inactive",
              },
            });
          else
            await adminBrowserApis().contract.POST("/v1/admin/asset-categories", {
              params: { header: { "Idempotency-Key": idempotencyKey } },
              body: {
                code: form.code.trim(),
                nameTh: form.nameTh.trim(),
                nameEn: form.nameEn.trim() || form.nameTh.trim(),
                usefulLifeMonths: Number(form.usefulLifeMonths),
                assetAccountCode: form.assetAccountCode,
                accumulatedAccountCode: form.accumulatedAccountCode,
                expenseAccountCode: form.expenseAccountCode,
                gainLossAccountCode: form.gainLossAccountCode,
              },
            });
        } catch (error) {
          setErrors(fieldErrorsOf(error));
          throw error;
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "asset-category") });
        toast.success(t("saved"));
      }}
    >
      {!category ? (
        <Field
          label={t("fields.code")}
          hint={t("codeHint")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.code}
        >
          <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        </Field>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("fields.nameTh")} required requiredLabel={tCommon("state.required")} error={errors.nameTh}>
          <Input value={form.nameTh} onChange={(event) => setForm({ ...form, nameTh: event.target.value })} />
        </Field>
        <Field label={t("fields.nameEn")}>
          <Input value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} />
        </Field>
      </div>
      <Field
        label={t("fields.usefulLifeMonths")}
        hint={category ? t("lifeHintEdit") : t("lifeHint")}
        error={errors.usefulLifeMonths}
      >
        <Input
          type="number"
          min={1}
          value={form.usefulLifeMonths}
          onChange={(event) => setForm({ ...form, usefulLifeMonths: event.target.value })}
        />
      </Field>
      {!category ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {accountField("assetAccountCode")}
          {accountField("accumulatedAccountCode")}
          {accountField("expenseAccountCode")}
          {accountField("gainLossAccountCode")}
        </div>
      ) : (
        <SegmentedControl<"active" | "inactive">
          label={t("status")}
          value={form.active ? "active" : "inactive"}
          onValueChange={(value) => setForm({ ...form, active: value === "active" })}
          options={[
            { value: "active", label: t("statuses.active") },
            { value: "inactive", label: t("statuses.inactive") },
          ]}
        />
      )}
    </FormDialog>
  );
}

/* ------------------------------------------------------------------------------ roll-forward */

/**
 * The roll-forward by category (opening, additions, depreciation, disposals, closing, net book
 * value) and the register reconciled to the GL — the difference must be 0 (§7 step 8).
 */
export function AssetRollForward() {
  const t = useTranslations("finance.assets.rollForward");
  const format = useFormat();
  const [from, setFrom] = useState(() => `${thisMonth().slice(0, 4)}-01`);
  const [to, setTo] = useState(thisMonth);
  const report = useQuery({
    queryKey: queryKeys.detail("admin", "asset-roll-forward", `${from}:${to}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/fixed-assets-reports/roll-forward", {
          params: { query: { from, to } },
        })
      ).data!,
  });
  const data = report.data;
  const money = (key: keyof Schemas["RollForwardCategoryDto"]) => ({
    id: key,
    header: t(`columns.${key}`),
    numeric: true,
    cell: (row: Schemas["RollForwardCategoryDto"]) => format.thb(row[key]),
  });
  return (
    <div className="flex flex-col gap-5">
      <Section
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("from")} className="w-40">
              <Input type="month" value={from} onChange={(event) => setFrom(event.target.value || from)} />
            </Field>
            <Field label={t("to")} className="w-40">
              <Input type="month" value={to} onChange={(event) => setTo(event.target.value || to)} />
            </Field>
          </div>
        }
      >
        {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
        <DataTable
          caption={t("title")}
          rows={data?.categories ?? []}
          loading={report.isPending}
          getRowId={(row) => row.category}
          density="compact"
          empty={<EmptyState icon="archive" title={t("empty")} />}
          columns={[
            { id: "category", header: t("columns.category"), cell: (row) => row.name },
            money("openingCost"),
            money("additions"),
            money("disposalsCost"),
            money("closingCost"),
            money("openingAccumulated"),
            money("depreciation"),
            money("disposalsAccumulated"),
            money("closingAccumulated"),
            {
              ...money("netBookValue"),
              cell: (row) => <span className="font-semibold">{format.thb(row.netBookValue)}</span>,
            },
          ]}
        />
      </Section>
      <Section title={t("reconciliation")} description={t("reconciliationNote")}>
        <DataTable
          caption={t("reconciliation")}
          rows={data?.reconciliation ?? []}
          loading={report.isPending}
          getRowId={(row) => row.accountCode}
          density="compact"
          rowTone={(row) => (isZeroMoney(row.difference) ? undefined : "danger")}
          columns={[
            {
              id: "account",
              header: t("account"),
              cell: (row) => (
                <Link
                  href={`/finance/ledger/journals?accountCode=${row.accountCode}`}
                  className="text-primary font-mono hover:underline"
                >
                  {row.accountCode}
                </Link>
              ),
            },
            { id: "register", header: t("register"), numeric: true, cell: (row) => format.thb(row.register) },
            { id: "gl", header: t("gl"), numeric: true, cell: (row) => format.thb(row.gl) },
            {
              id: "difference",
              header: t("difference"),
              cell: (row) =>
                isZeroMoney(row.difference) ? (
                  <Badge tone="success" size="sm" icon="check">
                    {t("reconciled")}
                  </Badge>
                ) : (
                  <Badge tone="danger" size="sm" icon="warning">
                    {format.thb(row.difference)}
                  </Badge>
                ),
            },
          ]}
        />
      </Section>
    </div>
  );
}
