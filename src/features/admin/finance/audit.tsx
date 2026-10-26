"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DataTable } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Icon, type IconName } from "@/ui/icons";
import { Input } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { useActor, useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { SectionNav } from "../console/SectionNav";

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const thisMonth = () => bangkokToday().slice(0, 7);

export function AuditNav() {
  const t = useTranslations("finance.audit.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/finance/audit", label: t("home"), exact: true },
        { href: "/finance/audit/exceptions", label: t("exceptions") },
        { href: "/finance/audit/samples", label: t("samples") },
        { href: "/finance/audit/pbc", label: t("pbc"), permission: "audit_support.export" },
      ]}
    />
  );
}

const REGISTERS: { key: string; href: string; icon: IconName; permission: string }[] = [
  { key: "documents", href: "/finance/documents", icon: "document", permission: "receivables.read" },
  { key: "vendorBills", href: "/finance/payables/invoices", icon: "receipt", permission: "payables.read" },
  { key: "journals", href: "/finance/ledger/journals", icon: "layers", permission: "ledger.read" },
  { key: "whtIssued", href: "/finance/tax", icon: "percent", permission: "tax.read" },
  { key: "whtReceived", href: "/finance/receivables/wht", icon: "file-check", permission: "receivables.read" },
  { key: "assets", href: "/finance/assets", icon: "archive", permission: "fixed_assets.read" },
  { key: "trialBalance", href: "/finance/reports", icon: "spreadsheet", permission: "ledger.read" },
  { key: "close", href: "/finance/close", icon: "checklist", permission: "close.read" },
  { key: "auditTrail", href: "/audit-logs", icon: "history", permission: "audit_logs.read" },
];

/**
 * The auditor's desk (§8, D-168): read-only, for the period the access was granted. Registers,
 * the audit trail and its export, samples, exception reports and the PBC pack — nothing here
 * changes the books.
 */
