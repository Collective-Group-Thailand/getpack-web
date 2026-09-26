"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { DESIGN_ROUND_STATUS, DESIGN_SERVICE_STATUS } from "@/domain/status";
import type { NextAction } from "@/domain/status/next-action";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Meter } from "@/ui/components/Meter";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { PayInstalmentButton } from "../checkout/PayInstalmentButton";
import { artworkKey } from "./keys";

type Service = NonNullable<ResponseOf<Requests, "GET /v1/store/orders/{orderId}/artwork">["designService"]>;

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Hired design (D-071): the brief, then rounds — the first three free, the counter always in view,
 * and from the fourth the fee the API quotes, accepted explicitly and paid before the designer
 * starts. A change of structure or concept is a new design, re-quoted by the team, not a round.
 */
export function DesignServicePanel({
  orderId,
  orderCode,
  service,
  actions,
}: {
  orderId: string;
  orderCode: string;
  service: Service;
  actions: readonly NextAction[];
}) {
  const t = useTranslations("artwork.design");
  const locale = useLocale();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [feeAccepted, setFeeAccepted] = useState(false);
  const [approving, setApproving] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  // Counted as the back office counts them (every round the API did not charge, the first design
  // included); whether the next one is charged is the API's `nextRound`, never this count.
  const used = Math.min(service.rounds.filter((round) => !round.chargeable).length, service.freeRounds);
  const freeLeft = service.freeRounds - used;
  const can = (action: string) => actions.some((entry) => entry.key === action);

  const update = (next: unknown) => queryClient.setQueryData(artworkKey(orderId), next);

  async function run(call: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      update(await call());
      toast.success(done);
      key.current = newKey();
    } catch (error) {
      if (isApiError(error)) key.current = newKey();
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  function submitBrief(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    for (const field of service.briefFields)
      if (field.required && !answers[field.key]?.trim())
        found[field.key] = t("required", { name: pick(locale, field.labelTh, field.labelEn) });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void run(
      () =>
        browserRequests().call("PUT /v1/store/orders/{orderId}/design-service/brief", {
          path: { orderId },
          body: { answers, fileIds: [] },
        }),
      t("briefSent"),
    );
  }

  return (
    <section aria-labelledby="design-service" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="design-service" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <StatusChip map={DESIGN_SERVICE_STATUS} value={service.status} size="md" />
      </div>

      {!service.briefSubmitted ? (
        <form noValidate onSubmit={submitBrief} className="flex flex-col gap-4">
          <p className="text-muted text-sm">{t("briefIntro")}</p>
          {service.briefFields.map((field) => {
            const label = pick(locale, field.labelTh, field.labelEn);
            const help = pick(locale, field.helpTh ?? "", field.helpEn) || undefined;
            const set = (value: string) => setAnswers((current) => ({ ...current, [field.key]: value }));
            return (
              <Field
                key={field.key}
                label={label}
                hint={help}
                required={field.required}
                requiredLabel={t("requiredMark")}
                error={errors[field.key]}
              >
                {field.type === "select" ? (
                  <Select
                    value={answers[field.key] || undefined}
                    placeholder={t("choose")}
                    onValueChange={set}
                    options={field.options.map((option) => ({
                      value: option.value,
                      label: pick(locale, option.labelTh, option.labelEn),
                    }))}
                  />
                ) : field.type === "textarea" ? (
                  <Textarea rows={4} value={answers[field.key] ?? ""} onChange={(event) => set(event.target.value)} />
                ) : (
                  <Input value={answers[field.key] ?? ""} onChange={(event) => set(event.target.value)} />
                )}
              </Field>
            );
          })}
          <Button type="submit" className="self-start" loading={busy}>
            {t("sendBrief")}
          </Button>
        </form>
      ) : (
        <>
          <DescriptionList items={service.brief.map((item) => ({ term: item.label, description: item.value }))} />
          <p className="text-muted text-sm">
            {t("due", { target: format.date(service.targetDueAt), max: format.date(service.maxDueAt) })}
          </p>
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
              <li key={round.roundNo} className="border-border flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {round.kind === "initial"
                      ? t("initial", { round: round.roundNo })
                      : t("revision", { round: round.roundNo })}
                    {round.chargeable && round.feeAmount ? (
                      <span className="text-muted ml-2 font-normal">
                        {t("paidRound", { fee: format.thb(round.feeAmount) })}
                      </span>
                    ) : null}
                  </p>
                  <StatusChip map={DESIGN_ROUND_STATUS} value={round.status} />
                </div>
                {round.note ? <p className="text-muted">{round.note}</p> : null}
                {round.files.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {round.files.map((file) =>
                      file.url ? (
                        <li key={file.id}>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-4"
                          >
                            {file.originalName}
                          </a>
                        </li>
                      ) : (
                        <li key={file.id} className="text-muted">
                          {file.originalName}
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      )}

      {service.pendingFeeInstalment ? (
        <Callout tone="warning" title={t("feeDueTitle")}>
          <div className="flex flex-col items-start gap-2">
            <span>{t("feeDue", { fee: format.thb(service.pendingFeeInstalment.grossAmount) })}</span>
            <PayInstalmentButton size="sm" instalment={service.pendingFeeInstalment} orderCode={orderCode}>
              {t("payFee")}
            </PayInstalmentButton>
          </div>
        </Callout>
      ) : null}

      {can("design.request_revision") ? (
        <div className="flex flex-col gap-3">
          <Field label={t("revisionNote")} hint={t("revisionHint")}>
            <Textarea rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          {service.nextRound.chargeable && service.nextRound.feeAmount ? (
            <Callout tone="info" title={t("chargeableTitle", { round: service.nextRound.roundNo })}>
              <Checkbox
                checked={feeAccepted}
                onCheckedChange={(checked) => setFeeAccepted(checked === true)}
                label={t("acceptFee", { fee: format.thb(service.nextRound.feeAmount) })}
              />
            </Callout>
          ) : (
            <p className="text-muted text-xs">{t("freeNote", { left: freeLeft })}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy}
              disabled={note.trim().length < 3 || (service.nextRound.chargeable && !feeAccepted)}
              onClick={() =>
                void run(
                  () =>
                    browserRequests().call("POST /v1/store/orders/{orderId}/design-service/rounds", {
                      path: { orderId },
                      body: {
                        note: note.trim(),
                        ...(service.nextRound.chargeable && service.nextRound.feeAmount
                          ? { acceptedFee: service.nextRound.feeAmount }
                          : {}),
                      },
                      idempotencyKey: key.current,
                    }),
                  t("revisionSent"),
                )
              }
            >
              {t("requestRevision")}
            </Button>
            {can("design.approve") ? <Button onClick={() => setApproving(true)}>{t("approve")}</Button> : null}
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={approving}
        onOpenChange={setApproving}
        title={t("approveTitle")}
        description={t("approveBody", { code: orderCode })}
        confirmLabel={t("approve")}
        cancelLabel={t("cancel")}
        loading={busy}
        onConfirm={() =>
          void run(
            () =>
              browserRequests().call("POST /v1/store/orders/{orderId}/design-service/actions/approve", {
                path: { orderId },
                idempotencyKey: key.current,
              }),
            t("approved"),
          ).then(() => setApproving(false))
        }
      />
    </section>
  );
}
