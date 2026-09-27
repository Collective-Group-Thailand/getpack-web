"use client";

import NextLink from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  DESIGN_ROUND_STATUS,
  DESIGN_SERVICE_STATUS,
  DRAWING_STATUS,
  JOB_STATUS,
  PREFLIGHT_STATUS,
  PROOF_STATUS,
  SUBMISSION_STATUS,
} from "@/domain/status";
import { DesignViewer, readDesignDocument } from "@/features/designer/components/DesignViewer";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
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

import { problemMessage, StatusChip, useCan, useSlaFormat } from "../console";
import { SubmissionDialogs } from "./PrepressActions";
import type { PrepressDetail, ProofAnnotation } from "./resources";

type FileRef = PrepressDetail["proofs"][number]["proofFile"];
type Submission = PrepressDetail["submissions"][number];
type Proof = PrepressDetail["proofs"][number];

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

function FileLink({ file }: { file: FileRef }) {
  const t = useTranslations("prepress.detail");
  const format = useFormat();
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <Icon name="paperclip" size={16} />
      {file.url ? (
        <a href={file.url} download={file.originalName} className="text-primary truncate hover:underline">
          {file.originalName}
        </a>
      ) : (
        <span className="truncate">{file.originalName}</span>
      )}
      <span className="text-muted text-xs whitespace-nowrap">{format.bytes(file.sizeBytes)}</span>
      {file.url ? <span className="sr-only">{t("download")}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------------------------ artwork */

function SubmissionCard({ detail, submission }: { detail: PrepressDetail; submission: Submission }) {
  const t = useTranslations("prepress.detail.artwork");
  const [open, setOpen] = useState<"accept" | "reject" | null>(null);
  const accept = submission.nextActions.find((action) => action.key === "submission.accept");
  const reject = submission.nextActions.find((action) => action.key === "submission.reject");
  const groups = (["block", "warn", "info"] as const)
    .map((severity) => ({ severity, findings: submission.findings.filter((finding) => finding.severity === severity) }))
    .filter((group) => group.findings.length > 0);

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
              <Button size="sm" variant="secondary" iconStart="undo" onClick={() => setOpen("reject")}>
                {t("reject")}
              </Button>
            ) : null}
            {accept ? (
              <Button
                size="sm"
                iconStart="check"
                disabled={Boolean(accept.disabledReason)}
                onClick={() => setOpen("accept")}
              >
                {t("accept")}
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      <p className="text-muted mb-3 text-xs">
        {t(`sources.${submission.source}`)}
        {submission.submittedBy ? ` · ${submission.submittedBy.displayName}` : null} ·{" "}
        <When at={submission.submittedAt} />
      </p>
      {accept?.disabledReason ? <Callout tone="danger" title={accept.disabledReason} className="mb-3" /> : null}

      <h3 className="mb-2 text-sm font-medium">{t("report")}</h3>
      {groups.length === 0 ? (
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
                      <span className="text-muted"> · {finding.message}</span>
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
          <li key={entry.file.id} className="flex items-center gap-2">
            <FileLink file={entry.file} />
            <Badge size="sm">{t(`roles.${entry.role}`)}</Badge>
          </li>
        ))}
      </ul>
      <SubmissionDialogs detail={detail} submission={submission} open={open} onClose={() => setOpen(null)} />
    </Section>
  );
}

