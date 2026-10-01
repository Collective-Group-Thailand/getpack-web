"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { adminSubmissionActions, type AdminSubmissionAction } from "@/domain/next-actions/admin";
import {
  DESIGN_ROUND_STATUS,
  DESIGN_SERVICE_STATUS,
  DRAWING_STATUS,
  PREFLIGHT_STATUS,
  PROOF_STATUS,
  SUBMISSION_STATUS,
} from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Meter } from "@/ui/components/Meter";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, problemMessage, StatusChip, useActor, useCan, useSlaFormat } from "../console";
import type { Order } from "../orders/resources";
import { useProof } from "./data";
import { FileItem } from "./FileItem";
import { SubmissionDialogs } from "./PrepressActions";
import type {
  ArtworkSubmission,
  DesignService,
  DielineDelivery,
  DrawingJob,
  Proof,
  ProofAnnotation,
} from "./resources";

function Section({
  title,
  children,
  actions,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex flex-wrap items-center gap-2">{title}</CardTitle>
        {actions}
      </CardHeader>
      {children}
    </Card>
  );
}

function useLocalized() {
  const locale = useLocale();
  return (th: string, en: string | null | undefined) => (locale === "en" && en ? en : th);
}

/* ------------------------------------------------------------------------------------ artwork */

const SEVERITIES = ["block", "warn", "info"] as const;

