"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link, useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

type Approval = ResponseOf<Requests, "GET /v1/store/me/company/approvals">["data"][number];

const TONE = { pending: "warning", approved: "success", rejected: "danger", expired: "neutral" } as const;
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Orders waiting for the company's approver (D-123). Approving restates the amount and places
 * the orders as they were checked out; rejecting needs a reason the buyer reads.
 */
export function ApprovalsList({ approvals, canApprove }: { approvals: Approval[]; canApprove: boolean }) {
  const t = useTranslations("business.approvals");
  const format = useFormat();
  const router = useRouter();
  const [approving, setApproving] = useState<Approval | null>(null);
  const [rejecting, setRejecting] = useState<Approval | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());

  async function decide(approval: Approval, outcome: "approve" | "reject") {
    setBusy(true);
    try {
      if (outcome === "approve")
        await browserRequests().call("POST /v1/store/me/company/approvals/{approvalId}/actions/approve", {
          path: { approvalId: approval.id },
          idempotencyKey: key.current,
        });
      else
        await browserRequests().call("POST /v1/store/me/company/approvals/{approvalId}/actions/reject", {
          path: { approvalId: approval.id },
          body: { reason: reason.trim() },
        });
      key.current = newKey();
      toast.success(
        outcome === "approve"
          ? t("approved", { request: approval.requestNo })
          : t("rejected", { request: approval.requestNo }),
      );
      setApproving(null);
      setRejecting(null);
      setReason("");
      router.refresh();
    } catch (error) {
      key.current = newKey();
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
                    {t("title", { request: approval.requestNo, amount: format.thb(approval.grossAmount) })}
                  </h3>
                  <p className="text-muted text-sm">
                    {t("meta", {
                      name: approval.requestedBy.displayName,
                      date: format.dateTime(approval.requestedAt),
                      threshold: format.thb(approval.threshold),
                    })}
                  </p>
                </div>
                <Badge tone={TONE[approval.status]}>{t(`status.${approval.status}`)}</Badge>
              </div>
              <ul className="text-sm">
                {approval.items.map((item, at) => (
                  <li key={`${item.name}-${at}`} className="flex justify-between gap-3">
                    <span>
                      {t("item", { name: item.name, quantity: format.number(item.quantity), unit: item.unit })}
                    </span>
                    <span className="tabular-nums">{format.thb(item.grossAmount)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted text-xs">
                {t("details", { po: approval.poNumber ?? t("noPo"), schedule: approval.scheduleLabel })}
              </p>
              {approval.reason ? <p className="text-sm">{t("reasonShown", { reason: approval.reason })}</p> : null}
              {approval.orders.length > 0 ? (
                <p className="flex flex-wrap gap-2 text-sm">
                  {approval.orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/account/orders/${order.id}`}
                      className="text-primary underline underline-offset-4"
                    >
                      {order.orderCode}
                    </Link>
                  ))}
                </p>
              ) : null}
              {canApprove && approval.status === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setApproving(approval)}>
                    {t("approve")}
                    <span className="sr-only"> {approval.requestNo}</span>
                  </Button>
                  <Button variant="secondary" onClick={() => setRejecting(approval)}>
                    {t("reject")}
                    <span className="sr-only"> {approval.requestNo}</span>
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
        title={t("approveTitle", { request: approving?.requestNo ?? "" })}
        description={
          approving
            ? t("approveBody", { amount: format.thb(approving.grossAmount), name: approving.requestedBy.displayName })
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
        title={t("rejectTitle", { request: rejecting?.requestNo ?? "" })}
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