function DesignDocumentCard({
  document,
  orderId,
}: {
  document: NonNullable<PrepressDetail["designDocument"]>;
  orderId: string;
}) {
  const t = useTranslations("prepress.detail.design");
  const canManage = useCan("prepress.manage");
  const [copy, setCopy] = useState<{ id: string; title: string } | null>(null);
  const read = readDesignDocument(document.document);

  const makeCopy = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/design-documents/{documentId}/actions/copy", {
        path: { documentId: document.id },
        body: { title: t("copyTitle", { title: document.title }) },
      }),
    onSuccess: (created) => {
      setCopy({ id: created.id, title: created.title });
      toast.success(t("copied", { title: created.title }));
    },
    onError: (error) => toast.error(problemMessage(error, t("copyFailed"))),
  });

  return (
    <Section
      title={
        <>
          {t("documentTitle")}
          <Badge size="sm" icon="eye">
            {t("readOnly")}
          </Badge>
        </>
      }
      actions={
        <>
          <Button asChild size="sm" variant="ghost" iconStart="eye">
            <NextLink href={`/designs/${document.id}?from=${encodeURIComponent(`/prepress/${orderId}`)}`}>
              {t("openInDesigner")}
            </NextLink>
          </Button>
          {canManage ? (
            <Button
              size="sm"
              variant="secondary"
              iconStart="copy"
              loading={makeCopy.isPending}
              onClick={() => makeCopy.mutate()}
            >
              {t("copy")}
            </Button>
          ) : null}
        </>
      }
    >
      <p className="text-muted mb-3 text-xs">
        {t("documentMeta", { title: document.title, version: document.versionNo, owner: document.owner.displayName })} ·{" "}
        <When at={document.updatedAt} />
      </p>
      {read ? (
        <div className="bg-surface-subtle aspect-[4/3] w-full rounded-md border p-4">
          <DesignViewer
            {...read}
            label={t("viewerLabel", { title: document.title })}
            idPrefix={`design-${document.id}`}
          />
        </div>
      ) : (
        <Callout tone="warning" title={t("unreadable")} />
      )}
      <p className="text-muted mt-2 text-xs">{t("previewNote")}</p>
      {copy ? (
        <Callout tone="success" title={t("copyReady", { title: copy.title })} className="mt-3">
          {t("copyNext")}
          <Button asChild size="sm" className="mt-2">
            <NextLink href={`/designs/${copy.id}?from=${encodeURIComponent(`/prepress/${orderId}`)}`}>
              {t("openCopy")}
            </NextLink>
          </Button>
        </Callout>
      ) : null}
    </Section>
  );
}

