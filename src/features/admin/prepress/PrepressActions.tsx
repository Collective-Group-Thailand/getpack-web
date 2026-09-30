"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { AssignDialog, ConfirmAction, NextActionBar, problemMessage } from "../console";
import type { PrepressDetail } from "./resources";

export type PrepressActionKey =
  "upload_proof" | "send_template" | "deliver_round" | "requote_design" | "draw_dieline" | "assign";

const SUPPORTED = new Set<string>([
  "upload_proof",
  "send_template",
  "deliver_round",
  "requote_design",
  "draw_dieline",
  "assign",
]);

type Submission = PrepressDetail["submissions"][number];

const PDF = "application/pdf";
const MAX_BYTES = 200 * 1024 * 1024;

/** The workspace's actions, exactly as the API offered them — see `NextActionBar`. */
export function PrepressActionBar({
  detail,
  onAction,
}: {
  detail: PrepressDetail;
  onAction: (key: PrepressActionKey) => void;
}) {
  const t = useTranslations("prepress.actions");
  return (
    <NextActionBar
      actions={detail.nextActions}
      supported={SUPPORTED}
      labelOf={(key) => (t.has(`labels.${key}`) ? t(`labels.${key}`) : undefined)}
      onAction={(key) => onAction(key as PrepressActionKey)}
    />
  );
}

/** Keeps the workspace, the desk, the order screen and the dashboard in step. */
export function usePrepressSettle(orderId: string) {
  const queryClient = useQueryClient();
  return (updated?: PrepressDetail) => {
    if (updated) queryClient.setQueryData(queryKeys.detail("admin", "prepress", orderId), updated);
    else void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "prepress", orderId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "prepress") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "order", orderId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
}

function Dropzone({
  files,
  onFiles,
  multiple,
  accept = PDF,
}: {
  files: File[];
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
}) {
  const t = useTranslations("prepress.actions.files");
  return (
    <FileDropzone
      accept={accept}
      maxBytes={MAX_BYTES}
      multiple={multiple}
      onFiles={onFiles}
      labels={{
        prompt: files.length ? t("chosen", { names: files.map((file) => file.name).join(", ") }) : t("drop"),
        browse: t("browse"),
        tooLarge: (name) => t("tooLarge", { name }),
        wrongType: (name) => t("wrongType", { name }),
      }}
    />
  );
}

/** The dialog for whichever workspace action is open. */
export function PrepressActionDialogs({
  detail,
  open,
  onClose,
}: {
  detail: PrepressDetail;
  open: PrepressActionKey | null;
  onClose: () => void;
}) {
  const t = useTranslations("prepress.actions");
  const format = useFormat();
  const settle = usePrepressSettle(detail.orderId);
  const orderId = detail.orderId;
  const accepted = detail.submissions.filter((item) => item.status === "accepted_for_proof");
  const [submissionId, setSubmissionId] = useState(accepted[0]?.id ?? "");
  const [proofFile, setProofFile] = useState<File[]>([]);
  const [dieline, setDieline] = useState<File[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const fail = (error: unknown): never => {
    toast.error(problemMessage(error, t("failed")));
    throw error;
  };
  const need = (ok: boolean, message: string) => {
    if (!ok) {
      toast.error(message);
      throw new Error(message);
    }
  };
  const common = { open: true, onOpenChange: (next: boolean) => (next ? undefined : onClose()) };

  switch (open) {
    case "assign":
      return (
        <AssignDialog
          title={t("assign.title")}
          description={t("assign.body", { code: detail.orderCode })}
          current={detail.assignee}
          permission="prepress.review"
          personHint={t("assign.personHint")}
          onAssign={async (assigneeId) =>
            settle(
              await browserRequests().call("POST /v1/admin/prepress/{orderId}/actions/assign", {
                path: { orderId },
                body: { assigneeId },
              }),
            )
          }
          onClose={onClose}
        />
      );
    case "upload_proof": {
      const version = (detail.proofs[0]?.versionNo ?? 0) + 1;
      return (
        <ConfirmAction
          {...common}
          title={t("proof.title", { version })}
          description={t("proof.body", { code: detail.orderCode, customer: detail.customer.displayName })}
          confirmLabel={t("proof.confirm")}
          reason={{ label: t("proof.note"), hint: t("proof.noteHint") }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            need(Boolean(submissionId), t("proof.needSubmission"));
            need(proofFile.length === 1, t("proof.needFile"));
            try {
              const proof = await uploadFile("admin", proofFile[0]!, "proof");
              const line = dieline[0] ? await uploadFile("admin", dieline[0], "proof") : null;
              settle(
                await browserRequests().call("POST /v1/admin/prepress/{orderId}/proofs", {
                  path: { orderId },
                  body: {
                    submissionId,
                    proofFileId: proof.id,
                    ...(line ? { dielineFileId: line.id } : {}),
                    ...(reason ? { note: reason } : {}),
                  },
                  idempotencyKey,
                }),
              );
              toast.success(t("proof.done", { version }));
            } catch (error) {
              fail(error);
            }
          }}
        >
          <div className="mt-4 space-y-3">
            <Field label={t("proof.submission")} required>
              <Select
                value={submissionId || undefined}
                onValueChange={setSubmissionId}
                placeholder={t("proof.chooseSubmission")}
                options={accepted.map((item) => ({
                  value: item.id,
                  label: t("proof.submissionOption", { version: item.versionNo }),
                }))}
              />
            </Field>
            <Field label={t("proof.file")} hint={t("proof.fileHint")} required>
              <Dropzone files={proofFile} onFiles={(picked) => setProofFile(picked.slice(0, 1))} />
            </Field>
            <Field label={t("proof.dieline")} hint={t("proof.dielineHint")}>
              <Dropzone files={dieline} onFiles={(picked) => setDieline(picked.slice(0, 1))} />
            </Field>
          </div>
        </ConfirmAction>
      );
    }
    case "send_template":
      return (
        <ConfirmAction
          {...common}
          title={t("template.title")}
          description={t("template.body", { code: detail.orderCode, customer: detail.customer.displayName })}
          confirmLabel={t("template.confirm")}
          reason={{ label: t("template.message"), hint: t("template.messageHint") }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            need(files.length === 1, t("template.needFile"));
            try {
              const uploaded = await uploadFile("admin", files[0]!, "document");
              settle(
                await browserRequests().call("POST /v1/admin/prepress/{orderId}/actions/send-template", {
                  path: { orderId },
                  body: { fileId: uploaded.id, ...(reason ? { message: reason } : {}) },
                  idempotencyKey,
                }),
              );
              toast.success(t("template.done"));
            } catch (error) {
              fail(error);
            }
          }}
        >
          <div className="mt-4">
            <Field label={t("template.file")} hint={t("template.fileHint")} required>
              <Dropzone
                files={files}
                onFiles={(picked) => setFiles(picked.slice(0, 1))}
                accept="application/pdf,image/svg+xml,.dxf"
              />
            </Field>
          </div>
        </ConfirmAction>
      );
    case "deliver_round": {
      const round = detail.designService?.rounds.find((item) => item.status === "in_progress");
      return (
        <ConfirmAction
          {...common}
          title={t("deliver.title", { round: round?.roundNo ?? 1 })}
          description={t("deliver.body", { code: detail.orderCode, customer: detail.customer.displayName })}
          confirmLabel={t("deliver.confirm")}
          reason={{ label: t("deliver.note"), hint: t("deliver.noteHint") }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            need(files.length > 0, t("deliver.needFiles"));
            try {
              const uploaded = await Promise.all(files.map((file) => uploadFile("admin", file, "artwork")));
              settle(
                await browserRequests().call("POST /v1/admin/prepress/{orderId}/design/actions/deliver-round", {
                  path: { orderId },
                  body: { fileIds: uploaded.map((item) => item.id), ...(reason ? { note: reason } : {}) },
                  idempotencyKey,
                }),
              );
              toast.success(t("deliver.done"));
            } catch (error) {
              fail(error);
            }
          }}
        >
          <div className="mt-4">
            <Field label={t("deliver.files")} required>
              <Dropzone
                files={files}
                onFiles={(picked) => setFiles(picked.slice(0, 10))}
                multiple
                accept="application/pdf,image/*"
              />
            </Field>
          </div>
        </ConfirmAction>
      );
    }
    case "requote_design":
      return (
        <ConfirmAction
          {...common}
          title={t("requote.title")}
          description={t("requote.body", {
            code: detail.orderCode,
            fee: format.thb(detail.designService?.designFeeNet ?? null),
          })}
          confirmLabel={t("requote.confirm")}
          tone="destructive"
          confirmationPhrase={detail.orderCode}
          reason={{ label: t("requote.reason"), required: true, minLength: 3, hint: t("requote.reasonHint") }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              settle(
                await browserRequests().call("POST /v1/admin/prepress/{orderId}/design/actions/requote", {
                  path: { orderId },
                  body: { reason },
                  idempotencyKey,
                }),
              );
              toast.success(t("requote.done"));
            } catch (error) {
              fail(error);
            }
          }}
        />
      );
    default:
      return null;
  }
}

