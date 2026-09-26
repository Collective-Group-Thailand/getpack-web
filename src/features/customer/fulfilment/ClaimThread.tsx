"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { CLAIM_STATUS } from "@/domain/status";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

type Claim = ResponseOf<Requests, "GET /v1/store/orders/{orderId}/claims/{claimId}">;

/**
 * One claim as the customer follows it (F3 3.6): what they reported with the evidence, where it
 * stands and by when the team answers, the thread with the team, and the outcome in words.
 */
export function ClaimThread({ initial }: { initial: Claim }) {
  const t = useTranslations("fulfilment.claimView");
  const types = useTranslations("myOrders.claimTypes");
  const resolutions = useTranslations("fulfilment.claim.resolutions");
  const format = useFormat();
  const [claim, setClaim] = useState(initial);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      setClaim(
        await browserRequests().call("POST /v1/store/orders/{orderId}/claims/{claimId}/messages", {
          path: { orderId: claim.order.id, claimId: claim.id },
          body: { body: reply.trim() },
        }),
      );
      setReply("");
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  const photos = [
    ...claim.evidence.productPhotos.map((photo) => ({ photo, kind: t("productPhoto") })),
    ...claim.evidence.cartonPhotos.map((photo) => ({ photo, kind: t("cartonPhoto") })),
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip map={CLAIM_STATUS} value={claim.status} size="md" />
        {claim.respondBy && !claim.outcome ? (
          <span className="text-muted text-sm">{t("respondBy", { date: format.dateTime(claim.respondBy) })}</span>
        ) : null}
      </div>

      {claim.status === "need_info" ? (
        <Callout tone="warning" title={t("needInfoTitle")}>
          {t("needInfo")}
        </Callout>
      ) : null}
      {claim.outcome ? (
        <Callout
          tone={claim.outcome.decision === "approved" ? "success" : "neutral"}
          title={t(`outcome.${claim.outcome.decision}`)}
        >
          <p>{claim.outcome.note}</p>
          {claim.outcome.resolution ? (
            <p className="mt-1">
              {claim.outcome.amount
                ? t("resolutionAmount", {
                    resolution: resolutions(claim.outcome.resolution),
                    amount: format.thb(claim.outcome.amount),
                  })
                : resolutions(claim.outcome.resolution)}
            </p>
          ) : null}
        </Callout>
      ) : null}

      <section aria-labelledby="claim-report">
        <h2 id="claim-report" className="text-lg font-semibold">
          {t("report")}
        </h2>
        <DescriptionList
          className="mt-3"
          items={[
            { term: t("type"), description: types(claim.type) },
            ...(claim.shipment ? [{ term: t("shipment"), description: claim.shipment.shipmentNo }] : []),
            ...(claim.affectedQuantity
              ? [{ term: t("quantity"), description: format.number(claim.affectedQuantity) }]
              : []),
            { term: t("wanted"), description: resolutions(claim.requestedResolution) },
            { term: t("submitted"), description: format.dateTime(claim.submittedAt) },
            ...(claim.automatic ? [{ term: t("origin"), description: t("automatic") }] : []),
          ]}
        />
        <p className="mt-3 text-sm whitespace-pre-line">{claim.description}</p>
        {photos.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-3" aria-label={t("evidence")}>
            {photos.map(({ photo, kind }) =>
              photo.thumbnailUrl || photo.url ? (
                <li key={photo.id} className="flex flex-col items-center gap-1 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element -- evidence photo from the API */}
                  <img
                    src={photo.thumbnailUrl ?? photo.url!}
                    alt={t("photoAlt", { kind, name: photo.originalName })}
                    className="size-24 rounded object-cover"
                  />
                  <span className="text-muted">{kind}</span>
                </li>
              ) : null,
            )}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="claim-thread">
        <h2 id="claim-thread" className="text-lg font-semibold">
          {t("thread")}
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {claim.messages.map((message) => (
            <li
              key={message.id}
              className={cn(
                "max-w-xl rounded-lg p-3 text-sm",
                message.authorKind === "customer" ? "bg-primary-subtle self-end" : "bg-surface-subtle self-start",
              )}
            >
              <p className="text-muted text-xs">
                {t("by", { name: message.authorName, date: format.dateTime(message.at) })}
              </p>
              <p className="whitespace-pre-line">{message.body}</p>
            </li>
          ))}
        </ol>
        {claim.canReply ? (
          <form onSubmit={(event) => void send(event)} className="mt-4 flex max-w-xl flex-col gap-2">
            <Field label={t("reply")}>
              <Textarea rows={3} maxLength={2000} value={reply} onChange={(event) => setReply(event.target.value)} />
            </Field>
            <Button type="submit" className="self-start" loading={busy} disabled={!reply.trim()}>
              {t("send")}
            </Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
