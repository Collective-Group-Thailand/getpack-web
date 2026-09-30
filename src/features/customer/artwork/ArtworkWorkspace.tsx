"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { FileLink } from "@/features/customer/files/FileLink";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { PREFLIGHT_STATUS, PROOF_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { IconButton } from "@/ui/components/IconButton";
import { Textarea } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";

import { findingsOf, loadArtwork, MAX_SUBMISSION_FILES, type Artwork, type Submission } from "./artwork";
import { DesignServicePanel } from "./DesignServicePanel";
import { artworkKey } from "./keys";

export type { Artwork } from "./artwork";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
/** Preflight runs after the file is in; the page asks again until it answers. */
const PREFLIGHT_POLL_MS = 2_000;

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
  const locale = useLocale();
  const findings = findingsOf(submission);
  const message = (finding: (typeof findings)[number]) => pick(locale, finding.messageTh, finding.messageEn);
  const block = findings.filter((finding) => finding.severity === "block");
  const warn = findings.filter((finding) => finding.severity === "warn");
  const info = findings.filter((finding) => finding.severity === "info");
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
              <li key={index}>{message(finding)}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {warn.length > 0 ? (
        <Callout tone="warning" title={t("warnings", { count: warn.length })}>
          <ul className="list-disc ps-5">
            {warn.map((finding, index) => (
              <li key={index}>{message(finding)}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">{t("warningsNote")}</p>
        </Callout>
      ) : null}
      {info.length > 0 ? (
        <ul className="text-muted list-disc ps-5 text-xs">
          {info.map((finding, index) => (
            <li key={index}>{message(finding)}</li>
          ))}
        </ul>
      ) : null}
      {findings.length === 0 && submission.preflightStatus === "passed" ? (
        <Callout tone="success">{t("passed")}</Callout>
      ) : null}
    </div>
  );
}

/**
 * The artwork page of one order (F3 3.5): the template to lay the file out on, the upload — several
 * files, resumable, each with its progress — and every version's preflight, blocking findings
 * first (D-070), then the proofs, or the hired-design panel for an order that bought design (D-071).
 *
 * CONTRACT-GAP store.artwork — the file rules and the box's dieline and size are not published:
 * the page cannot list what preflight checks, nor open the online designer on this box.
 */
export function ArtworkWorkspace({ initial }: { initial: Artwork }) {
  const t = useTranslations("artwork");
  const format = useFormat();
  const queryClient = useQueryClient();
  const orderId = initial.order.id;
  const artwork =
    useQuery({
      queryKey: artworkKey(orderId),
      queryFn: () => loadArtwork(browserApi(), orderId),
      initialData: initial,
      refetchInterval: (query) => {
        const status = query.state.data?.submissions[0]?.preflightStatus;
        return status === "pending" || status === "running" ? PREFLIGHT_POLL_MS : false;
      },
    }).data ?? initial;
  const [pending, setPending] = useState<Pending[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const { order } = artwork;
  const uploading = pending.some((file) => !file.fileId && !file.failed);
  const ready = pending.filter((file) => file.fileId);
  const latest = artwork.submissions[0];
  const template = artwork.templates.find((entry) => entry.fileId);

  async function add(files: File[]) {
    for (const file of files.slice(0, Math.max(0, MAX_SUBMISSION_FILES - pending.length))) {
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
      // `store.artwork.submit` answers with the new version; the rest of the page reads again.
      await browserApi().POST("/v1/store/orders/{orderId}/artwork-submissions", {
        params: { path: { orderId } },
        body: {
          files: ready.map((file) => ({ fileId: file.fileId!, role: "artwork" as const })),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: artworkKey(orderId) });
      setPending([]);
      setNote("");
    } catch (error) {
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
                    <Link href={`/account/orders/${orderId}/proof?version=${proof.versionNo}`}>
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

      {artwork.designService ? <DesignServicePanel artwork={artwork} /> : null}

      {/* Once a proof is approved the file is fixed (B4.1): the upload steps away. */}
      {order.designOption !== "hired_design" && order.artworkStatus !== "approved" ? (
        <section aria-labelledby="artwork-upload" className="flex flex-col gap-4">
          <h2 id="artwork-upload" className="text-lg font-semibold">
            {t("upload.title")}
          </h2>
          <p className="text-muted text-sm">{t("upload.checksIntro")}</p>
          {template?.fileId ? (
            <div className="flex flex-wrap gap-2">
              <FileLink
                fileId={template.fileId}
                label={t("upload.templateDownload")}
                openLabel={t("upload.templateOpen")}
                failed={t("upload.templateFailed")}
              />
            </div>
          ) : null}

          {artwork.actions.upload ? (
            <div className="flex flex-col gap-3">
              <FileDropzone
                multiple
                disabled={pending.length >= MAX_SUBMISSION_FILES}
                onFiles={(files) => void add(files)}
                labels={{
                  prompt: t("upload.drop"),
                  browse: t("upload.browse"),
                  hint: t("upload.hintNoRules", { count: MAX_SUBMISSION_FILES }),
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
                    files: submission.files
                      .map((entry) => entry.originalName ?? entry.linkUrl ?? "")
                      .filter(Boolean)
                      .join(", "),
                  })}
                </p>
                {submission.rejectReason ? <p className="text-sm">{submission.rejectReason}</p> : null}
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