/** Accept or send back one submission, as its own `nextActions` allow. */
export function SubmissionDialogs({
  detail,
  submission,
  open,
  onClose,
}: {
  detail: PrepressDetail;
  submission: Submission;
  open: "accept" | "reject" | null;
  onClose: () => void;
}) {
  const t = useTranslations("prepress.actions");
  const settle = usePrepressSettle(detail.orderId);
  const warnings = submission.findings.filter((finding) => finding.severity === "warn").length;
  const common = { open: true, onOpenChange: (next: boolean) => (next ? undefined : onClose()) };
  const fail = (error: unknown): never => {
    toast.error(problemMessage(error, t("failed")));
    throw error;
  };

  if (open === "accept") {
    return (
      <ConfirmAction
        {...common}
        title={t("accept.title", { version: submission.versionNo })}
        description={
          warnings > 0
            ? t("accept.bodyWarnings", { code: detail.orderCode, count: warnings })
            : t("accept.body", { code: detail.orderCode })
        }
        confirmLabel={t("accept.confirm")}
        reason={{ label: t("accept.note"), hint: t("accept.noteHint"), required: warnings > 0, minLength: 3 }}
        onConfirm={async ({ reason }) => {
          try {
            settle(
              await browserRequests().call("POST /v1/admin/prepress/submissions/{submissionId}/actions/accept", {
                path: { submissionId: submission.id },
                body: reason ? { note: reason } : {},
              }),
            );
            toast.success(t("accept.done"));
          } catch (error) {
            fail(error);
          }
        }}
      />
    );
  }
  if (open === "reject") {
    return (
      <ConfirmAction
        {...common}
        title={t("reject.title", { version: submission.versionNo })}
        description={t("reject.body", { code: detail.orderCode, customer: detail.customer.displayName })}
        confirmLabel={t("reject.confirm")}
        tone="destructive"
        reason={{ label: t("reject.reason"), required: true, minLength: 3, hint: t("reject.reasonHint") }}
        onConfirm={async ({ reason }) => {
          try {
            settle(
              await browserRequests().call("POST /v1/admin/prepress/submissions/{submissionId}/actions/reject", {
                path: { submissionId: submission.id },
                body: { reason },
              }),
            );
            toast.success(t("reject.done"));
          } catch (error) {
            fail(error);
          }
        }}
      />
    );
  }
  return null;
}
