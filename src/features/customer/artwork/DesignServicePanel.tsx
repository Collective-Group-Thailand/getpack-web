"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { DESIGN_ROUND_STATUS, DESIGN_SERVICE_STATUS } from "@/domain/status";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Meter } from "@/ui/components/Meter";
import { toast } from "@/ui/components/Toast";

import { PayInstalmentButton } from "../checkout/PayInstalmentButton";
import { pendingProof, type Artwork } from "./artwork";
import { artworkKey } from "./keys";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

type Brief = { brandName: string; brandCategory: string; description: string };
const BRIEF_KEYS = ["brandName", "brandCategory", "description"] as const;

/**
 * Hired design (D-071): the brief, then rounds — the free ones counted, the counter always in
 * view, and past them the fee the API quotes, accepted explicitly and paid before the designer
 * starts. A change of structure or concept is a new design, re-quoted by the team, not a round.
 *
 * The designer's delivery arrives as a proof (`store.designServices`): approving the design is
 * approving that proof, and a free revision is asking for changes on it. Only a charged round is
 * the design service's own action (`confirm-extra-round`, with the fee the customer saw).
 */
export function DesignServicePanel({ artwork }: { artwork: Artwork }) {
  const t = useTranslations("artwork.design");
  const locale = useLocale();
  const format = useFormat();
  const queryClient = useQueryClient();
  const service = artwork.designService!;
  const { order } = artwork;
  const proof = pendingProof(artwork.proofs);
  const [brief, setBrief] = useState<Brief>({ brandName: "", brandCategory: "", description: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Brief, string>>>({});
  const [note, setNote] = useState("");
  const [feeAccepted, setFeeAccepted] = useState(false);
  const [approving, setApproving] = useState(false);
  const [busy, setBusy] = useState(false);
  // Approving the delivered design approves its proof: the same checklist (`artwork.approval_checklist`).
  const checklist = artwork.rules?.approvalChecklist ?? [];
  const [checked, setChecked] = useState<string[]>([]);
  const checklistDone = checklist.every((item) => checked.includes(item.key));
  const key = useRef(newKey());
  const used = Math.min(service.revisionsUsed, service.freeRounds);
  const freeLeft = service.freeRounds - used;
  const next = service.nextRevision;
  const charged = Boolean(next?.chargeable && next.feeGross);

  async function run(call: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await call();
      await queryClient.invalidateQueries({ queryKey: artworkKey(order.id) });
      toast.success(done);
      key.current = newKey();
      return true;
    } catch (error) {
      if (isApiError(error)) key.current = newKey();
      toast.error(isApiError(error) ? error.detail : t("failed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function submitBrief(event: React.FormEvent) {
    event.preventDefault();
    const found: Partial<Record<keyof Brief, string>> = {};
    for (const field of BRIEF_KEYS)
      if (!brief[field].trim()) found[field] = t("required", { name: t(`brief.${field}`) });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void run(
      () =>
        browserApi().PUT("/v1/store/orders/{orderId}/design-service/brief", {
          params: { path: { orderId: order.id } },
          body: {
            brandName: brief.brandName.trim(),
            brandCategory: brief.brandCategory.trim(),
            description: brief.description.trim(),
          },
        }),
      t("briefSent"),
    );
  }

  function requestRevision() {
    void run(
      () =>
        charged
          ? browserApi().POST("/v1/store/orders/{orderId}/design-service/actions/confirm-extra-round", {
              params: { path: { orderId: order.id }, header: { "Idempotency-Key": key.current } },
              body: { changeRequest: note.trim(), expectedFeeGross: next!.feeGross! },
            })
          : browserApi().POST("/v1/store/proofs/{proofId}/actions/request-changes", {
              params: { path: { proofId: proof!.id } },
              body: { comment: note.trim() },
            }),
      t("revisionSent"),
    ).then((sent) => sent && setNote(""));
  }

  return (
    <section aria-labelledby="design-service" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="design-service" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <StatusChip map={DESIGN_SERVICE_STATUS} value={service.status} size="md" />
      </div>

      {artwork.actions.submitBrief ? (
        <form noValidate onSubmit={submitBrief} className="flex flex-col gap-4">
          <p className="text-muted text-sm">{t("briefIntro")}</p>
          {BRIEF_KEYS.map((field) => (
            <Field
              key={field}
              label={t(`brief.${field}`)}
              hint={field === "description" ? t("brief.descriptionHint") : undefined}
              required
              requiredLabel={t("requiredMark")}
              error={errors[field]}
            >
              {field === "description" ? (
                <Textarea
                  rows={4}
                  maxLength={4000}
                  value={brief[field]}
                  onChange={(event) => setBrief((current) => ({ ...current, [field]: event.target.value }))}
                />
              ) : (
                <Input
                  value={brief[field]}
                  onChange={(event) => setBrief((current) => ({ ...current, [field]: event.target.value }))}
                />
              )}
            </Field>
          ))}
          <Button type="submit" className="self-start" loading={busy}>
            {t("sendBrief")}
          </Button>
        </form>
      ) : service.brief ? (
        <>
          <DescriptionList
            items={BRIEF_KEYS.map((field) => ({ term: t(`brief.${field}`), description: service.brief![field] }))}
          />
          {service.targetDueAt && service.maxDueAt ? (
            <p className="text-muted text-sm">
              {t("due", { target: format.date(service.targetDueAt), max: format.date(service.maxDueAt) })}
            </p>
          ) : null}
          <div className="border-border rounded-xl border p-4">
            <Meter
              value={service.freeRounds ? Math.min(100, Math.round((used / service.freeRounds) * 100)) : 100}
              label={t("freeRounds")}
              valueText={t("freeRoundsValue", { used, free: service.freeRounds, left: freeLeft })}
              tone={freeLeft === 0 ? "warning" : "primary"}
            />
            <p className="mt-2 text-sm">{t("freeRoundsValue", { used, free: service.freeRounds, left: freeLeft })}</p>
          </div>
          <ol className="flex flex-col gap-2">
            {service.rounds.map((round) => (
              <li key={round.id} className="border-border flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {round.kind === "initial"
                      ? t("initial", { round: round.roundNo })
                      : t("revision", { round: round.roundNo })}
                    {round.chargeable && round.feeNet ? (
                      <span className="text-muted ml-2 font-normal">
                        {t("paidRoundNet", { fee: format.thb(round.feeNet) })}
                      </span>
                    ) : null}
                  </p>
                  <StatusChip map={DESIGN_ROUND_STATUS} value={round.status} />
                </div>
                {round.changeRequest ? <p className="text-muted">{round.changeRequest}</p> : null}
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {artwork.feeInstalment && artwork.feeInstalment.status !== "paid" ? (
        <Callout tone="warning" title={t("feeDueTitle")}>
          <div className="flex flex-col items-start gap-2">
            <span>{t("feeDue", { fee: format.thb(artwork.feeInstalment.openAmount) })}</span>
            <PayInstalmentButton
              size="sm"
              instalment={{
                id: artwork.feeInstalment.id,
                groupId: artwork.feeInstalment.groupId,
                label: pick(locale, artwork.feeInstalment.labelTh, artwork.feeInstalment.labelEn),
                grossAmount: artwork.feeInstalment.openAmount,
                activePaymentId: artwork.feeInstalment.activePaymentId,
              }}
              orderCode={order.orderCode}
            >
              {t("payFee")}
            </PayInstalmentButton>
          </div>
        </Callout>
      ) : null}

      {artwork.actions.reviewDesign && proof ? (
        <div className="flex flex-col gap-3">
          <Field label={t("revisionNote")} hint={t("revisionHint")}>
            <Textarea rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          {charged ? (
            <Callout tone="info" title={t("chargeableTitle", { round: next!.revisionNo + 1 })}>
              <Checkbox
                checked={feeAccepted}
                onCheckedChange={(checked) => setFeeAccepted(checked === true)}
                label={t("acceptFee", { fee: format.thb(next!.feeGross!) })}
              />
            </Callout>
          ) : (
            <p className="text-muted text-xs">{t("freeNote", { left: freeLeft })}</p>
          )}
          {checklist.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("checklist")}</legend>
              {checklist.map((item) => (
                <Checkbox
                  key={item.key}
                  checked={checked.includes(item.key)}
                  onCheckedChange={(value) =>
                    setChecked((current) =>
                      value === true ? [...current, item.key] : current.filter((key) => key !== item.key),
                    )
                  }
                  label={pick(locale, item.labelTh, item.labelEn)}
                />
              ))}
            </fieldset>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy}
              disabled={note.trim().length < 3 || (charged && !feeAccepted)}
              onClick={requestRevision}
            >
              {t("requestRevision")}
            </Button>
            <Button onClick={() => setApproving(true)} disabled={!checklistDone}>
              {t("approve")}
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={approving}
        onOpenChange={setApproving}
        title={t("approveTitle")}
        description={t("approveBody", { code: order.orderCode })}
        confirmLabel={t("approve")}
        cancelLabel={t("cancel")}
        loading={busy}
        confirmationPhrase={order.orderCode}
        confirmationLabel={t("approveType", { code: order.orderCode })}
        onConfirm={() =>
          void run(
            () =>
              browserApi().POST("/v1/store/proofs/{proofId}/actions/approve", {
                params: { path: { proofId: proof!.id }, header: { "Idempotency-Key": key.current } },
                body: checklist.length > 0 ? { checklist: checked } : {},
              }),
            t("approved"),
          ).then(() => setApproving(false))
        }
      />
    </section>
  );
}
