"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Pagination } from "@/ui/components/Pagination";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Tabs } from "@/ui/components/Tabs";
import { toast } from "@/ui/components/Toast";

import { FileField } from "../catalogue/FileField";
import {
  adminBrowserApis,
  download,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  useCan,
} from "../console";

type Request = Schemas["AdminPrivacyRequestDto"];
type RequestStatus = Schemas["PrivacyRequestStatus"];
type Purpose = Schemas["ConsentPurposeDto"];
type Agreement = Schemas["AgreementTemplateDto"];

/** Today in Bangkok, `YYYY-MM-DD`. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

/**
 * Privacy and agreements (PDPA, D-086, D-089): customers' export and deletion requests with their
 * due dates (answered by completing — an export becomes a download — or rejecting with a reason);
 * the consent purposes and each new wording as a version from a date; and the agreement templates
 * partners and customers accept, each new text a version with its reason.
 */
export function PrivacyDesk() {
  const t = useTranslations("content.privacy");
  const canRequests = useCan("privacy_requests.manage");
  const canConsents = useCan("consent_purposes.manage");
  const canAgreements = useCan("agreements.manage", "partners.read");
  const items = [
    ...(canRequests ? [{ value: "requests", label: t("tabs.requests"), content: <Requests /> }] : []),
    ...(canConsents ? [{ value: "consents", label: t("tabs.consents"), content: <Consents /> }] : []),
    ...(canAgreements ? [{ value: "agreements", label: t("tabs.agreements"), content: <Agreements /> }] : []),
  ];
  return <Tabs label={t("tabsLabel")} items={items} />;
}

