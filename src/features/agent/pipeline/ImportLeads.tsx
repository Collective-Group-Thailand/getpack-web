"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { FilePickButton } from "@/ui/components/FilePickButton";
import { Textarea } from "@/ui/components/Input";
import { PortalTable } from "@/ui/components/PortalTable";
import { ProgressTracker } from "@/ui/components/ProgressTracker";
import { Switch } from "@/ui/components/Switch";
import { Icon } from "@/ui/icons";

import { displayPhone } from "./phone";
import { newIdempotencyKey, useProblemText } from "./problem";

type Import = Schemas["AgentLeadImportDto"];

/** The template's columns — the API's import header (`store.agentLeads.importPreview`), Thai aliases accepted too. */
export const TEMPLATE_HEADERS = [
  "contact_name",
  "organisation_name",
  "phone",
  "email",
  "tax_id",
  "line_id",
  "industry",
  "tags",
  "expected_value",
  "next_follow_up_at",
  "note",
] as const;

/** The template file: the header and one obviously fake example row, UTF-8 with a BOM so Excel reads Thai. */
export function templateCsv(example: readonly string[]): string {
  const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return `﻿${TEMPLATE_HEADERS.join(",")}\n${example.map(quote).join(",")}\n`;
}

/**
 * CSV import (D-468 §1, PROMPT P3 Web 8): the template, then a dry run — every row through the same checks as a new
 * lead, the duplicate check included — shown as a table with each row's problems in words; then the commit
 * (`Idempotency-Key`: a double tap imports once). Nothing is saved before the commit.
 */
