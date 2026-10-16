"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { NextStep } from "@/features/customer/shell/NextStep";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

type Approval = Schemas["CompanyApprovalDto"];

const TONE = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
  expired: "neutral",
} as const;

/** The shortest note a returned order may carry: the buyer has to know what to change. */
const MIN_RETURN_NOTE = 3;

/**
 * Orders waiting for the company's approver (D-123) and what was decided, to the "CompanyApprovals"
 * board (round 2, B2). A waiting request is a card: the group, who asked and when, its amount
 * against the buyer's limit, branch and PO, and one note with **อนุมัติ** (confirmed, the note goes
 * with it) or **ส่งกลับให้แก้ไข** (the note is required — the buyer reads it). A decided one is a
 * line in the history. `?request=` from a notification opens on that request
 * (`store.companyApprovals.decide`, one idempotency key per decision).
 */
export function ApprovalsList({
  companyId,
  approvals,
  canApprove,
  focus = null,
}: {
  companyId: string;
  approvals: Approval[];
  canApprove: boolean;
  /** The request a notification pointed at. */
  focus?: string | null;
}) {
  const t = useTranslations("business.approvals");
  const format = useFormat();
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [returnError, setReturnError] = useState<string | null>(null);
  const [approving, setApproving] = useState<Approval | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const keys = useRef<Record<string, string>>({});
  const focused = useRef<HTMLElement>(null);

  useEffect(() => {
    focused.current?.scrollIntoView({ block: "center" });
    focused.current?.focus();
  }, []);

  async function decide(approval: Approval, outcome: "approve" | "reject") {
    const note = (notes[approval.id] ?? "").trim();
    if (outcome === "reject" && note.length < MIN_RETURN_NOTE) {
      setReturnError(approval.id);
      return;
    }
    setReturnError(null);
    setBusy(`${approval.id}:${outcome}`);
    const intent = `${approval.id}:${outcome}`;
    keys.current[intent] ??= newIdempotencyKey();
    try {
      await browserApi().POST("/v1/store/companies/{companyId}/approvals/{approvalId}/actions/{decision}", {
        params: {
          path: { companyId, approvalId: approval.id, decision: outcome },
          header: { "Idempotency-Key": keys.current[intent] },
        },
        body: note ? { comment: note } : {},
      });
      delete keys.current[intent];
      toast.success(
        outcome === "approve"
          ? t("approved", { request: approval.groupCode })
          : t("returned", { request: approval.groupCode }),
      );
      setApproving(null);
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  }

  if (approvals.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        icon="check"
        title={t("empty")}
        description={t("emptyBody")}
        action={<NextStep to="orders" />}
      />
    );
  }

  const waiting = approvals.filter((approval) => approval.status === "pending");
  const history = approvals.filter((approval) => approval.status !== "pending");

  return (
    <>
      {waiting.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {waiting.map((approval) => {
            const isFocus = approval.id === focus;
            const noteId = `approval-note-${approval.id}`;
            return (
              <li key={approval.id}>
                <article
                  ref={isFocus ? focused : undefined}
                  tabIndex={isFocus ? -1 : undefined}
                  aria-labelledby={`approval-${approval.id}`}
                  className={cn(
                    "border-border bg-surface rounded-card border-s-warning overflow-hidden border border-s-4 outline-none",
                    isFocus && "ring-primary ring-2",
                  )}
                >
                  <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:p-6">
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="warning">{canApprove ? t("waitingYou") : t("status.pending")}</Badge>
                        <span className="text-muted text-sm">
                          {t("requestedAt", { date: format.dateTime(approval.requestedAt) })}
                          {approval.expiresAt ? ` · ${t("decideBy", { date: format.date(approval.expiresAt) })}` : ""}
                        </span>
                      </div>
                      <h3 id={`approval-${approval.id}`} className="text-lg font-semibold">
                        {t("cardTitle", { request: approval.groupCode, count: approval.ordersCount })}
                      </h3>
                      <p className="text-muted text-sm">
                        {t("requestedBy", { name: approval.requester.displayName })}
                        {approval.branchName ? ` · ${t("branch", { name: approval.branchName })}` : ""}
                      </p>
                      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-muted text-xs">{t("poLabel")}</dt>
                          <dd>{approval.poNumber ?? t("noPo")}</dd>
                        </div>
                        <div>
                          <dt className="text-muted text-xs">{t("ordersLabel")}</dt>
                          <dd>{t("orders", { count: approval.ordersCount })}</dd>
                        </div>
                        {approval.threshold ? (
                          <div>
                            <dt className="text-muted text-xs">{t("limitLabel")}</dt>
                            <dd>{format.thb(approval.threshold)}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    <div className="bg-surface border-border flex flex-col gap-3 rounded-2xl border p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{t("total")}</span>
                        <span className="text-xl font-bold tabular-nums">{format.thb(approval.amount)}</span>
                      </div>
                      {approval.threshold ? (
                        <p className="text-warning-subtle-fg text-sm">
                          {t("aboveLimit", { amount: format.thb(approval.threshold) })}
                        </p>
                      ) : null}
                      {canApprove ? (
                        <>
                          <Field
                            label={t("note")}
                            hint={t("noteHint")}
                            error={returnError === approval.id ? t("noteRequired") : undefined}
                          >
                            <Textarea
                              id={noteId}
                              rows={2}
                              maxLength={500}
                              placeholder={t("notePlaceholder")}
                              value={notes[approval.id] ?? ""}
                              onChange={(event) =>
                                setNotes((current) => ({ ...current, [approval.id]: event.target.value }))
                              }
                            />
                          </Field>
                          <div className="grid gap-2">
                            <Button disabled={Boolean(busy)} onClick={() => setApproving(approval)}>
                              {t("approve")}
                              <span className="sr-only"> {approval.groupCode}</span>
                            </Button>
                            <Button
                              variant="destructive"
                              loading={busy === `${approval.id}:reject`}
                              disabled={Boolean(busy)}
                              onClick={() => void decide(approval, "reject")}
                            >
                              {t("return")}
                              <span className="sr-only"> {approval.groupCode}</span>
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted text-sm">{t("buyerWaiting")}</p>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}

      {history.length > 0 ? (
        <section aria-labelledby="approvals-history" className="flex flex-col gap-3">
          <h2 id="approvals-history" className="font-semibold">
            {t("history")}
          </h2>
          <ul className="border-border bg-surface divide-border rounded-card divide-y border">
            {history.map((approval) => (
              <li key={approval.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {approval.groupCode} · {format.thb(approval.amount)}
                  </p>
                  <p className="text-muted text-sm">
                    {[
                      approval.requester.displayName,
                      t("orders", { count: approval.ordersCount }),
                      approval.decidedAt
                        ? t("decidedBy", {
                            name: approval.decidedBy?.displayName ?? "",
                            date: format.date(approval.decidedAt),
                          })
                        : null,
                      approval.decisionComment ? `“${approval.decisionComment}”` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Badge tone={TONE[approval.status]}>{t(`status.${approval.status}`)}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AlertDialog
        open={Boolean(approving)}
        onOpenChange={(open) => !open && setApproving(null)}
        title={t("approveTitle", { request: approving?.groupCode ?? "" })}
        description={
          approving
            ? t("approveBody", { amount: format.thb(approving.amount), name: approving.requester.displayName })
            : ""
        }
        confirmLabel={t("approve")}
        cancelLabel={t("cancel")}
        loading={Boolean(approving && busy === `${approving.id}:approve`)}
        onConfirm={() => approving && void decide(approving, "approve")}
      />
    </>
  );
}
