"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { RATE_LINE_ACCEPTANCE } from "@/domain/status";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useRefresh } from "@/features/partner/client";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format";
import { StatusChip } from "@/features/partner/status";
import { newIdempotencyKey } from "@/lib/api/client";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { moneyText } from "@/domain/money";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

type Rate = Schemas["FactoryRateDto"];

/**
 * What getpack pays the factory for delivering with its own fleet (D-013), sent for acceptance
 * (D-042): the whole card, or line by line — accept, or ask for another amount. The card applies
 * once every line is agreed.
 */
export function ShippingCardReview({
  versionId,
  rates,
  bandLabels,
}: {
  versionId: string;
  rates: Rate[];
  bandLabels: Record<string, string>;
}) {
  const t = useTranslations("partnerPrices.shipping");
  const format = useFormat();
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [mode, setMode] = useState<"all" | "lines">("all");
  const [answers, setAnswers] = useState<Record<string, "accept" | "counter">>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  const pending = rates.filter((rate) => rate.acceptance === "pending");
  if (!can("factory_rate_card.accept")) return <p className="text-muted">{t("ownerOnly")}</p>;

  async function respond(body: Schemas["RespondToShippingCardDto"], idempotencyKey: string) {
    await browserApi().POST(
      "/v1/partner/factories/{factoryId}/shipping-rate-card/versions/{versionId}/actions/respond",
      { params: { path: { factoryId, versionId }, header: { "Idempotency-Key": idempotencyKey } }, body },
    );
  }

  async function sendLines() {
    const answered = pending.filter((rate) => answers[rate.id]);
    const lines: Schemas["ShippingCardAnswerDto"][] = [];
    for (const rate of answered) {
      if (answers[rate.id] === "accept") {
        lines.push({ rateId: rate.id, decision: "accept" });
        continue;
      }
      const amount = moneyText(amounts[rate.id] ?? "");
      if (!amount) return toast.error(t("amountInvalid", { band: bandLabels[rate.id] ?? rate.zoneCode }));
      lines.push({ rateId: rate.id, decision: "counter", counterAmount: amount, note: notes[rate.id]?.trim() || null });
    }
    setBusy(true);
    try {
      await respond({ lines }, key);
      setKey(newIdempotencyKey());
      setAnswers({});
      toast.success(t("sent", { count: lines.length }));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("modeLabel")}
        size="xl"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "all", label: t("modeAll"), icon: "check" },
          { value: "lines", label: t("modeLines"), icon: "checklist" },
        ]}
      />
      {mode === "all" ? (
        <>
          <Button size="xl" block iconStart="handshake" disabled={!pending.length} onClick={() => setConfirming(true)}>
            {t("acceptAll", { count: pending.length })}
          </Button>
          <ConfirmAction
            open={confirming}
            onOpenChange={setConfirming}
            title={t("acceptAllTitle")}
            description={t("acceptAllBody", { count: pending.length })}
            confirmLabel={t("acceptAllConfirm")}
            onConfirm={async ({ idempotencyKey }) => {
              try {
                await respond({}, idempotencyKey);
                toast.success(t("accepted"));
                refresh();
              } catch (error) {
                toast.error(problemMessage(error, t("failed")));
                throw error;
              }
            }}
          />
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {rates.map((rate) => (
              <li key={rate.id}>
                <Card padding="md" className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 font-medium">{bandLabels[rate.id]}</span>
                    <StatusChip map={RATE_LINE_ACCEPTANCE} value={rate.acceptance} />
                  </div>
                  <p className="tabular-nums">
                    {t("payout", { amount: format.thb(rate.payoutAmount) })}
                    {rate.perExtraKg ? ` · ${t("perKg", { amount: format.thb(rate.perExtraKg) })}` : ""}
                  </p>
                  {rate.acceptance === "pending" ? (
                    <SegmentedControl
                      label={t("answerFor", { band: bandLabels[rate.id] ?? rate.zoneCode })}
                      size="xl"
                      value={answers[rate.id] ?? ("" as "accept")}
                      onValueChange={(value) => setAnswers({ ...answers, [rate.id]: value })}
                      options={[
                        { value: "accept", label: t("accept"), icon: "check" },
                        { value: "counter", label: t("counter"), icon: "scale" },
                      ]}
                    />
                  ) : rate.counterAmount ? (
                    <p className="text-sm">{t("countered", { amount: format.thb(rate.counterAmount) })}</p>
                  ) : null}
                  {answers[rate.id] === "counter" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label={t("counterAmount")} hint={t("counterAmountHint")}>
                        <Input
                          placeholder={t("counterAmountPlaceholder")}
                          inputSize="lg"
                          inputMode="decimal"
                          value={amounts[rate.id] ?? ""}
                          onChange={(event) => setAmounts({ ...amounts, [rate.id]: event.target.value })}
                        />
                      </Field>
                      <Field label={t("note")}>
                        <Input
                          placeholder={t("notePlaceholder")}
                          inputSize="lg"
                          value={notes[rate.id] ?? ""}
                          onChange={(event) => setNotes({ ...notes, [rate.id]: event.target.value })}
                        />
                      </Field>
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
          <Button
            size="xl"
            block
            iconStart="send"
            loading={busy}
            disabled={!Object.keys(answers).length}
            onClick={() => void sendLines()}
          >
            {t("sendLines", { count: Object.keys(answers).length })}
          </Button>
        </>
      )}
    </div>
  );
}