export function ImportLeads({ maxRows }: { maxRows: number }) {
  const t = useTranslations("agentSales.import");
  const problemText = useProblemText();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [preview, setPreview] = useState<Import | null>(null);
  const [result, setResult] = useState<Import | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef("");

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv(t.raw("templateExample") as string[])], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "getpack-leads-template.csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const check = async () => {
    setError(null);
    if (!csv.trim()) return setError(t("errors.empty"));
    if (!consent) return setError(t("errors.consent"));
    setBusy(true);
    try {
      const { data } = await browserApi().POST("/v1/store/agent/leads/imports", { body: { csv, consentConfirmed: true } });
      setPreview(data ?? null);
      key.current = newIdempotencyKey();
    } catch (failure) {
      setError(problemText(failure));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await browserApi().POST("/v1/store/agent/leads/imports/{importId}/actions/commit", {
        params: { path: { importId: preview.id }, header: { "Idempotency-Key": key.current } },
      });
      setResult(data ?? null);
    } catch (failure) {
      setError(problemText(failure));
    } finally {
      setBusy(false);
    }
  };

  const step = result ? 2 : preview ? 1 : 0;
  const stages = ["file", "check", "done"].map((name, index) => ({
    key: name,
    title: t(`steps.${name}`),
    state: (index < step ? "done" : index === step ? "current" : "upcoming") as "done" | "current" | "upcoming",
  }));

  if (result) {
    return (
      <div className="flex flex-col gap-5">
        <ProgressTracker label={t("progress")} stateLabels={{ done: t("stateDone"), current: t("stateCurrent"), upcoming: "", skipped: "" }} stages={stages} className="md:max-w-xl" />
        <section className="border-border bg-surface rounded-card flex flex-col items-start gap-3 border p-5" aria-labelledby="import-done">
          <span className="bg-success-subtle text-success-subtle-fg grid size-10 place-items-center rounded-full">
            <Icon name="check" size={20} aria-hidden="true" />
          </span>
          <h2 id="import-done" className="text-lg font-semibold">
            {t("doneTitle", { count: result.createdCount ?? 0 })}
          </h2>
          <p className="text-muted text-sm">{t("doneBody", { skipped: result.rowCount - (result.createdCount ?? 0) })}</p>
          <Button asChild>
            <Link href="/leads">{t("toLeads")}</Link>
          </Button>
        </section>
      </div>
    );
  }

  const rows = preview ? preview.rows.filter((row) => !onlyProblems || row.errors.length > 0) : [];
  return (
    <div className="flex flex-col gap-5">
      <ProgressTracker label={t("progress")} stateLabels={{ done: t("stateDone"), current: t("stateCurrent"), upcoming: "", skipped: "" }} stages={stages} className="md:max-w-xl" />

      {!preview ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4 sm:p-5" aria-labelledby="import-file">
            <h2 id="import-file" className="font-semibold">
              {t("fileTitle")}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <FilePickButton
                label={fileName ? t("replaceFile") : t("pickFile")}
                accept=".csv,text/csv"
                icon="spreadsheet"
                onFiles={(files) => {
                  const file = files[0];
                  if (!file) return;
                  setFileName(file.name);
                  void file.text().then(setCsv);
                }}
              />
              {fileName ? (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <Icon name="file-check" size={16} aria-hidden="true" className="text-success" />
                  {fileName}
                </span>
              ) : null}
            </div>
            <Field label={t("paste")} hint={t("pasteHint", { max: maxRows })}>
              <Textarea
                rows={6}
                value={csv}
                spellCheck={false}
                className="font-mono text-sm"
                onChange={(event) => {
                  setCsv(event.target.value);
                  setFileName(null);
                }}
              />
            </Field>
            <Checkbox label={t("consent")} checked={consent} onCheckedChange={(on) => setConsent(on === true)} />
            {error ? <Callout tone="danger" title={error} live /> : null}
            <Button className="self-start" iconStart="checklist" loading={busy} onClick={() => void check()}>
              {t("check")}
            </Button>
          </section>
          <aside className="border-border bg-surface-subtle rounded-card flex flex-col gap-3 border p-4 sm:p-5" aria-labelledby="template">
            <h2 id="template" className="font-semibold">
              {t("templateTitle")}
            </h2>
            <p className="text-muted text-sm">{t("templateBody")}</p>
            <ul className="text-sm">
              {TEMPLATE_HEADERS.map((header) => (
                <li key={header} className="flex justify-between gap-3 py-0.5">
                  <code className="text-xs">{header}</code>
                  <span className="text-muted text-xs">{t(`columns.${header}`)}</span>
                </li>
              ))}
            </ul>
            <Button variant="secondary" iconStart="download" onClick={downloadTemplate} className="self-start">
              {t("template")}
            </Button>
          </aside>
        </div>
      ) : (
        <section className="flex flex-col gap-4" aria-labelledby="import-check">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="import-check" className="text-lg font-semibold">
                {t("checkTitle", { valid: preview.validCount, total: preview.rowCount })}
              </h2>
              <p className="text-muted text-sm">{t("checkBody")}</p>
            </div>
            <Switch label={t("onlyProblems")} checked={onlyProblems} onCheckedChange={setOnlyProblems} />
          </div>
          <PortalTable
            caption={t("checkCaption")}
            columns={[
              { key: "row", label: t("table.row"), className: "md:w-16" },
              { key: "name", label: t("table.name") },
              { key: "contact", label: t("table.contact") },
              { key: "result", label: t("table.result") },
            ]}
            rows={rows.map((row) => ({
              id: String(row.rowNo),
              phoneSubtitle: row.organisationName,
              cells: {
                row: <span className="tabular-nums">{t("rowNo", { n: row.rowNo })}</span>,
                name: (
                  <span className="block min-w-0">
                    <span className="block font-medium">{row.contactName ?? "—"}</span>
                    {row.organisationName ? <span className="text-muted hidden text-xs md:block">{row.organisationName}</span> : null}
                  </span>
                ),
                contact: (
                  <span className="text-sm break-all tabular-nums">
                    {[row.phone ? displayPhone(row.phone) : null, row.email, row.taxId].filter(Boolean).join(" · ") || "—"}
                  </span>
                ),
                result:
                  row.errors.length === 0 ? (
                    <Badge tone="success" icon="check">
                      {t("ok")}
                    </Badge>
                  ) : (
                    <ul className="text-danger-subtle-fg flex flex-col gap-0.5 text-sm">
                      {row.errors.map((problem, index) => (
                        <li key={index} className="flex items-start gap-1.5">
                          <Icon name="warning" size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                          {t(`errorCodes.${problem.code}`, { field: t.has(`fields.${problem.field}`) ? t(`fields.${problem.field}`) : problem.field })}
                        </li>
                      ))}
                    </ul>
                  ),
              },
            }))}
          />
          {error ? <Callout tone="danger" title={error} live /> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy}>
              {t("backToFile")}
            </Button>
            <Button iconStart="upload" loading={busy} disabled={preview.validCount === 0} onClick={() => void commit()}>
              {t("commit", { count: preview.validCount })}
            </Button>
          </div>
          <p className="text-muted text-xs">{t("expires")}</p>
        </section>
      )}
    </div>
  );
}
