"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { CLAIM_STATUS } from "@/domain/status";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

type Claim = Schemas["StoreClaimDto"];

/** What a claim's resolution did that the customer is told of — not how Packio recovers it (D-083). */
const CUSTOMER_ACTIONS = new Set<Schemas["ClaimAction"]>(["reproduction_job", "refund", "credit_note", "store_credit"]);
const DECIDED = new Set<Claim["status"]>(["approved", "rejected", "resolved", "closed"]);

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * One claim as the customer follows it (F3 3.6, `store.claims.get`): what they reported, where it
 * stands, what the team asked for and the outcome in words. While the team needs more information
 * the customer answers it (`store.claims.respondInfo`).
 *
 * CONTRACT-GAP store.claims — the published claim has no message thread and no date the team
 * answers by, and its photos are file ids only; the page shows the request and the answer.
 */
export function ClaimThread({ initial }: { initial: Claim }) {
  const t = useTranslations("fulfilment.claimView");
  const types = useTranslations("myOrders.claimTypes");
  const resolutions = useTranslations("fulfilment.claim.resolutions");
  const format = useFormat();
  const [claim, setClaim] = useState(initial);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const { data } = await browserApi().POST("/v1/store/claims/{claimId}/info", {
        params: { path: { claimId: claim.id }, header: { "Idempotency-Key": key.current } },
        body: { response: reply.trim() },
      });
      setClaim(data!);
      setReply("");
      key.current = newKey();
    } catch (error) {
      key.current = newKey();
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  const shown = claim.resolutions.filter((resolution) => CUSTOMER_ACTIONS.has(resolution.action));
  const photos = claim.photos.product.length + claim.photos.carton.length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip map={CLAIM_STATUS} value={claim.status} size="md" />
      </div>

      {claim.status === "need_info" ? (
        <Callout tone="warning" title={t("needInfoTitle")}>
          {claim.infoRequest ?? t("needInfo")}
        </Callout>
      ) : null}
      {DECIDED.has(claim.status) ? (
        <Callout tone={claim.status === "rejected" ? "neutral" : "success"} title={t(`decided.${claim.status}`)}>
          {claim.decisionNote ? <p>{claim.decisionNote}</p> : null}
          {shown.map((resolution) => (
            <p key={`${resolution.action}-${resolution.executedAt}`} className="mt-1">
              {resolution.amount
                ? t("actionAmount", {
                    action: t(`actions.${resolution.action}`),
                    amount: format.thb(resolution.amount),
                  })
                : t(`actions.${resolution.action}`)}
            </p>
          ))}
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
            ...(claim.claimedQuantity
              ? [{ term: t("quantity"), description: format.number(claim.claimedQuantity) }]
              : []),
            { term: t("wanted"), description: resolutions(claim.requestedResolution) },
            { term: t("submitted"), description: format.dateTime(claim.submittedAt) },
            ...(claim.origin === "tolerance_auto" ? [{ term: t("origin"), description: t("automatic") }] : []),
            ...(photos > 0 ? [{ term: t("evidence"), description: t("photoCount", { count: photos }) }] : []),
          ]}
        />
        <p className="mt-3 text-sm whitespace-pre-line">{claim.description}</p>
      </section>

      {claim.status === "need_info" ? (
        <form onSubmit={(event) => void send(event)} className="flex max-w-xl flex-col gap-2">
          <Field label={t("reply")}>
            <Textarea rows={3} maxLength={2000} value={reply} onChange={(event) => setReply(event.target.value)} />
          </Field>
          <Button type="submit" className="self-start" loading={busy} disabled={!reply.trim()}>
            {t("send")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
