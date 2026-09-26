"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { PREFLIGHT_STATUS, PROOF_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { IconButton } from "@/ui/components/IconButton";
import { Textarea } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";

import { DesignServicePanel } from "./DesignServicePanel";
import { artworkKey } from "./keys";

export type Artwork = ResponseOf<Requests, "GET /v1/store/orders/{orderId}/artwork">;
type Submission = Artwork["submissions"][number];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

interface Pending {
  key: string;
  name: string;
  sent: number;
  total: number;
  fileId?: string;
  failed?: boolean;
}

/** One submission's preflight, blocking first (D-070): what stops the file, then what to check. */
function Findings({ submission }: { submission: Submission }) {
  const t = useTranslations("artwork.preflight");
  const block = submission.findings.filter((finding) => finding.severity === "block");
  const warn = submission.findings.filter((finding) => finding.severity === "warn");
  const info = submission.findings.filter((finding) => finding.severity === "info");
  if (submission.preflightStatus === "running" || submission.preflightStatus === "pending") {
    return (
      <p className="text-muted flex items-center gap-2 text-sm" aria-live="polite">
        <Icon name="spinner" size={16} className="animate-spin" aria-hidden="true" />
        {t("running")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {block.length > 0 ? (
        <Callout tone="danger" title={t("blocking", { count: block.length })}>
          <ul className="list-disc ps-5">
            {block.map((finding, index) => (
              <li key={index}>{finding.message}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {warn.length > 0 ? (
        <Callout tone="warning" title={t("warnings", { count: warn.length })}>
          <ul className="list-disc ps-5">
            {warn.map((finding, index) => (
              <li key={index}>{finding.message}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">{t("warningsNote")}</p>
        </Callout>
      ) : null}
      {info.length > 0 ? (
        <ul className="text-muted list-disc ps-5 text-xs">
          {info.map((finding, index) => (
            <li key={index}>{finding.message}</li>
          ))}
        </ul>
      ) : null}
      {submission.findings.length === 0 && submission.preflightStatus === "passed" ? (
        <Callout tone="success">{t("passed")}</Callout>
      ) : null}
    </div>
  );
}

/**
 * The artwork page of one order (F3 3.5): what a printable file needs (from settings), the
 * template to lay it out on, the upload — several files, resumable, each with its progress —
 * and every version's preflight, blocking findings first (D-070), then the proofs, or the
 * hired-design panel for an order that bought design (D-071).
 */
export function ArtworkWorkspace({ initial, designerHref }: { initial: Artwork; designerHref: string | null }) {
  const t = useTranslations("artwork");
  const format = useFormat();
  const queryClient = useQueryClient();
  const artwork = useQuery({
    queryKey: artworkKey(initial.orderId),
    queryFn: () =>
      browserRequests().call("GET /v1/store/orders/{orderId}/artwork", { path: { orderId: initial.orderId } }),
    initialData: initial,
  }).data;
  const [pending, setPending] = useState<Pending[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(newKey());

  const canUpload = artwork.nextActions.some((action) => action.key === "artwork.upload");
  const uploading = pending.some((file) => !file.fileId && !file.failed);
  const ready = pending.filter((file) => file.fileId);
  const latest = artwork.submissions[0];
  const rules = artwork.rules;

  async function add(files: File[]) {
    for (const file of files.slice(0, Math.max(0, rules.maxFiles - pending.length))) {
      const entry: Pending = { key: newKey(), name: file.name, sent: 0, total: file.size };
      setPending((current) => [...current, entry]);
      try {
        const uploaded = await uploadFile("customer", file, "artwork", {
          onProgress: (sent, total) =>
            setPending((current) => current.map((item) => (item.key === entry.key ? { ...item, sent, total } : item))),
        });
        setPending((current) =>
          current.map((item) => (item.key === entry.key ? { ...item, fileId: uploaded.id } : item)),
        );
      } catch {
        setPending((current) => current.map((item) => (item.key === entry.key ? { ...item, failed: true } : item)));
      }
    }
  }

  async function submit() {
    setSubmitting(true);
    setFailure(null);
    try {
      const next = await browserRequests().call("POST /v1/store/orders/{orderId}/artwork/submissions", {
        path: { orderId: artwork.orderId },
        body: {
          files: ready.map((file) => ({ fileId: file.fileId!, role: "artwork" as const })),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        idempotencyKey: key.current,
      });
      key.current = newKey();
      queryClient.setQueryData(artworkKey(artwork.orderId), next);
      setPending([]);
      setNote("");
    } catch (error) {
      if (isApiError(error)) key.current = newKey();
      setFailure(isApiError(error) ? error.detail : t("upload.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {artwork.proofs.length > 0 ? (
        <section aria-labelledby="artwork-proofs">
          <h2 id="artwork-proofs" className="text-lg font-semibold">
            {t("proofs.title")}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {artwork.proofs.map((proof) => (
              <li
                key={proof.id}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{t("proofs.version", { version: proof.versionNo })}</p>
                  <p className="text-muted text-xs">{t("proofs.sent", { date: format.dateTime(proof.sentAt) })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip map={PROOF_STATUS} value={proof.status} />
                  <Button asChild size="sm" variant={proof.status === "pending_customer" ? "primary" : "secondary"}>
                    <Link href={`/account/orders/${artwork.orderId}/proof?version=${proof.versionNo}`}>
                      {proof.status === "pending_customer" ? t("proofs.review") : t("proofs.view")}
                      <span className="sr-only"> {t("proofs.version", { version: proof.versionNo })}</span>
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {artwork.designService ? (
        <DesignServicePanel
          orderId={artwork.orderId}
          orderCode={artwork.orderCode}
          service={artwork.designService}
          actions={artwork.nextActions}
        />
      ) : null}

      {/* Once a proof is approved the file is fixed (B4.1): the rules and upload step away. */}
      {artwork.designOption !== "hired_design" && artwork.artworkStatus !== "approved" ? (
        <section aria-labelledby="artwork-upload" className="flex flex-col gap-4">
          <h2 id="artwork-upload" className="text-lg font-semibold">
            {t("upload.title")}
          </h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li className="flex items-start gap-2">
              <Icon name="ruler" size={16} aria-hidden="true" className="mt-0.5" />
              {t("rules.bleed", { mm: format.number(rules.bleedMm) })}
            </li>
            <li className="flex items-start gap-2">
              <Icon name="safe-zone" size={16} aria-hidden="true" className="mt-0.5" />
              {t("rules.safe", { mm: format.number(rules.safeMarginMm) })}
            </li>
            <li className="flex items-start gap-2">
              <Icon name="image" size={16} aria-hidden="true" className="mt-0.5" />
              {t("rules.dpi", { dpi: format.number(rules.minDpi) })}
            </li>
            <li className="flex items-start gap-2">
              <Icon name="palette" size={16} aria-hidden="true" className="mt-0.5" />
              {rules.colourMode === "cmyk" ? t("rules.cmyk") : t("rules.anyColour")}
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            {artwork.dieline.templateUrl ? (
              <Button asChild variant="secondary" size="sm" iconStart="download">
                <a href={artwork.dieline.templateUrl} download={`${artwork.orderCode}-dieline.svg`}>
                  {t("upload.template")}
                </a>
              </Button>
            ) : null}
            {designerHref ? (
              <Button asChild variant="ghost" size="sm" iconStart="palette">
                <Link href={designerHref}>{t("upload.designOnline")}</Link>
              </Button>
            ) : null}
          </div>

          {canUpload ? (
            <div className="flex flex-col gap-3">
              <FileDropzone
                multiple
                accept={rules.accept}
                maxBytes={rules.maxBytes}
                disabled={pending.length >= rules.maxFiles}
                onFiles={(files) => void add(files)}
                labels={{
                  prompt: t("upload.drop"),
                  browse: t("upload.browse"),
                  hint: t("upload.hint", { max: format.bytes(rules.maxBytes), count: rules.maxFiles }),
                  tooLarge: (name) => t("upload.tooLarge", { name }),
                  wrongType: (name) => t("upload.wrongType", { name }),
                }}
              />
              {pending.length > 0 ? (
                <ul className="flex flex-col gap-2" aria-label={t("upload.files")}>
                  {pending.map((file) => {
                    const percent = file.total ? Math.round((file.sent / file.total) * 100) : 0;
                    return (
                      <li
                        key={file.key}
                        className="border-border flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                        {file.failed ? (
                          <span className="text-danger text-xs">{t("upload.fileFailed")}</span>
                        ) : file.fileId ? (
                          <span className="text-success-subtle-fg text-xs">{t("upload.fileDone")}</span>
                        ) : (
                          <progress
                            className="h-2 w-28"
                            max={100}
                            value={percent}
                            aria-label={t("upload.progress", { name: file.name })}
                          />
                        )}
                        <IconButton
                          name="close"
                          size="sm"
                          variant="ghost"
                          label={t("upload.remove", { name: file.name })}
                          onClick={() => setPending((current) => current.filter((item) => item.key !== file.key))}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <Field label={t("upload.note")} hint={t("upload.noteHint")}>
                <Textarea rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
              {failure ? (
                <Callout tone="danger" live>
                  {failure}
                </Callout>
              ) : null}
              <Button
                className="self-start"
                iconStart="upload"
                loading={submitting}
                disabled={ready.length === 0 || uploading}
                onClick={() => void submit()}
              >
                {t("upload.submit")}
              </Button>
            </div>
          ) : latest ? null : (
            <p className="text-muted text-sm">{t("upload.notYet")}</p>
          )}
        </section>
      ) : null}

      {artwork.submissions.length > 0 ? (
        <section aria-labelledby="artwork-versions">
          <h2 id="artwork-versions" className="text-lg font-semibold">
            {t("versions.title")}
          </h2>
          <ol className="mt-3 flex flex-col gap-4">
            {artwork.submissions.map((submission, index) => (
              <li key={submission.id} className="border-border flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {t("versions.version", { version: submission.versionNo })}
                    {index === 0 ? <span className="text-muted ms-2 text-xs">{t("versions.latest")}</span> : null}
                  </p>
                  <StatusChip map={PREFLIGHT_STATUS} value={submission.preflightStatus} />
                </div>
                <p className="text-muted text-xs">
                  {t("versions.meta", {
                    date: format.dateTime(submission.submittedAt),
                    files: submission.files.map((entry) => entry.file.originalName).join(", "),
                  })}
                </p>
                {submission.rejectionReason ? <p className="text-sm">{submission.rejectionReason}</p> : null}
                {index === 0 ? <Findings submission={submission} /> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="text-muted text-xs">{t("help")}</p>
    </div>
  );
}
