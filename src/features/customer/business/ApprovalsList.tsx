"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

type Approval = Schemas["CompanyApprovalDto"];

const TONE = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
  expired: "neutral",
} as const;

/**
 * Orders waiting for the company's approver (D-123), each an order group placed as
 * `pending_company_approval`. Approving restates the amount and releases the orders; rejecting
 * needs a reason the buyer reads (`store.companyApprovals.decide`).
 *
 * CONTRACT-GAP store.company-approvals — the published approval names the group, its amount, PO and
 * requester only: no lines, threshold or payment plan, and the decision carries no idempotency key.
 */
export function ApprovalsList({
  companyId,
  approvals,
  canApprove,
}: {
  companyId: string;
  approvals: Approval[];
  canApprove: boolean;
}) {
  const t = useTranslations("business.approvals");
  const format = useFormat();
  const router = useRouter();
  const [approving, setApproving] = useState<Approval | null>(null);
  const [rejecting, setRejecting] = useState<Approval | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(approval: Approval, outcome: "approve" | "reject") {
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/companies/{companyId}/approvals/{approvalId}/actions/{decision}", {
        params: { path: { companyId, approvalId: approval.id, decision: outcome } },
        body: outcome === "reject" ? { comment: reason.trim() } : {},
      });
      toast.success(
        outcome === "approve"
          ? t("approved", { request: approval.groupCode })
          : t("rejected", { request: approval.groupCode }),
      );
      setApproving(null);
      setRejecting(null);
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  if (approvals.length === 0) return <p className="text-muted">{t("empty")}</p>;

  return (
    <>
      <ul className="flex flex-col gap-4">
        {approvals.map((approval) => (
          <li key={approval.id}>
            <article
              aria-labelledby={`approval-${approval.id}`}
              className="border-border flex flex-col gap-3 rounded-xl border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id={`approval-${approval.id}`} className="font-semibold">
                    {t("title", { request: approval.groupCode, amount: format.thb(approval.amount) })}
                  </h3>
                  <p className="text-muted text-sm">
                    {t("metaShort", {
                      name: approval.requester.displayName,
                      date: format.dateTime(approval.requestedAt),
                    })}
                  </p>
                </div>
                <Badge tone={TONE[approval.status]}>{t(`status.${approval.status}`)}</Badge>
              </div>
              <p className="text-muted text-xs">{t("poOnly", { po: approval.poNumber ?? t("noPo") })}</p>
              {canApprove && approval.status === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setApproving(approval)}>
                    {t("approve")}
                    <span className="sr-only"> {approval.groupCode}</span>
                  </Button>
                  <Button variant="secondary" onClick={() => setRejecting(approval)}>
                    {t("reject")}
                    <span className="sr-only"> {approval.groupCode}</span>
                  </Button>
                </div>
              ) : null}
            </article>
          </li>
        ))}
      </ul>

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
        loading={busy}
        onConfirm={() => approving && void decide(approving, "approve")}
      />
      <Dialog
        open={Boolean(rejecting)}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={t("rejectTitle", { request: rejecting?.groupCode ?? "" })}
        closeLabel={t("cancel")}
        footer={
          <Button
            loading={busy}
            disabled={reason.trim().length < 3}
            onClick={() => rejecting && void decide(rejecting, "reject")}
          >
            {t("reject")}
          </Button>
        }
      >
        <Field label={t("reason")} hint={t("reasonHint")}>
          <Textarea rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </Dialog>
    </>
  );
}