function Requests() {
  const t = useTranslations("content.privacy.requests");
  const tList = useTranslations("console.list");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RequestStatus | "all">("submitted");
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState<{
    request: Request;
    action: "complete" | "reject";
    answer: string;
    key: string;
  } | null>(null);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "privacy_request", { status, page }),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/privacy-requests", {
          params: { query: { page, perPage: 25, ...(status === "all" ? {} : { status }) } },
        })
      ).data!,
  });
  const exportFile = useMutation({
    mutationFn: async (fileId: string) =>
      (await adminBrowserApis().contract.GET("/v1/admin/files/{fileId}/download", { params: { path: { fileId } } }))
        .data!,
    onSuccess: (file) => download(file.url),
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  const columns: DataTableColumn<Request>[] = [
    { id: "customer", header: t("customer"), cell: (row) => row.customer.displayName },
    { id: "kind", header: t("kind"), cell: (row) => t(`kinds.${row.kind}`) },
    { id: "requested", header: t("requestedAt"), cell: (row) => <When at={row.requestedAt} /> },
    {
      id: "due",
      header: t("dueAt"),
      cell: (row) => (
        <span className={row.overdue ? "text-danger font-medium" : undefined}>
          <When at={row.dueAt} absoluteOnly />
          {row.overdue ? ` · ${t("overdue")}` : ""}
        </span>
      ),
    },
    { id: "note", header: t("note"), cell: (row) => <span className="text-sm">{row.note ?? "—"}</span> },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <div>
          <Badge
            tone={row.status === "submitted" ? "warning" : row.status === "completed" ? "success" : "neutral"}
            size="sm"
          >
            {t(`statuses.${row.status}`)}
          </Badge>
          {row.answer ? <p className="text-muted mt-1 text-xs">{row.answer}</p> : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: (row) =>
        row.status === "submitted" ? (
          <span className="flex flex-wrap gap-1">
            <Button
              size="sm"
              onClick={() => setDeciding({ request: row, action: "complete", answer: "", key: newIdempotencyKey() })}
            >
              {t(row.kind === "export" ? "completeExport" : "completeDeletion")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeciding({ request: row, action: "reject", answer: "", key: newIdempotencyKey() })}
            >
              {t("reject")}
            </Button>
          </span>
        ) : row.export ? (
          <Button
            size="sm"
            variant="secondary"
            iconStart="download"
            onClick={() => exportFile.mutate(row.export!.fileId)}
          >
            {t("download")}
          </Button>
        ) : null,
    },
  ];
  const data = query.data;
  return (
    <div className="flex flex-col gap-4 pt-4">
      <SegmentedControl
        label={t("status")}
        value={status}
        onValueChange={(value) => {
          setStatus(value as RequestStatus | "all");
          setPage(1);
        }}
        options={[
          ...(["submitted", "completed", "rejected"] as const).map((s) => ({ value: s, label: t(`statuses.${s}`) })),
          { value: "all", label: t("all") },
        ]}
      />
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          rowTone={(row) => (row.overdue && row.status === "submitted" ? "danger" : undefined)}
          empty={<EmptyState icon="shield" title={t("empty")} />}
        />
      )}
      {data && data.meta.total > data.meta.perPage ? (
        <Pagination
          page={data.meta.page}
          perPage={data.meta.perPage}
          total={data.meta.total}
          onPageChange={setPage}
          labels={{
            nav: tList("pagination"),
            previous: tList("previous"),
            next: tList("next"),
            range: (from, to, total) => tList("range", { from, to, total }),
            pageOf: (current, pages) => tList("pageOf", { page: current, pages }),
            perPage: tList("perPage"),
          }}
        />
      ) : null}
      {deciding ? (
        <FormDialog
          title={t(deciding.action === "reject" ? "rejectTitle" : "completeTitle", {
            name: deciding.request.customer.displayName,
          })}
          description={t(
            deciding.action === "reject"
              ? "rejectBody"
              : deciding.request.kind === "export"
                ? "completeExportBody"
                : "completeDeletionBody",
          )}
          submitLabel={t(deciding.action === "reject" ? "reject" : "complete")}
          destructive={deciding.action === "complete" && deciding.request.kind === "deletion"}
          onClose={() => setDeciding(null)}
          onSubmit={async () => {
            const answer = deciding.answer.trim();
            if (deciding.action === "reject") {
              if (answer.length < 3) throw new FormError(t("answerRequired"));
              await adminBrowserApis().contract.POST("/v1/admin/privacy-requests/{requestId}/actions/reject", {
                params: { path: { requestId: deciding.request.id } },
                body: { answer },
              });
            } else {
              await adminBrowserApis().contract.POST("/v1/admin/privacy-requests/{requestId}/actions/complete", {
                params: { path: { requestId: deciding.request.id }, header: { "Idempotency-Key": deciding.key } },
                body: { answer: answer || null },
              });
            }
            toast.success(t("decided"));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "privacy_request") });
          }}
        >
          <Field label={t("answer")} hint={t("answerHint")} required={deciding.action === "reject"}>
            <Textarea
              rows={4}
              value={deciding.answer}
              onChange={(e) => setDeciding({ ...deciding, answer: e.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}

function Consents() {
  const t = useTranslations("content.privacy.consents");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<(Schemas["PublishConsentTextDto"] & { purpose: Purpose }) | null>(null);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "consent_purpose", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/consent-purposes")).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <div className="flex flex-col gap-4 pt-4">
      {(query.data ?? []).map((purpose) => {
        const current = [...purpose.versions].sort((a, b) => b.versionNo - a.versionNo)[0];
        return (
          <Section
            key={purpose.key}
            title={locale === "en" ? purpose.labelEn : purpose.labelTh}
            description={`${purpose.key}${purpose.required ? ` · ${t("required")}` : ""}`}
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setDraft({
                    purpose,
                    effectiveFrom: today(),
                    reason: "",
                    textTh: current?.textTh ?? "",
                    textEn: current?.textEn ?? "",
                  })
                }
              >
                {t("newVersion")}
              </Button>
            }
          >
            <ul className="flex flex-col gap-3">
              {[...purpose.versions]
                .sort((a, b) => b.versionNo - a.versionNo)
                .map((v) => (
                  <li key={v.versionNo} className="text-sm">
                    <p className="font-medium">
                      {t("version", { no: v.versionNo })} · {t("effective")} <When at={v.effectiveFrom} absoluteOnly />
                    </p>
                    <p className="text-muted whitespace-pre-line">{locale === "en" ? v.textEn : v.textTh}</p>
                  </li>
                ))}
            </ul>
          </Section>
        );
      })}
      {query.data && query.data.length === 0 ? <EmptyState icon="shield" title={t("empty")} /> : null}
      {draft ? (
        <FormDialog
          title={t("newVersionTitle", { purpose: locale === "en" ? draft.purpose.labelEn : draft.purpose.labelTh })}
          description={t("newVersionIntro")}
          submitLabel={t("publish")}
          onClose={() => setDraft(null)}
          onSubmit={async () => {
            if (!draft.textTh.trim() || !draft.textEn.trim() || draft.reason.trim().length < 3)
              throw new FormError(t("incomplete"));
            const { purpose, ...body } = draft;
            await adminBrowserApis().contract.POST("/v1/admin/consent-purposes/{key}/versions", {
              params: { path: { key: purpose.key } },
              body: { ...body, effectiveFrom: `${body.effectiveFrom}T00:00:00+07:00` },
            });
            toast.success(t("published"));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "consent_purpose") });
          }}
        >
          <Field label={t("effectiveFrom")} required>
            <Input
              type="date"
              value={draft.effectiveFrom}
              min={today()}
              onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })}
            />
          </Field>
          <Field label={t("textTh")} required>
            <Textarea rows={5} value={draft.textTh} onChange={(e) => setDraft({ ...draft, textTh: e.target.value })} />
          </Field>
          <Field label={t("textEn")} required>
            <Textarea rows={5} value={draft.textEn} onChange={(e) => setDraft({ ...draft, textEn: e.target.value })} />
          </Field>
          <Field label={t("reason")} hint={t("reasonHint")} required>
            <Input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}