function SubmissionCard({ order, submission }: { order: Order; submission: ArtworkSubmission }) {
  const t = useTranslations("prepress.detail.artwork");
  const localized = useLocalized();
  const actor = useActor();
  const [open, setOpen] = useState<AdminSubmissionAction["key"] | null>(null);
  const actions = adminSubmissionActions(submission, (permission) => actor.permissions.includes(permission));
  const accept = actions.find((action) => action.key === "submission.accept");
  const reject = actions.find((action) => action.key === "submission.reject");
  const findings = (submission.preflightReport?.files ?? []).flatMap((file) =>
    file.checks.filter((check) => check.outcome !== "pass"),
  );
  const groups = SEVERITIES.map((severity) => ({
    severity,
    findings: findings.filter((finding) => finding.severity === severity),
  })).filter((group) => group.findings.length > 0);

  return (
    <Section
      title={
        <>
          {t("version", { version: submission.versionNo })}
          <StatusChip map={SUBMISSION_STATUS} value={submission.status} />
          <StatusChip map={PREFLIGHT_STATUS} value={submission.preflightStatus} />
        </>
      }
      actions={
        accept || reject ? (
          <div className="flex flex-wrap gap-2">
            {reject ? (
              <Button size="sm" variant="secondary" iconStart="undo" onClick={() => setOpen("submission.reject")}>
                {t("reject")}
              </Button>
            ) : null}
            {accept ? (
              <Button
                size="sm"
                iconStart="check"
                disabled={Boolean(accept.blockedBy)}
                onClick={() => setOpen("submission.accept")}
              >
                {t("accept")}
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {/* CONTRACT-GAP admin.prepress — the submission does not say who submitted it. */}
      <p className="text-muted mb-3 text-xs">
        {t(`sources.${submission.source}`)} · {t(`channels.${submission.channel}`)} ·{" "}
        <When at={submission.submittedAt} />
      </p>
      {accept?.blockedBy ? <Callout tone="danger" title={t(`blocked.${accept.blockedBy}`)} className="mb-3" /> : null}
      {submission.rejectReason ? (
        <Callout tone="warning" title={t("rejectReason")} className="mb-3">
          {submission.rejectReason}
        </Callout>
      ) : null}
      {submission.note ? <p className="mb-3 text-sm">{t("note", { note: submission.note })}</p> : null}

      <h3 className="mb-2 text-sm font-medium">{t("report")}</h3>
      {!submission.preflightReport ? (
        <p className="text-muted text-sm">{t("reportPending")}</p>
      ) : groups.length === 0 ? (
        <p className="text-success-subtle-fg flex items-center gap-2 text-sm">
          <Icon name="check" size={16} />
          {t("clean")}
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.severity}>
              <p
                className={cn(
                  "mb-1 flex items-center gap-1 text-xs font-medium",
                  group.severity === "block"
                    ? "text-danger"
                    : group.severity === "warn"
                      ? "text-warning-subtle-fg"
                      : "text-muted",
                )}
              >
                <Icon
                  name={group.severity === "block" ? "ban" : group.severity === "warn" ? "warning" : "info"}
                  size={14}
                />
                {t(`severity.${group.severity}`, { count: group.findings.length })}
              </p>
              <ul className="divide-border divide-y rounded-md border text-sm">
                {group.findings.map((finding, index) => (
                  <li key={index} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                    <span>
                      <span className="font-medium">{t(`checks.${finding.check}`)}</span>
                      <span className="text-muted"> · {localized(finding.messageTh, finding.messageEn)}</span>
                    </span>
                    {finding.page ? (
                      <span className="text-muted text-xs">{t("page", { page: finding.page })}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h3 className="mt-4 mb-2 text-sm font-medium">{t("files")}</h3>
      <ul className="space-y-1">
        {submission.files.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-2">
            {entry.linkUrl ? (
              <a href={entry.linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm">
                {entry.originalName ?? entry.linkUrl}
              </a>
            ) : (
              <FileItem fileId={entry.fileId} name={entry.originalName ?? t("unnamed")} sizeBytes={entry.sizeBytes} />
            )}
            <Badge size="sm">{t(`roles.${entry.role}`)}</Badge>
          </li>
        ))}
      </ul>
      <SubmissionDialogs order={order} submission={submission} open={open} onClose={() => setOpen(null)} />
    </Section>
  );
}

/**
 * The customer's files and their preflight (D-070), newest first.
 *
 * CONTRACT-GAP admin.prepress — the order does not reference the design document an online design
 * was sent from, so the read-only preview and "open in the designer" are not shown here.
 */
export function ArtworkTab({ order, submissions }: { order: Order; submissions: ArtworkSubmission[] }) {
  const t = useTranslations("prepress.detail.artwork");
  return (
    <div className="flex flex-col gap-4">
      {submissions.length === 0 ? (
        <EmptyState icon="upload" title={t("none")} description={t("noneBody")} />
      ) : (
        submissions.map((submission) => <SubmissionCard key={submission.id} order={order} submission={submission} />)
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------- proofs */

function Marker({ annotation, number, active }: { annotation: ProofAnnotation; number: number; active: boolean }) {
  const geometry = annotation.geometry as { x?: number; y?: number; w?: number; h?: number };
  const x = Math.min(Math.max(Number(geometry.x ?? 0), 0), 1) * 100;
  const y = Math.min(Math.max(Number(geometry.y ?? 0), 0), 1) * 100;
  const resolved = Boolean(annotation.resolvedAt);
  return annotation.kind === "rect" ? (
    <span
      aria-hidden
      className={cn(
        "absolute rounded-sm border-2",
        resolved ? "border-border" : "border-danger",
        active && "ring-primary ring-2",
      )}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${Number(geometry.w ?? 0.1) * 100}%`,
        height: `${Number(geometry.h ?? 0.1) * 100}%`,
      }}
    >
      <span className="bg-danger text-danger-fg absolute -top-3 -left-3 grid size-6 place-items-center rounded-full text-xs font-bold">
        {number}
      </span>
    </span>
  ) : (
    <span
      aria-hidden
      className={cn(
        "absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-xs font-bold",
        resolved ? "bg-surface-subtle text-muted border" : "bg-danger text-danger-fg",
        active && "ring-primary ring-2",
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {number}
    </span>
  );
}

/** Prepress answers while the customer decides, and after changes were requested (B4.1). */
const OPEN_FOR_STAFF: readonly Proof["status"][] = ["pending_customer", "changes_requested"];

/**
 * The customer's annotation threads on one proof (inline on `admin.artwork.getProof`): a page map of
 * where each points (page-relative, as the proof viewer records them) beside the threads, where
 * prepress replies and resolves. Both answer the whole proof, which replaces the cached one.
 */
function Annotations({ proof: listed }: { proof: Proof }) {
  const t = useTranslations("prepress.detail.proofs");
  const canManage = useCan("prepress.review");
  const queryClient = useQueryClient();
  const query = useProof(listed);
  const proof = query.data ?? listed;
  const [active, setActive] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const contract = adminBrowserApis().contract;

  const settle = (updated: Proof) => {
    queryClient.setQueryData(queryKeys.detail("admin", "proof", updated.id), updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.related("admin", "order", updated.orderId, "proofs") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "prepress") });
  };

  const reply = useMutation({
    // A reply takes its thread's kind, page and geometry (the API copies them).
    mutationFn: async (parent: ProofAnnotation) =>
      (
        await contract.POST("/v1/admin/proofs/{proofId}/annotations", {
          params: { path: { proofId: proof.id } },
          body: { parentId: parent.id, comment: (drafts[parent.id] ?? "").trim() },
        })
      ).data!,
    onSuccess: (updated, parent) => {
      setDrafts((current) => ({ ...current, [parent.id]: "" }));
      toast.success(t("replied"));
      settle(updated);
    },
    onError: (error) => toast.error(problemMessage(error, t("replyFailed"))),
  });
  const resolve = useMutation({
    mutationFn: async (annotationId: string) =>
      (
        await contract.POST("/v1/admin/proof-annotations/{annotationId}/actions/resolve", {
          params: { path: { annotationId } },
        })
      ).data!,
    onSuccess: (updated) => {
      toast.success(t("resolved"));
      settle(updated);
    },
    onError: (error) => toast.error(problemMessage(error, t("resolveFailed"))),
  });

  const all = proof.annotations;
  const threads = all.filter((item) => !item.parentId);
  const answerable = canManage && OPEN_FOR_STAFF.includes(proof.status);
  if (query.isError) return <p className="text-danger text-sm">{problemMessage(query.error, t("loadFailed"))}</p>;
  if (threads.length === 0) return <p className="text-muted text-sm">{t("noAnnotations")}</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div
        className="bg-surface-subtle relative aspect-[1/1.414] w-full max-w-56 rounded-md border"
        role="img"
        aria-label={t("pageMap", { count: threads.length })}
      >
        {threads.map((thread, index) => (
          <Marker key={thread.id} annotation={thread} number={index + 1} active={active === thread.id} />
        ))}
      </div>
      <ol className="space-y-3">
        {threads.map((thread, index) => {
          const replies = all.filter((item) => item.parentId === thread.id);
          return (
            <li
              key={thread.id}
              className={cn("rounded-md border p-3 text-sm", thread.resolvedAt ? "border-border" : "border-danger/40")}
              onMouseEnter={() => setActive(thread.id)}
              onMouseLeave={() => setActive(null)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-medium">
                  <span className="bg-danger text-danger-fg grid size-6 place-items-center rounded-full text-xs">
                    {index + 1}
                  </span>
                  {t("thread", { page: thread.page, kind: t(`kinds.${thread.kind}`) })}
                </p>
                {thread.resolvedAt ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="success" size="sm" icon="check">
                      {t("isResolved")}
                    </Badge>
                    {thread.resolvedBy ? (
                      <span className="text-muted text-xs">
                        {t("resolvedBy", { name: thread.resolvedBy.displayName })}
                      </span>
                    ) : null}
                  </span>
                ) : canManage ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    iconStart="check"
                    loading={resolve.isPending && resolve.variables === thread.id}
                    onClick={() => resolve.mutate(thread.id)}
                  >
                    {t("resolve", { number: index + 1 })}
                  </Button>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap">{thread.comment}</p>
              <p className="text-muted mt-1 text-xs">
                {thread.author.displayName} · <When at={thread.createdAt} />
              </p>
              {replies.length > 0 ? (
                <ul className="border-border mt-2 space-y-2 border-s-2 ps-3">
                  {replies.map((item) => (
                    <li key={item.id}>
                      <p className="whitespace-pre-wrap">{item.comment}</p>
                      <p className="text-muted text-xs">
                        {item.author.displayName} · <When at={item.createdAt} />
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {answerable && !thread.resolvedAt ? (
                <form
                  className="mt-3 flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if ((drafts[thread.id] ?? "").trim()) reply.mutate(thread);
                  }}
                >
                  <Field label={t("replyLabel", { number: index + 1 })} labelHidden>
                    <Textarea
                      rows={2}
                      placeholder={t("replyPlaceholder")}
                      value={drafts[thread.id] ?? ""}
                      onChange={(event) => setDrafts((current) => ({ ...current, [thread.id]: event.target.value }))}
                    />
                  </Field>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      iconStart="send"
                      disabled={!(drafts[thread.id] ?? "").trim()}
                      loading={reply.isPending && reply.variables?.id === thread.id}
                    >
                      {t("reply")}
                    </Button>
                  </div>
                </form>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The proof versions, newest first, with who decided each (`decidedByName`: the customer, or
 * Packio for a decision taken on their behalf). CONTRACT-GAP admin.prepress-proofs — a proof does
 * not say who prepared it.
 */
export function ProofsTab({
  proofs,
  submissions,
  onUpload,
}: {
  proofs: Proof[];
  submissions: ArtworkSubmission[];
  onUpload?: () => void;
}) {
  const t = useTranslations("prepress.detail.proofs");
  if (proofs.length === 0) {
    return (
      <EmptyState
        icon="file-check"
        title={t("none")}
        description={t("noneBody")}
        action={
          onUpload ? (
            <Button iconStart="upload" onClick={onUpload}>
              {t("upload")}
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {onUpload ? (
        <div className="flex justify-end">
          <Button iconStart="upload" onClick={onUpload}>
            {t("uploadNext", { version: proofs[0]!.versionNo + 1 })}
          </Button>
        </div>
      ) : null}
      {proofs.map((proof, index) => {
        const open = proof.annotations.filter((item) => !item.parentId && !item.resolvedAt).length;
        const source = submissions.find((item) => item.id === proof.submissionId);
        return (
          <Section
            key={proof.id}
            title={
              <>
                {t("version", { version: proof.versionNo })}
                <StatusChip map={PROOF_STATUS} value={proof.status} />
                {open > 0 ? (
                  <Badge tone="danger" size="sm" icon="chat">
                    {t("openCount", { count: open })}
                  </Badge>
                ) : null}
              </>
            }
          >
            <DescriptionList
              columns={3}
              items={[
                ...(source
                  ? [{ term: t("fromFile"), description: t("fileVersion", { version: source.versionNo }) }]
                  : []),
                { term: t("sentAt"), description: <When at={proof.sentAt} /> },
                ...(proof.decidedAt
                  ? [
                      {
                        term: t("decidedAt"),
                        description: (
                          <span>
                            <When at={proof.decidedAt} />
                            {proof.decidedByName ? ` · ${proof.decidedByName}` : null}
                            {proof.decisionChannel ? ` · ${t(`channels.${proof.decisionChannel}`)}` : null}
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(proof.decisionComment
                  ? [{ term: t("decisionComment"), description: proof.decisionComment, wide: true }]
                  : []),
                ...(proof.onBehalfReason
                  ? [{ term: t("onBehalf"), description: proof.onBehalfReason, wide: true }]
                  : []),
                ...(proof.approvedFileSha256
                  ? [
                      {
                        term: t("locked"),
                        description: <span className="font-mono text-xs break-all">{proof.approvedFileSha256}</span>,
                        wide: true,
                      },
                    ]
                  : []),
                ...(proof.changeNote ? [{ term: t("note"), description: proof.changeNote, wide: true }] : []),
              ]}
            />
            <div className="mt-3 flex flex-col gap-1">
              <FileItem fileId={proof.proofFile.id} name={proof.proofFile.originalName} />
              {proof.dielineFileId ? <FileItem fileId={proof.dielineFileId} name={t("dielineFile")} /> : null}
            </div>
            {index === 0 || proof.annotations.length > 0 ? (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium">{t("annotations")}</h3>
                <Annotations proof={proof} />
              </div>
            ) : null}
          </Section>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------------- template */

/**
 * The dieline and the templates sent to the customer. The drawings are the order's own
 * (`admin.designs.listOrderDrawings`), newest first, each with its file and the size drawn.
 * CONTRACT-GAP admin.prepress — the order carries no dieline pattern or size of its own, so the
 * size shown is the latest drawing's. A delivery does not say who sent it.
 */
export function TemplateTab({
  deliveries,
  drawings,
  onSend,
  onDraw,
  drawing,
}: {
  deliveries: DielineDelivery[];
  drawings: DrawingJob[];
  onSend?: () => void;
  onDraw?: () => void;
  drawing: boolean;
}) {
  const t = useTranslations("prepress.detail.template");
  const size = drawings[0];
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("dieline")}
        actions={
          onDraw ? (
            <Button size="sm" variant="secondary" iconStart="ruler" loading={drawing} onClick={onDraw}>
              {t("draw")}
            </Button>
          ) : null
        }
      >
        <DescriptionList
          columns={3}
          items={[
            {
              term: t("size"),
              description: size
                ? t("sizeValue", { length: size.lengthMm, width: size.widthMm, height: size.heightMm })
                : t("noSize"),
            },
          ]}
        />
        {drawings.length > 0 ? (
          <ul className="divide-border mt-3 divide-y text-sm">
            {drawings.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2">
                  <span className="font-mono uppercase">{job.format}</span>
                  <StatusChip map={DRAWING_STATUS} value={job.status} />
                </span>
                {job.outputFileId ? (
                  <FileItem
                    fileId={job.outputFileId}
                    name={job.outputFile?.originalName ?? t("drawnFile", { format: job.format.toUpperCase() })}
                    sizeBytes={job.outputFile?.sizeBytes}
                  />
                ) : job.error ? (
                  <span className="text-danger text-xs">{job.error}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
      <Section
        title={t("deliveries")}
        actions={
          onSend ? (
            <Button size="sm" iconStart="send" onClick={onSend}>
              {t("send")}
            </Button>
          ) : null
        }
      >
        {deliveries.length === 0 ? (
          <p className="text-muted text-sm">{t("noDeliveries")}</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {deliveries.map((delivery) => (
              <li key={delivery.id} className="flex flex-col gap-1 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FileItem fileId={delivery.fileId} name={t("templateFile")} />
                  <span className="text-muted text-xs">
                    {t(`triggers.${delivery.trigger}`)} · <When at={delivery.sentAt} />
                  </span>
                </div>
                {delivery.note ? <p className="text-muted text-xs">{delivery.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------------------------- design */

/**
 * The hired design (D-071): its due dates, the free rounds used, what the next revision costs (the
 * API's figure), the brief and the rounds. A delivered round becomes an artwork version, so its
 * files are on the artwork tab.
 */
export function DesignTab({ service }: { service: DesignService | null }) {
  const t = useTranslations("prepress.detail.design");
  const format = useFormat();
  const sla = useSlaFormat();
  if (!service) return <EmptyState icon="palette" title={t("notFound")} />;
  const used = Math.min(service.revisionsUsed, service.freeRounds);
  const next = service.nextRevision;

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={
          <>
            {t("title")}
            <StatusChip map={DESIGN_SERVICE_STATUS} value={service.status} />
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-muted text-xs">{t("target")}</p>
            {service.targetDueAt ? (
              <SlaTimer dueAt={service.targetDueAt} format={sla} absolute={format.dateTime(service.targetDueAt)} />
            ) : (
              <p className="text-sm">{t("notStarted")}</p>
            )}
          </div>
          <div>
            <p className="text-muted text-xs">{t("max")}</p>
            {service.maxDueAt ? (
              <SlaTimer dueAt={service.maxDueAt} format={sla} absolute={format.dateTime(service.maxDueAt)} />
            ) : (
              <p className="text-sm">{t("notStarted")}</p>
            )}
          </div>
          <div>
            <p className="text-muted mb-1 text-xs">{t("freeRounds")}</p>
            <Meter
              label={t("freeRounds")}
              value={service.freeRounds ? Math.round((used / service.freeRounds) * 100) : 0}
              valueText={t("freeUsed", { used, free: service.freeRounds })}
              tone={used >= service.freeRounds ? "warning" : "primary"}
            />
            <p className="mt-1 text-sm font-medium">{t("freeUsed", { used, free: service.freeRounds })}</p>
          </div>
        </div>
        {next?.chargeable ? (
          <Callout
            tone="warning"
            className="mt-4"
            title={t("nextChargeable", { round: next.revisionNo, fee: format.thb(next.feeNet) })}
          >
            {t("nextChargeableBody")}
          </Callout>
        ) : null}
        <DescriptionList
          className="mt-4"
          columns={3}
          items={[
            { term: t("designer"), description: service.assignee?.displayName ?? t("noDesigner") },
            { term: t("fee"), description: format.thb(service.designFeeNet) },
            { term: t("rule"), description: t("ruleValue", { free: service.freeRounds }) },
            ...(service.closeReason ? [{ term: t("closeReason"), description: service.closeReason, wide: true }] : []),
          ]}
        />
      </Section>

      <Section title={t("brief")}>
        {service.brief ? (
          <>
            <DescriptionList
              columns={2}
              items={[
                { term: t("brandName"), description: service.brief.brandName },
                { term: t("brandCategory"), description: service.brief.brandCategory || "—" },
                { term: t("briefDescription"), description: service.brief.description, wide: true },
              ]}
            />
            {service.brief.attachmentFileIds.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1">
                {service.brief.attachmentFileIds.map((fileId, index) => (
                  <FileItem key={fileId} fileId={fileId} name={t("attachment", { number: index + 1 })} />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-muted text-sm">{t("noBrief")}</p>
        )}
      </Section>

      <Section title={t("rounds")}>
        {service.rounds.length === 0 ? (
          <p className="text-muted text-sm">{t("noRounds")}</p>
        ) : (
          <ol className="divide-border divide-y text-sm">
            {service.rounds.map((round) => (
              <li key={round.id} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t("round", { round: round.roundNo })}</span>
                  <StatusChip map={DESIGN_ROUND_STATUS} value={round.status} />
                  {round.chargeable ? (
                    <Badge tone="warning" size="sm" icon="coins">
                      {t("paidRound", { fee: format.thb(round.feeNet) })}
                    </Badge>
                  ) : (
                    <Badge size="sm">{t("freeRound")}</Badge>
                  )}
                </div>
                <p className="text-muted text-xs">
                  {t("requested")} <When at={round.requestedAt} />
                  {round.deliveredAt ? (
                    <>
                      {" · "}
                      {t("delivered")} <When at={round.deliveredAt} />
                    </>
                  ) : null}
                </p>
                {round.changeRequest ? <p>{round.changeRequest}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