export function AuditorHome() {
  const t = useTranslations("finance.audit.home");
  const format = useFormat();
  const actor = useActor();
  const me = useQuery({
    queryKey: queryKeys.detail("admin", "user", actor.id),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/users/{userId}", { params: { path: { userId: actor.id } } }))
        .data!,
    enabled: actor.permissions.includes("users.read"),
    retry: false,
  });
  const grant = me.data?.roles.find((role) => role.role === "auditor");
  const registers = REGISTERS.filter((item) => actor.permissions.includes(item.permission));
  return (
    <div className="flex flex-col gap-5">
      {grant ? (
        <Callout tone={grant.validTo ? "info" : "warning"} title={t("accessTitle")}>
          {grant.validTo
            ? t("accessUntil", { from: format.date(grant.validFrom), to: format.date(grant.validTo) })
            : t("accessOpen")}
        </Callout>
      ) : null}
      <Callout tone="neutral" title={t("readOnlyTitle")}>
        {t("readOnlyBody")}
      </Callout>
      <Section title={t("registers")} description={t("registersNote")}>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {registers.map((item) => (
            <li key={item.key}>
              <Card padding="md" className="h-full">
                <Link href={item.href} className="group flex items-start gap-3">
                  <Icon name={item.icon} size={20} aria-hidden className="text-primary mt-0.5" />
                  <span>
                    <span className="text-primary font-medium group-hover:underline">
                      {t(`items.${item.key}.title`)}
                    </span>
                    <span className="text-muted block text-sm">{t(`items.${item.key}.body`)}</span>
                  </span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* -------------------------------------------------------------------------------- exceptions */

/** The §8 exception reports of a month, each with its items. */
export function ExceptionsView() {
  const t = useTranslations("finance.audit.exceptions");
  const format = useFormat();
  const [month, setMonth] = useState(thisMonth);
  const reports = useQuery({
    queryKey: queryKeys.detail("admin", "audit-exceptions", month),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/audit/exceptions", { params: { query: { period: month } } }))
        .data!,
  });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Field label={t("month")} className="w-44">
          <Input type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
        </Field>
      </div>
      {reports.isError ? <QueryError error={reports.error} onRetry={() => void reports.refetch()} /> : null}
      {(reports.data ?? []).map((report) => (
        <Section
          key={report.key}
          title={
            <>
              {t(`keys.${report.key}`)}
              <Badge tone={report.count ? "warning" : "success"} size="sm">
                {t("count", { count: report.count })}
              </Badge>
            </>
          }
          description={t(`notes.${report.key}`)}
        >
          {report.count ? (
            <DataTable
              caption={t(`keys.${report.key}`)}
              rows={report.items}
              getRowId={(row) => `${row.reference}-${row.id ?? ""}-${row.date ?? ""}`}
              density="compact"
              columns={[
                {
                  id: "reference",
                  header: t("reference"),
                  cell: (row) => <span className="text-sm tabular-nums">{row.reference}</span>,
                },
                { id: "date", header: t("date"), cell: (row) => (row.date ? format.date(row.date) : "") },
                {
                  id: "amount",
                  header: t("amount"),
                  numeric: true,
                  cell: (row) => (row.amount ? format.thb(row.amount) : ""),
                },
                { id: "detail", header: t("detail"), cell: (row) => row.detail },
              ]}
            />
          ) : (
            <p className="text-muted text-sm">{t("none")}</p>
          )}
        </Section>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------------- samples */

const POPULATIONS = [
  "customer_documents",
  "vendor_invoices",
  "journal_entries",
  "payout_items",
  "wht_certificates",
] as const satisfies readonly Schemas["AuditPopulation"][];

/** Reproducible samples (§8): random or stratified by value; the seed draws the same sample again. */
export function SamplesView() {
  const t = useTranslations("finance.audit.samples");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canDraw = useCan("audit_support.sample");
  const [form, setForm] = useState({
    period: thisMonth(),
    population: "customer_documents" as Schemas["AuditPopulation"],
    method: "random" as Schemas["SampleMethod"],
    size: "10",
    seed: "",
  });
  const [busy, setBusy] = useState(false);
  const samples = useQuery({
    queryKey: queryKeys.list("admin", "audit-sample"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/audit/samples")).data!,
  });
  async function draw() {
    setBusy(true);
    try {
      await adminBrowserApis().contract.POST("/v1/admin/audit/samples", {
        params: { header: { "Idempotency-Key": crypto.randomUUID() } },
        body: {
          period: form.period,
          population: form.population,
          method: form.method,
          size: Number(form.size),
          ...(form.seed.trim() ? { seed: form.seed.trim() } : {}),
        },
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "audit-sample") });
      toast.success(t("drawn"));
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-5">
      {canDraw ? (
        <Section title={t("draw")} description={t("drawNote")}>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6 xl:items-end">
            <Field label={t("month")}>
              <Input
                type="month"
                value={form.period}
                onChange={(event) => event.target.value && setForm({ ...form, period: event.target.value })}
              />
            </Field>
            <Field label={t("population")} className="xl:col-span-2">
              <SearchableSelect<Schemas["AuditPopulation"]>
                value={form.population}
                onValueChange={(population) => setForm({ ...form, population })}
                options={POPULATIONS.map((value) => ({ value, label: t(`populations.${value}`) }))}
              />
            </Field>
            <Field label={t("method")}>
              <SearchableSelect<Schemas["SampleMethod"]>
                value={form.method}
                onValueChange={(method) => setForm({ ...form, method })}
                options={[
                  { value: "random", label: t("methods.random") },
                  { value: "stratified", label: t("methods.stratified") },
                ]}
              />
            </Field>
            <Field label={t("size")}>
              <Input
                type="number"
                min={1}
                max={500}
                value={form.size}
                onChange={(event) => setForm({ ...form, size: event.target.value })}
              />
            </Field>
            <Field label={t("seed")} hint={t("seedHint")}>
              <Input
                inputMode="numeric"
                value={form.seed}
                onChange={(event) => setForm({ ...form, seed: event.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Button loading={busy} onClick={() => void draw()}>
              {t("drawButton")}
            </Button>
          </div>
        </Section>
      ) : null}
      {samples.isError ? <QueryError error={samples.error} onRetry={() => void samples.refetch()} /> : null}
      {(samples.data ?? []).length === 0 && !samples.isPending ? (
        <EmptyState icon="checklist" title={t("empty")} />
      ) : null}
      {(samples.data ?? []).map((sample) => (
        <Section
          key={sample.id}
          title={t("sampleTitle", {
            population: t(`populations.${sample.population}`),
            month: format.date(`${sample.period}-01`, { style: "month" }),
          })}
          description={t("sampleNote", {
            method: t(`methods.${sample.method}`),
            selected: sample.selected.length,
            size: sample.populationSize,
            seed: sample.seed,
          })}
          actions={<When at={sample.createdAt} />}
        >
          <DataTable
            caption={t("selected")}
            rows={sample.selected}
            getRowId={(row) => row.id}
            density="compact"
            columns={[
              {
                id: "number",
                header: t("number"),
                cell: (row) => <span className="text-sm tabular-nums">{row.number}</span>,
              },
              { id: "date", header: t("date"), cell: (row) => (row.date ? format.date(row.date) : "") },
              { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.amount) },
            ]}
          />
        </Section>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- PBC */

/** The prepared-by-client pack of a month: one workbook, its SHA-256 kept for the auditor. */
export function PbcView() {
  const t = useTranslations("finance.audit.pbc");
  const format = useFormat();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(thisMonth);
  const [busy, setBusy] = useState(false);
  const packs = useQuery({
    queryKey: queryKeys.list("admin", "pbc-export"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/audit/pbc-exports")).data!,
  });
  async function generate() {
    setBusy(true);
    try {
      await adminBrowserApis().contract.POST("/v1/admin/audit/pbc-exports", {
        params: { header: { "Idempotency-Key": crypto.randomUUID() } },
        body: { period: month },
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "pbc-export") });
      toast.success(t("generated"));
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }
  async function download(pack: Schemas["PbcExportDto"]) {
    try {
      const { data } = await adminBrowserApis().contract.GET("/v1/admin/audit/pbc-exports/{exportId}/file", {
        params: { path: { exportId: pack.id } },
      });
      const link = document.createElement("a");
      link.href = data!.url;
      link.download = `pbc-${pack.period}.csv`;
      link.click();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    }
  }
  return (
    <Section
      title={t("title")}
      description={t("description")}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("month")} className="w-44">
            <Input
              type="month"
              value={month}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
            />
          </Field>
          <Button loading={busy} onClick={() => void generate()}>
            {t("generate")}
          </Button>
        </div>
      }
    >
      {packs.isError ? <QueryError error={packs.error} onRetry={() => void packs.refetch()} /> : null}
      <DataTable
        caption={t("title")}
        rows={packs.data ?? []}
        loading={packs.isPending}
        getRowId={(row) => row.id}
        density="compact"
        empty={<EmptyState icon="archive" title={t("empty")} />}
        columns={[
          { id: "period", header: t("month"), cell: (row) => format.date(`${row.period}-01`, { style: "month" }) },
          { id: "generated", header: t("generatedAt"), cell: (row) => <When at={row.generatedAt} absoluteOnly /> },
          { id: "sha", header: t("sha256"), cell: (row) => <code className="text-xs break-all">{row.sha256}</code> },
          {
            id: "download",
            header: t("file"),
            cell: (row) => (
              <Button size="sm" variant="ghost" iconStart="download" onClick={() => void download(row)}>
                {t("download")}
              </Button>
            ),
          },
        ]}
      />
    </Section>
  );
}