function Agreements() {
  const t = useTranslations("content.privacy.agreements");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const canPublish = useCan("agreements.manage");
  const [draft, setDraft] = useState<{
    template: Agreement;
    textTh: string;
    textEn: string;
    reason: string;
    effectiveFrom: string;
    pdfFileId: string;
  } | null>(null);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "agreement_template", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/agreement-templates")).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <div className="flex flex-col gap-4 pt-4">
      {(query.data ?? []).map((template) => {
        const versions = [...template.versions].sort((a, b) => b.versionNo - a.versionNo);
        return (
          <Section
            key={template.key}
            title={template.name}
            description={template.description ?? template.key}
            actions={
              canPublish ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setDraft({
                      template,
                      textTh: versions[0]?.textTh ?? "",
                      textEn: versions[0]?.textEn ?? "",
                      reason: "",
                      effectiveFrom: today(),
                      pdfFileId: "",
                    })
                  }
                >
                  {t("newVersion")}
                </Button>
              ) : null
            }
          >
            <ul className="flex flex-col gap-2 text-sm">
              {versions.map((v) => (
                <li key={v.versionNo}>
                  <span className="font-medium">{t("version", { no: v.versionNo })}</span> · {t("effective")}{" "}
                  <When at={v.effectiveFrom} absoluteOnly /> · <span className="text-muted">{v.reason}</span>
                  <span className="text-muted ms-2 text-xs tabular-nums">{v.textSha256.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
            {versions[0] ? (
              <details className="mt-3 text-sm">
                <summary className="text-primary cursor-pointer">{t("readCurrent")}</summary>
                <p className="text-muted mt-2 whitespace-pre-line">
                  {locale === "en" ? (versions[0].textEn ?? versions[0].textTh) : versions[0].textTh}
                </p>
              </details>
            ) : null}
          </Section>
        );
      })}
      {query.data && query.data.length === 0 ? <EmptyState icon="document" title={t("empty")} /> : null}
      {draft ? (
        <FormDialog
          title={t("newVersionTitle", { name: draft.template.name })}
          description={t("newVersionIntro")}
          submitLabel={t("publish")}
          onClose={() => setDraft(null)}
          onSubmit={async () => {
            if (!draft.textTh.trim() || draft.reason.trim().length < 3) throw new FormError(t("incomplete"));
            await adminBrowserApis().contract.POST("/v1/admin/agreement-templates/{key}/versions", {
              params: { path: { key: draft.template.key } },
              body: {
                textTh: draft.textTh.trim(),
                textEn: draft.textEn.trim() || null,
                reason: draft.reason.trim(),
                effectiveFrom: `${draft.effectiveFrom}T00:00:00+07:00`,
                pdfFileId: draft.pdfFileId || null,
              },
            });
            toast.success(t("published"));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "agreement_template") });
          }}
        >
          <Field label={t("effectiveFrom")} required>
            <Input
              type="date"
              value={draft.effectiveFrom}
              min={today()}
              onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })}
            />
          </Field>
          <Field label={t("textTh")} required>
            <Textarea rows={8} value={draft.textTh} onChange={(e) => setDraft({ ...draft, textTh: e.target.value })} />
          </Field>
          <Field label={t("textEn")}>
            <Textarea rows={6} value={draft.textEn} onChange={(e) => setDraft({ ...draft, textEn: e.target.value })} />
          </Field>
          <Field label={t("pdf")} hint={t("pdfHint")}>
            <FileField
              purpose="document"
              value={draft.pdfFileId}
              onChange={(value) => setDraft({ ...draft, pdfFileId: String(value ?? "") })}
            />
          </Field>
          <Field label={t("reason")} hint={t("reasonHint")} required>
            <Input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
