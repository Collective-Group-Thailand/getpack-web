"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { AdminPrepressAction, AdminSubmissionAction } from "@/domain/next-actions/admin";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";
import { checklistRows, requestNewFileMessage } from "@/features/shared/artwork/PreflightChecklist";

import { adminBrowserApis, AssignDialog, ConfirmAction, NextActionBar, problemMessage } from "../console";
import type { Order } from "../orders/resources";
import { usePrepressSettle } from "./data";
import type { ArtworkSubmission, DesignService, Proof } from "./resources";

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

const PDF = "application/pdf";
const MAX_BYTES = 200 * 1024 * 1024;

/** Who owns the order's prepress work, as an assignment made on this page set it. */
export type PrepressOwner = { id: string; displayName: string } | null;

/** The workspace's actions as `adminPrepressActions` offers them — see `NextActionBar`. */
export function PrepressActionBar({
  actions,
  onAction,
}: {
  actions: AdminPrepressAction[];
  onAction: (key: PrepressActionKey) => void;
}) {
  const t = useTranslations("prepress.actions");
  return (
    <NextActionBar
      actions={actions.map(({ key, irreversible }) => ({ key, irreversible }))}
      supported={SUPPORTED}
      labelOf={(key) => (t.has(`labels.${key}`) ? t(`labels.${key}`) : undefined)}
      onAction={(key) => onAction(key as PrepressActionKey)}
    />
  );
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

/**
 * The dialog for whichever workspace action is open. Delivering a design round and requoting send
 * the dialog's Idempotency-Key (`admin.design-services`); sending a proof or a template declares
 * none, so none is sent.
 */
export function PrepressActionDialogs({
  order,
  submissions,
  proofs,
  designService,
  owner,
  onAssigned,
  open,
  onClose,
}: {
  order: Order;
  submissions: ArtworkSubmission[];
  proofs: Proof[];
  designService: DesignService | null;
  owner: PrepressOwner | undefined;
  onAssigned: (owner: PrepressOwner) => void;
  open: PrepressActionKey | null;
  onClose: () => void;
}) {
  const t = useTranslations("prepress.actions");
  const format = useFormat();
  const settle = usePrepressSettle(order.id);
  const orderId = order.id;
  const accepted = submissions.filter((item) => item.status === "accepted_for_proof");
  const [submissionId, setSubmissionId] = useState(accepted[0]?.id ?? "");
  const [proofFile, setProofFile] = useState<File[]>([]);
  const [dieline, setDieline] = useState<File[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const contract = adminBrowserApis().contract;

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
      // `admin.artwork.assignPrepress` answers 204: the owner shown is the person picked here.
      return (
        <AssignDialog
          title={t("assign.title")}
          description={t("assign.body", { code: order.orderCode })}
          current={owner ?? null}
          permission="prepress.review"
          personHint={t("assign.personHint")}
          onAssign={async (assigneeId, person) => {
            await contract.POST("/v1/admin/orders/{orderId}/actions/assign-prepress", {
              params: { path: { orderId } },
              body: { assigneeId },
            });
            onAssigned(person);
            settle();
          }}
          onClose={onClose}
        />
      );
    case "upload_proof": {
      const version = (proofs[0]?.versionNo ?? 0) + 1;
      return (
        <ConfirmAction
          {...common}
          title={t("proof.title", { version })}
          description={t("proof.body", { code: order.orderCode })}
          confirmLabel={t("proof.confirm")}
          reason={{ label: t("proof.note"), hint: t("proof.noteHint") }}
          onConfirm={async ({ reason }) => {
            need(Boolean(submissionId), t("proof.needSubmission"));
            need(proofFile.length === 1, t("proof.needFile"));
            try {
              const proof = await uploadFile("admin", proofFile[0]!, "proof");
              const line = dieline[0] ? await uploadFile("admin", dieline[0], "proof") : null;
              await contract.POST("/v1/admin/orders/{orderId}/proofs", {
                params: { path: { orderId } },
                body: {
                  submissionId,
                  proofFileId: proof.id,
                  ...(line ? { dielineFileId: line.id } : {}),
                  ...(reason ? { changeNote: reason } : {}),
                },
              });
              settle();
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
          description={t("template.body", { code: order.orderCode })}
          confirmLabel={t("template.confirm")}
          reason={{ label: t("template.message"), hint: t("template.messageHint") }}
          onConfirm={async ({ reason }) => {
            need(files.length === 1, t("template.needFile"));
            try {
              const uploaded = await uploadFile("admin", files[0]!, "document");
              await contract.POST("/v1/admin/orders/{orderId}/templates", {
                params: { path: { orderId } },
                body: { fileId: uploaded.id, ...(reason ? { note: reason } : {}) },
              });
              settle();
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
      if (!designService) return null;
      const round = designService.rounds.find((item) => item.status === "in_progress");
      return (
        <ConfirmAction
          {...common}
          title={t("deliver.title", { round: round?.roundNo ?? 1 })}
          description={t("deliver.body", { code: order.orderCode })}
          confirmLabel={t("deliver.confirm")}
          reason={{ label: t("deliver.note"), hint: t("deliver.noteHint") }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            need(files.length > 0, t("deliver.needFiles"));
            try {
              const uploaded = await Promise.all(files.map((file) => uploadFile("admin", file, "artwork")));
              await contract.POST("/v1/admin/design-services/{designServiceId}/actions/deliver", {
                params: { path: { designServiceId: designService.id }, header: { "Idempotency-Key": idempotencyKey } },
                body: { fileIds: uploaded.map((item) => item.id), ...(reason ? { note: reason } : {}) },
              });
              settle();
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
      if (!designService) return null;
      return (
        <ConfirmAction
          {...common}
          title={t("requote.title")}
          description={t("requote.body", { code: order.orderCode, fee: format.thb(designService.designFeeNet) })}
          confirmLabel={t("requote.confirm")}
          tone="destructive"
          confirmationPhrase={order.orderCode}
          reason={{ label: t("requote.reason"), required: true, minLength: 3, hint: t("requote.reasonHint") }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              await contract.POST("/v1/admin/design-services/{designServiceId}/actions/requote", {
                params: { path: { designServiceId: designService.id }, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason },
              });
              settle();
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

/** Accept or send back one submission, as `adminSubmissionActions` offers. */
export function SubmissionDialogs({
  order,
  submission,
  open,
  onClose,
}: {
  order: Order;
  submission: ArtworkSubmission;
  open: AdminSubmissionAction["key"] | null;
  onClose: () => void;
}) {
  const t = useTranslations("prepress.actions");
  const tChecks = useTranslations("prepress.detail.artwork.checks");
  const locale = useLocale();
  const settle = usePrepressSettle(order.id);
  const warnings = submission.preflightReport?.warnCount ?? 0;
  const common = { open: true, onOpenChange: (next: boolean) => (next ? undefined : onClose()) };
  const path = { params: { path: { submissionId: submission.id } } };
  const fail = (error: unknown): never => {
    toast.error(problemMessage(error, t("failed")));
    throw error;
  };

  if (open === "submission.accept") {
    return (
      <ConfirmAction
        {...common}
        title={t("accept.title", { version: submission.versionNo })}
        // A file accepted with warnings carries prepress's note on why they are acceptable.
        description={
          warnings > 0
            ? t("accept.bodyWarnings", { code: order.orderCode, count: warnings })
            : t("accept.body", { code: order.orderCode })
        }
        confirmLabel={t("accept.confirm")}
        reason={
          warnings > 0
            ? { label: t("accept.note"), required: true, minLength: 3, hint: t("accept.noteHint") }
            : { label: t("accept.note"), hint: t("accept.noteOptional") }
        }
        onConfirm={async ({ reason }) => {
          try {
            await adminBrowserApis().contract.POST("/v1/admin/artwork-submissions/{submissionId}/actions/accept", {
              ...path,
              body: reason ? { note: reason } : {},
            });
            settle();
            toast.success(t("accept.done"));
          } catch (error) {
            fail(error);
          }
        }}
      />
    );
  }
  if (open === "submission.reject") {
    return (
      <ConfirmAction
        {...common}
        title={t("reject.title", { version: submission.versionNo })}
        description={t("reject.body", { code: order.orderCode })}
        confirmLabel={t("reject.confirm")}
        tone="destructive"
        reason={{
          label: t("reject.reason"),
          required: true,
          minLength: 3,
          hint: t("reject.reasonHint"),
          // Drafted from the checks that did not pass, for prepress to edit (UX audit: "ขอไฟล์ใหม่"
          // composes the customer's message from what failed).
          initial: requestNewFileMessage(
            checklistRows(
              (submission.preflightReport?.files ?? []).flatMap((file) => file.checks),
              locale,
            ),
            (check) => tChecks(check),
          ),
        }}
        onConfirm={async ({ reason }) => {
          try {
            await adminBrowserApis().contract.POST("/v1/admin/artwork-submissions/{submissionId}/actions/reject", {
              ...path,
              body: { reason },
            });
            settle();
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
