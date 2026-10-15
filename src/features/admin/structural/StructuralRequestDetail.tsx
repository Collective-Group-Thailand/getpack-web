"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { STRUCTURAL_REQUEST_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { uploadFile } from "@/features/shared/files/upload";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, QueryError, Section, StatusChip } from "../console";
import { useCan } from "../console/actor";
import { useFileDownload } from "../logistics/files";

type Row = Schemas["AdminStructuralRequestDto"];
type Dialog = "assign" | "decline" | "rfq" | "deliver" | "approve" | "publish" | null;

const OPEN: Row["status"][] = ["submitted", "assigned", "quoted"];
const BASE_CODE = /^PK-[A-Z]{2}-\d{2,3}$/;

/**
 * One structural design request (U3.6, D-273): what the customer described and attached; CS assigns
 * a structural designer (`structural_requests.manage`), links the service RFQ when a fee applies,
 * or declines with a reason; the designer delivers the dieline (`structural_requests.design`);
 * Prepress approves it and publishes it as a library base (`styles.approve_recipe`). The customer
 * is told at every step by packio-api.
 */
export function StructuralRequestDetail({ requestId }: { requestId: string }) {
  const t = useTranslations("catalogue.structural");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("structural_requests.manage");
  const canDesign = useCan("structural_requests.design");
  const canApprove = useCan("styles.approve_recipe");
  const file = useFileDownload();
  const key = queryKeys.detail("admin", "structural-request", requestId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [assignee, setAssignee] = useState("");
  const [reason, setReason] = useState("");
  const [rfqId, setRfqId] = useState("");
  const [baseCode, setBaseCode] = useState("");
  const [dieline, setDieline] = useState<File[]>([]);

  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/structural-requests/{requestId}", {
          params: { path: { requestId } },
        })
      ).data!,
  });
  const designers = useQuery({
    queryKey: queryKeys.list("admin", "structural-designers"),
    // CONTRACT-REQUEST admin.structural-request-designers
    queryFn: async () => (await adminBrowserApis().requests.call("GET /v1/admin/structural-requests/designers")).data,
    enabled: dialog === "assign",
    staleTime: 5 * 60_000,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const r = query.data;
  if (!r) return null;

  const path = { params: { path: { requestId } } };
  const settle = (updated: Row | undefined) => {
    if (updated) queryClient.setQueryData(key, updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "structural-requests") });
    setDialog(null);
  };
  const sizes = r.sizes
    ? [r.sizes.lengthMm, r.sizes.widthMm, r.sizes.heightMm]
        .map((n) => (n === null ? "—" : format.number(n)))
        .join(" × ")
    : "—";

  const actions = (
    <div className="flex flex-wrap gap-2">
      {canManage && OPEN.includes(r.status) ? (
        <Button onClick={() => setDialog("assign")}>{r.assignedTo ? t("reassign") : t("assign")}</Button>
      ) : null}
      {canManage && r.status === "assigned" ? (
        <Button variant="secondary" onClick={() => setDialog("rfq")}>
          {t("linkRfq")}
        </Button>
      ) : null}
      {canDesign && (r.status === "assigned" || r.status === "quoted") ? (
        <Button onClick={() => setDialog("deliver")}>{t("deliver")}</Button>
      ) : null}
      {canApprove && r.status === "delivered" ? (
        <Button onClick={() => setDialog("approve")}>{t("approve")}</Button>
      ) : null}
      {canApprove && r.status === "approved" ? (
        <Button onClick={() => setDialog("publish")}>{t("publish")}</Button>
      ) : null}
      {canManage && OPEN.includes(r.status) ? (
        <Button variant="ghost" className="text-danger" onClick={() => setDialog("decline")}>
          {t("decline")}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/structural-requests" }, { label: t("detailCrumb") }]}
          />
        }
        title={t("detailTitle", { type: r.productTypeCode })}
        meta={<StatusChip map={STRUCTURAL_REQUEST_STATUS} value={r.status} size="md" />}
        actions={actions}
      />

      <Section title={t("request")}>
        <DescriptionList
          columns={2}
          items={[
            { term: t("customer"), description: r.customer.displayName },
            { term: t("productType"), description: r.productTypeCode },
            { term: t("description"), description: <span className="whitespace-pre-line">{r.description}</span> },
            {
              term: t("sizes"),
              description: r.sizes ? t("sizesValue", { sizes, basis: t(`bases.${r.sizes.measurementBasis}`) }) : "—",
            },
            { term: t("quantity"), description: r.quantity === null ? "—" : format.number(r.quantity) },
            { term: t("asked"), description: <When at={r.createdAt} /> },
            { term: t("assignee"), description: r.assignedTo?.displayName ?? "—" },
            { term: t("rfq"), description: r.serviceRfqId ?? "—" },
            ...(r.publishedBaseCode ? [{ term: t("publishedBase"), description: r.publishedBaseCode }] : []),
            ...(r.closedReason ? [{ term: t("closedReason"), description: r.closedReason }] : []),
          ]}
        />
      </Section>

      <Section title={t("files")}>
        <ul className="flex flex-wrap gap-2">
          {r.files.length === 0 ? <li className="text-muted text-sm">{t("noFiles")}</li> : null}
          {r.files.map((f) => (
            <li key={f.id}>
              <Button size="sm" variant="secondary" iconStart="download" onClick={() => file.mutate(f.id)}>
                {f.originalName}
              </Button>
            </li>
          ))}
        </ul>
        {r.deliveredFile ? (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{t("delivered")}</span>
            <Button size="sm" iconStart="download" onClick={() => file.mutate(r.deliveredFile!.id)}>
              {r.deliveredFile.originalName}
            </Button>
          </p>
        ) : null}
      </Section>

      {dialog === "assign" ? (
        <FormDialog
          title={t("assignTitle")}
          submitLabel={t("assign")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!assignee) throw new Error(t("assigneeRequired"));
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/structural-requests/{requestId}/actions/assign",
              { ...path, body: { assigneeId: assignee } },
            );
            settle(data);
            toast.success(t("assigned"));
          }}
        >
          <Field label={t("assignee")}>
            <SearchableSelect
              value={assignee}
              onValueChange={setAssignee}
              placeholder={t("assigneePlaceholder")}
              options={(designers.data ?? []).map((d) => ({ value: d.id, label: d.displayName }))}
            />
          </Field>
        </FormDialog>
      ) : null}

      {dialog === "rfq" ? (
        <FormDialog
          title={t("rfqTitle")}
          description={t("rfqBody")}
          submitLabel={t("linkRfq")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!rfqId.trim()) throw new Error(t("rfqRequired"));
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/structural-requests/{requestId}/actions/link-rfq",
              { ...path, body: { rfqId: rfqId.trim() } },
            );
            settle(data);
            toast.success(t("rfqLinked"));
          }}
        >
          <Field label={t("rfqId")}>
            <Input value={rfqId} onChange={(e) => setRfqId(e.target.value)} />
          </Field>
        </FormDialog>
      ) : null}

      {dialog === "deliver" ? (
        <FormDialog
          title={t("deliverTitle")}
          description={t("deliverBody")}
          submitLabel={t("deliver")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!dieline[0]) throw new Error(t("dielineRequired"));
            const uploaded = await uploadFile("admin", dieline[0], "dieline");
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/structural-requests/{requestId}/actions/deliver",
              { ...path, body: { dielineFileId: uploaded.id } },
            );
            settle(data);
            toast.success(t("deliveredToast"));
          }}
        >
          <FileDropzone
            accept=".dxf,.pdf,.ai,.svg,application/pdf,application/dxf,image/svg+xml"
            maxBytes={50 * 1024 * 1024}
            onFiles={setDieline}
            labels={{
              prompt: dieline.length ? t("chosen", { name: dieline[0].name }) : t("drop"),
              browse: t("browse"),
              tooLarge: (name) => t("tooLarge", { name }),
              wrongType: (name) => t("wrongType", { name }),
            }}
          />
        </FormDialog>
      ) : null}

      {dialog === "approve" ? (
        <FormDialog
          title={t("approveTitle")}
          description={t("approveBody")}
          submitLabel={t("approve")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/structural-requests/{requestId}/actions/approve",
              path,
            );
            settle(data);
            toast.success(t("approved"));
          }}
        >
          <p className="text-muted text-sm">{t("approveNote")}</p>
        </FormDialog>
      ) : null}

      {dialog === "publish" ? (
        <FormDialog
          title={t("publishTitle")}
          description={t("publishBody")}
          submitLabel={t("publish")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!BASE_CODE.test(baseCode.trim())) throw new Error(t("baseCodeInvalid"));
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/structural-requests/{requestId}/actions/publish",
              { ...path, body: { baseCode: baseCode.trim() } },
            );
            settle(data);
            toast.success(t("published"));
          }}
        >
          <Field label={t("baseCode")} hint={t("baseCodeHint")}>
            <Input value={baseCode} onChange={(e) => setBaseCode(e.target.value.toUpperCase())} />
          </Field>
        </FormDialog>
      ) : null}

      {dialog === "decline" ? (
        <FormDialog
          title={t("declineTitle")}
          submitLabel={t("decline")}
          destructive
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!reason.trim()) throw new Error(t("reasonRequired"));
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/structural-requests/{requestId}/actions/decline",
              { ...path, body: { reason: reason.trim() } },
            );
            settle(data);
            toast.success(t("declined"));
          }}
        >
          <Field label={t("reason")}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