export function ArtworkTab({ detail }: { detail: PrepressDetail }) {
  const t = useTranslations("prepress.detail.artwork");
  return (
    <div className="flex flex-col gap-4">
      {detail.designDocument ? <DesignDocumentCard document={detail.designDocument} orderId={detail.orderId} /> : null}
      {detail.submissions.length === 0 ? (
        <EmptyState icon="upload" title={t("none")} description={t("noneBody")} />
      ) : (
        detail.submissions.map((submission) => (
          <SubmissionCard key={submission.id} detail={detail} submission={submission} />
        ))
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

/**
 * The customer's annotation threads on one proof: a page map of where each points (page-relative,
 * as the proof viewer records them) beside the threads, where prepress replies and resolves.
 */
function Annotations({ proof }: { proof: Proof }) {
  const t = useTranslations("prepress.detail.proofs");
  const canManage = useCan("prepress.manage");
  const queryClient = useQueryClient();
  const key = queryKeys.related("admin", "proof", proof.id, "annotations");
  const [active, setActive] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: key,
    queryFn: () =>
      browserRequests().call("GET /v1/admin/prepress/proofs/{proofId}/annotations", { path: { proofId: proof.id } }),
    staleTime: STALE_TIME.transactional,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "prepress") });
  };

  const reply = useMutation({
    mutationFn: (parentId: string) =>
      browserRequests().call("POST /v1/admin/prepress/proofs/{proofId}/annotations", {
        path: { proofId: proof.id },
        body: { parentId, comment: (drafts[parentId] ?? "").trim() },
      }),
    onSuccess: (_, parentId) => {
      setDrafts((current) => ({ ...current, [parentId]: "" }));
      toast.success(t("replied"));
      refresh();
    },
    onError: (error) => toast.error(problemMessage(error, t("replyFailed"))),
  });
  const resolve = useMutation({
    mutationFn: (annotationId: string) =>
      browserRequests().call("POST /v1/admin/prepress/proofs/{proofId}/annotations/{annotationId}/actions/resolve", {
        path: { proofId: proof.id, annotationId },
      }),
    onSuccess: () => {
      toast.success(t("resolved"));
      refresh();
    },
    onError: (error) => toast.error(problemMessage(error, t("resolveFailed"))),
  });

  const all = list.data?.data ?? [];
  const threads = all.filter((item) => !item.parentId);
  if (list.isError) return <p className="text-danger text-sm">{problemMessage(list.error, t("loadFailed"))}</p>;
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
                  <Badge tone="success" size="sm" icon="check">
                    {t("isResolved")}
                  </Badge>
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
              {canManage && !thread.resolvedAt ? (
                <form
                  className="mt-3 flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if ((drafts[thread.id] ?? "").trim()) reply.mutate(thread.id);
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
                      loading={reply.isPending && reply.variables === thread.id}
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

export function ProofsTab({ detail, onUpload }: { detail: PrepressDetail; onUpload?: () => void }) {
  const t = useTranslations("prepress.detail.proofs");
  if (detail.proofs.length === 0) {
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
            {t("uploadNext", { version: detail.proofs[0]!.versionNo + 1 })}
          </Button>
        </div>
      ) : null}
      {detail.proofs.map((proof, index) => (
        <Section
          key={proof.id}
          title={
            <>
              {t("version", { version: proof.versionNo })}
              <StatusChip map={PROOF_STATUS} value={proof.status} />
              {proof.annotations.open > 0 ? (
                <Badge tone="danger" size="sm" icon="chat">
                  {t("openCount", { count: proof.annotations.open })}
                </Badge>
              ) : null}
            </>
          }
        >
          <DescriptionList
            columns={3}
            items={[
              { term: t("fromFile"), description: t("fileVersion", { version: proof.submissionVersionNo }) },
              { term: t("preparedBy"), description: proof.preparedBy.displayName },
              { term: t("sentAt"), description: <When at={proof.sentAt} /> },
              ...(proof.decidedAt
                ? [
                    {
                      term: t("decidedAt"),
                      description: (
                        <span>
                          <When at={proof.decidedAt} />
                          {proof.decidedBy ? ` · ${proof.decidedBy.displayName}` : null}
                          {proof.decisionChannel ? ` · ${t(`channels.${proof.decisionChannel}`)}` : null}
                        </span>
                      ),
                    },
                  ]
                : []),
              ...(proof.onBehalfReason ? [{ term: t("onBehalf"), description: proof.onBehalfReason, wide: true }] : []),
              ...(proof.approvedFileSha256
                ? [
                    {
                      term: t("locked"),
                      description: <span className="font-mono text-xs break-all">{proof.approvedFileSha256}</span>,
                      wide: true,
                    },
                  ]
                : []),
              ...(proof.note ? [{ term: t("note"), description: proof.note, wide: true }] : []),
            ]}
          />
          <div className="mt-3 flex flex-col gap-1">
            <FileLink file={proof.proofFile} />
            {proof.dielineFile ? <FileLink file={proof.dielineFile} /> : null}
          </div>
          {index === 0 || proof.annotations.open + proof.annotations.resolved > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">{t("annotations")}</h3>
              <Annotations proof={proof} />
            </div>
          ) : null}
        </Section>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------------- template */

export function TemplateTab({
  detail,
  onSend,
  onDraw,
  drawing,
}: {
  detail: PrepressDetail;
  onSend?: () => void;
  onDraw?: () => void;
  drawing: boolean;
}) {
  const t = useTranslations("prepress.detail.template");
  const size = detail.dieline;
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
            { term: t("pattern"), description: size.patternCode ?? t("noPattern") },
            {
              term: t("size"),
              description:
                size.lengthMm && size.widthMm && size.heightMm
                  ? t("sizeValue", { length: size.lengthMm, width: size.widthMm, height: size.heightMm })
                  : t("noSize"),
            },
          ]}
        />
        {detail.drawingJobs.length > 0 ? (
          <ul className="divide-border mt-3 divide-y text-sm">
            {detail.drawingJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2">
                  <span className="font-mono uppercase">{job.format}</span>
                  <StatusChip map={DRAWING_STATUS} value={job.status} />
                </span>
                {job.outputFile ? (
                  <FileLink file={job.outputFile} />
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
        {detail.templateDeliveries.length === 0 ? (
          <p className="text-muted text-sm">{t("noDeliveries")}</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {detail.templateDeliveries.map((delivery) => (
              <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <FileLink file={delivery.file} />
                <span className="text-muted text-xs">
                  {t(`triggers.${delivery.trigger}`)}
                  {delivery.sentBy ? ` · ${delivery.sentBy.displayName}` : null} · <When at={delivery.sentAt} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------------------------- design */

export function DesignTab({ detail }: { detail: PrepressDetail }) {
  const t = useTranslations("prepress.detail.design");
  const format = useFormat();
  const sla = useSlaFormat();
  const service = detail.designService;
  if (!service) return <EmptyState icon="palette" title={t("none")} />;
  const used = Math.min(service.rounds.filter((round) => !round.chargeable).length, service.freeRounds);

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
            <SlaTimer dueAt={service.targetDueAt} format={sla} absolute={format.dateTime(service.targetDueAt)} />
          </div>
          <div>
            <p className="text-muted text-xs">{t("max")}</p>
            <SlaTimer dueAt={service.maxDueAt} format={sla} absolute={format.dateTime(service.maxDueAt)} />
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
        {service.nextRound.chargeable ? (
          <Callout
            tone="warning"
            className="mt-4"
            title={t("nextChargeable", {
              round: service.nextRound.roundNo,
              fee: format.thb(service.nextRound.feeAmount),
            })}
          >
            {t("nextChargeableBody")}
          </Callout>
        ) : null}
        <DescriptionList
          className="mt-4"
          columns={3}
          items={[
            { term: t("designer"), description: service.designer?.displayName ?? t("noDesigner") },
            { term: t("fee"), description: format.thb(service.designFeeNet) },
            { term: t("rule"), description: t("ruleValue", { free: service.freeRounds }) },
          ]}
        />
      </Section>

      <Section title={t("brief")}>
        <DescriptionList
          columns={2}
          items={service.brief.map((item) => ({ term: item.label, description: item.value }))}
        />
        {service.briefFiles.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1">
            {service.briefFiles.map((file) => (
              <FileLink key={file.id} file={file} />
            ))}
          </div>
        ) : null}
      </Section>

      <Section title={t("rounds")}>
        {service.rounds.length === 0 ? (
          <p className="text-muted text-sm">{t("noRounds")}</p>
        ) : (
          <ol className="divide-border divide-y text-sm">
            {service.rounds.map((round) => (
              <li key={round.roundNo} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t("round", { round: round.roundNo })}</span>
                  <StatusChip map={DESIGN_ROUND_STATUS} value={round.status} />
                  {round.chargeable ? (
                    <Badge tone="warning" size="sm" icon="coins">
                      {t("paidRound", { fee: format.thb(round.feeAmount) })}
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
                {round.note ? <p>{round.note}</p> : null}
                {round.files.map((file) => (
                  <FileLink key={file.id} file={file} />
                ))}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------------------------- mockup */

export function MockupTab({ detail }: { detail: PrepressDetail }) {
  const t = useTranslations("prepress.detail.mockup");
  const format = useFormat();
  const job = detail.mockup;
  if (!job) return <EmptyState icon="package" title={t("none")} description={t("noneBody")} />;
  return (
    <Section
      title={
        <>
          {t("title")}
          <StatusChip map={JOB_STATUS} value={job.status} />
        </>
      }
    >
      <DescriptionList
        columns={3}
        items={[
          { term: t("jobNo"), description: <span className="font-mono">{job.jobNo}</span> },
          { term: t("option"), description: t(`options.${job.option}`) },
          { term: t("factory"), description: job.factory?.name ?? t("noFactory") },
          { term: t("promised"), description: job.promisedAt ? format.dateTime(job.promisedAt) : t("noPromise") },
        ]}
      />
      <p className="text-muted mt-3 text-xs">{t("note")}</p>
    </Section>
  );
}
