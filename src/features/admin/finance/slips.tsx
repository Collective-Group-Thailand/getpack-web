"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { moneyText } from "@/domain/money";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Sheet } from "@/ui/components/Sheet";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { problemMessage } from "../console/QueryError";
import { ResourceList } from "../console/ResourceList";
import type { InitialPage } from "../console/resource";
import { useSlaFormat } from "../console/useSlaFormat";
import { slipsList, type SlipItem } from "./resources";
import { fieldErrorsOf } from "./shared";

/** What the finance slip queue invalidates once a slip is decided: the payment, its TR, its journal. */
export function invalidateMoney(queryClient: ReturnType<typeof useQueryClient>) {
  for (const resource of [
    "slip",
    "payment",
    "customer-document",
    "journal",
    "receivable",
    "dashboard",
    "order",
    "refund",
  ])
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
}

/**
 * Slips the automatic check could not pass (D-061): earliest SLA first, 4 business hours each
 * (the API does the business-hour maths). The declared and expected amounts sit side by side
 * because a mismatch is the commonest reason a slip is here.
 */
export function SlipsQueue({ initial }: { initial: InitialPage<SlipItem> | null }) {
  const t = useTranslations("finance.slips");
  const tFinance = useTranslations("finance.common");
  const format = useFormat();
  const sla = useSlaFormat();
  const [open, setOpen] = useState<SlipItem | null>(null);

  const columns: DataTableColumn<SlipItem>[] = [
    {
      id: "groupCode",
      header: t("columns.group"),
      cell: (row) => (
        <div>
          <Link
            href={`/finance/payments/${row.paymentId}`}
            className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
          >
            {row.groupCode ?? t("review.noGroup")}
          </Link>
          <p className="text-muted text-xs">{tFinance(`checks.${checkKey(row)}`)}</p>
        </div>
      ),
    },
    { id: "expected", header: t("columns.expected"), numeric: true, cell: (row) => format.thb(row.expectedAmount) },
    {
      id: "declared",
      header: t("columns.declared"),
      numeric: true,
      cell: (row) =>
        row.declaredAmount === row.expectedAmount ? (
          format.thb(row.declaredAmount)
        ) : (
          <span className="text-danger">
            {format.thb(row.declaredAmount)}
            <span className="block text-xs">{t("differs")}</span>
          </span>
        ),
    },
    {
      id: "transferredAt",
      header: t("columns.transferredAt"),
      cell: (row) => <When at={row.declaredTransferredAt} absoluteOnly />,
    },
    {
      id: "slaDueAt",
      header: t("columns.sla"),
      sortable: true,
      cell: (row) => <SlaTimer dueAt={row.slaDueAt} format={sla} absolute={format.dateTime(row.slaDueAt)} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setOpen(row)}>
          {t("reviewAction")}
        </Button>
      ),
    },
  ];

  return (
    <>
      <ResourceList
        resource={slipsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        rowTone={(row) => (row.overdue ? "danger" : undefined)}
        empty={{ title: t("empty"), description: t("emptyBody") }}
      />
      {open ? <SlipReview slip={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

type Decision = "approve" | "reject";

/**
 * What the automatic check found, in words that match the figures beside it (round 2, B11). The
 * API reports one `mismatch` for any field that differs; when the declared amount *is* the amount
 * due (the same decimal string — compared, never calculated), the difference is elsewhere — the
 * time or the receiving account — and saying "the amount does not match" sent Finance looking at
 * two equal numbers.
 */
function checkKey(slip: { lastCheck: SlipItem["lastCheck"]; declaredAmount: string; expectedAmount: string }): string {
  if (slip.lastCheck === "mismatch" && slip.declaredAmount === slip.expectedAmount) return "mismatchOther";
  return slip.lastCheck ?? "none";
}

/**
 * One slip beside what it should pay (D-061). Approving needs the bank's transaction reference —
 * the API refuses one already used, which is how a duplicate slip is caught — and is confirmed by
 * retyping the group code, since it pays the instalment and issues the tax invoice / receipt.
 */
export function SlipReview({
  slip,
  onClose,
  initialDecision = "approve",
}: {
  slip: SlipItem;
  onClose: () => void;
  /** The order screen opens it from "approve" or "reject" (`../orders/OrderActions.tsx`). */
  initialDecision?: Decision;
}) {
  const t = useTranslations("finance.slips.review");
  const tFinance = useTranslations("finance.common");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canVerify = useCan("payments.verify_slip");
  const [decision, setDecision] = useState<Decision>(initialDecision);
  const [bankTransRef, setBankTransRef] = useState("");
  const [received, setReceived] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [broken, setBroken] = useState(false);

  // The slip image is the slip's own file (`SlipQueueItemDto.fileId`), read through the generic
  // signed download (`admin.files.download`, five minutes; each download is audited, D-061).
  const fileId = slip.fileId;
  const image = useQuery({
    queryKey: queryKeys.related("admin", "slip", slip.id, "file"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/files/{fileId}/download", {
          params: { path: { fileId: fileId! } },
        })
      ).data!,
    enabled: Boolean(fileId),
    staleTime: 4 * 60_000,
  });
  // Never part of a UUID on screen: a slip without its group reads "สลิป" (round 1, raw ids).
  const code = slip.groupCode ?? t("noGroup");

  function check(): boolean {
    const next: Record<string, string> = {};
    if (decision === "approve" && !bankTransRef.trim()) next.bankTransRef = t("needReference");
    if (decision === "approve" && received.trim() && !moneyText(received)) next.receivedAmount = t("badAmount");
    if (decision === "reject" && note.trim().length < 3) next.note = t("needNote");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function send(idempotencyKey: string) {
    try {
      await adminBrowserApis().contract.POST("/v1/admin/slips/{slipId}/actions/review", {
        params: { path: { slipId: slip.id }, header: { "Idempotency-Key": idempotencyKey } },
        body:
          decision === "approve"
            ? {
                approve: true,
                bankTransRef: bankTransRef.trim(),
                ...(received.trim() ? { receivedAmount: moneyText(received)! } : {}),
                ...(note.trim() ? { note: note.trim() } : {}),
              }
            : { approve: false, note: note.trim() },
      });
      invalidateMoney(queryClient);
      toast.success(decision === "approve" ? t("approved", { code }) : t("rejected", { code }));
      onClose();
    } catch (error) {
      setErrors(fieldErrorsOf(error));
      toast.error(problemMessage(error, t("failed")));
      throw error;
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title", { code })}
      description={t("description")}
      closeLabel={tCommon("actions.close")}
      footer={
        canVerify ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {tCommon("actions.cancel")}
            </Button>
            <Button
              variant={decision === "approve" ? "primary" : "destructive"}
              onClick={() => (check() ? setConfirming(true) : undefined)}
            >
              {decision === "approve" ? t("approve") : t("reject")}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-5">
        {slip.overdue ? <Callout tone="danger" title={t("overdue")} /> : null}
        <DescriptionList
          columns={2}
          items={[
            {
              term: t("expected"),
              description: <span className="tabular-nums">{format.thb(slip.expectedAmount)}</span>,
            },
            {
              term: t("declared"),
              description: (
                <span
                  className={slip.declaredAmount === slip.expectedAmount ? "tabular-nums" : "text-danger tabular-nums"}
                >
                  {format.thb(slip.declaredAmount)}
                </span>
              ),
            },
            { term: t("transferredAt"), description: <When at={slip.declaredTransferredAt} absoluteOnly /> },
            { term: t("check"), description: tFinance(`checks.${checkKey(slip)}`) },
            {
              term: t("sla"),
              description: slip.slaDueAt ? <When at={slip.slaDueAt} absoluteOnly /> : "—",
            },
            {
              term: t("payment"),
              description: (
                <Link href={`/finance/payments/${slip.paymentId}`} className="text-primary hover:underline">
                  {t("openPayment")}
                </Link>
              ),
            },
          ]}
        />

        <figure className="border-border bg-surface-subtle flex flex-col items-center gap-2 rounded-md border p-3">
          {fileId && image.isPending ? (
            <Skeleton className="h-80 w-52" />
          ) : image.data?.url && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL, not an optimisable asset
            <img
              src={image.data.url}
              alt={t("imageAlt", { code })}
              className="max-h-80 w-auto rounded"
              onError={() => setBroken(true)}
            />
          ) : (
            // A slip that is a PDF, or an image the browser cannot draw, is a placeholder with the
            // file one click away — never a broken image showing its alt text (round 2, B11).
            <div className="text-muted flex h-48 w-full flex-col items-center justify-center gap-2 text-sm">
              <Icon name="receipt" size={32} aria-hidden="true" />
              <p>{image.data?.url ? t("imageUnavailable") : t("noImage")}</p>
            </div>
          )}
          {image.data?.url ? (
            <a
              href={image.data.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex min-h-10 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            >
              <Icon name="external" size={16} aria-hidden="true" />
              {t("openFile")}
            </a>
          ) : null}
          {/* CONTRACT-GAP admin.slip-file — the slip carries its file id only, so the file's name is not shown. */}
        </figure>

        {canVerify ? (
          <div className="flex flex-col gap-4">
            <SegmentedControl<Decision>
              label={t("decision")}
              value={decision}
              onValueChange={(value) => {
                setDecision(value);
                setErrors({});
              }}
              options={[
                { value: "approve", label: t("approve"), icon: "check" },
                { value: "reject", label: t("reject"), icon: "ban" },
              ]}
            />
            {decision === "approve" ? (
              <>
                <Field
                  label={t("bankTransRef")}
                  hint={t("bankTransRefHint")}
                  required
                  requiredLabel={tCommon("state.required")}
                  error={errors.bankTransRef}
                >
                  <Input
                    value={bankTransRef}
                    onChange={(event) => setBankTransRef(event.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Field label={t("receivedAmount")} hint={t("receivedAmountHint")} error={errors.receivedAmount}>
                  <Input inputMode="decimal" value={received} onChange={(event) => setReceived(event.target.value)} />
                </Field>
              </>
            ) : null}
            <Field
              label={decision === "approve" ? t("note") : t("rejectNote")}
              required={decision === "reject"}
              requiredLabel={tCommon("state.required")}
              error={errors.note}
            >
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            </Field>
          </div>
        ) : (
          <Callout tone="info" title={t("readOnly")} />
        )}
      </div>

      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={decision === "approve" ? t("confirmApproveTitle") : t("confirmRejectTitle")}
        description={
          decision === "approve"
            ? t("confirmApproveBody", { code, amount: format.thb(slip.expectedAmount), reference: bankTransRef.trim() })
            : t("confirmRejectBody", { code })
        }
        confirmLabel={decision === "approve" ? t("approve") : t("reject")}
        tone={decision === "approve" ? "primary" : "destructive"}
        confirmationPhrase={decision === "approve" ? code : undefined}
        onConfirm={({ idempotencyKey }) => send(idempotencyKey)}
      />
    </Sheet>
  );
}
