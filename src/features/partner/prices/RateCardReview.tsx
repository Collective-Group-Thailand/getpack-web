"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useRefresh } from "@/features/partner/client";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { newIdempotencyKey } from "@/lib/api/client";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

export interface RateCardLine {
  id: string;
  /** "อาร์ตการ์ด 350 แกรม · 1,000–4,999" — the line as the factory reads it. */
  label: string;
  /** The proposed values, already as text. */
  proposed: string;
  /** The value columns a counter may name, with the proposed value to start from. */
  columns: { key: string; label: string; value: string }[];
}

type Answer = "accept" | "counter";

/**
 * A rate card Packio sent (D-042 a): accepted whole, or line by line — accept, or counter with
 * the value the factory asks for instead (a negotiated exception). Lines left unanswered stay
 * open. The card applies to new orders once every line is agreed; orders already priced keep
 * their snapshot (D-040). One `Idempotency-Key` per answer sent.
 */
export function RateCardReview({
  proposalId,
  lines,
  typeName,
}: {
  proposalId: string;
  lines: RateCardLine[];
  typeName: string;
}) {
  const t = useTranslations("partnerPrices.rateCard");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [mode, setMode] = useState<"all" | "lines">("all");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [counters, setCounters] = useState<Record<string, Record<string, string>>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  if (!can("factory_rate_card.accept")) return <p className="text-muted">{t("ownerOnly")}</p>;

  async function respond(body: Schemas["RespondToRateCardDto"], idempotencyKey: string) {
    await browserApi().POST("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/actions/respond", {
      params: { path: { factoryId, proposalId }, header: { "Idempotency-Key": idempotencyKey } },
      body,
    });
  }

  async function sendLines() {
    const answered = lines.filter((line) => answers[line.id]);
    const invalid = answered.find(
      (line) =>
        answers[line.id] === "counter" &&
        !line.columns.some((column) => (counters[line.id]?.[column.key] ?? column.value) !== column.value),
    );
    if (invalid) return toast.error(t("counterUnchanged", { line: invalid.label }));
    setBusy(true);
    try {
      await respond(
        {
          lines: answered.map((line) => ({
            lineId: line.id,
            // CONTRACT-DEFECT contract.rate-card-line-response: the contract types `response` as
            // its own DTO (an enum name collision); packio-api declares it `accept | counter`.
            response: answers[line.id] as unknown as Schemas["RateCardLineResponse"]["response"],
            ...(answers[line.id] === "counter"
              ? {
                  counterValues: Object.fromEntries(
                    line.columns.map((column) => [column.key, counters[line.id]?.[column.key] ?? column.value]),
                  ),
                  comment: comments[line.id]?.trim() || null,
                }
              : {}),
          })),
        },
        key,
      );
      setKey(newIdempotencyKey());
      setAnswers({});
      toast.success(t("sent", { count: answered.length }));
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
          <p>{t("allBody", { count: lines.length })}</p>
          <Button size="xl" block iconStart="handshake" onClick={() => setConfirming(true)}>
            {t("acceptAll")}
          </Button>
          <ConfirmAction
            open={confirming}
            onOpenChange={setConfirming}
            title={t("acceptAllTitle")}
            description={t("acceptAllBody", { type: typeName, count: lines.length })}
            confirmLabel={t("acceptAll")}
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
            {lines.map((line) => (
              <li key={line.id}>
                <Card padding="md" className="flex flex-col gap-3">
                  <div>
                    <p className="font-medium">{line.label}</p>
                    <p className="text-muted text-sm tabular-nums">{line.proposed}</p>
                  </div>
                  <SegmentedControl
                    label={t("answerFor", { line: line.label })}
                    size="xl"
                    value={answers[line.id] ?? ("" as Answer)}
                    onValueChange={(value) => setAnswers({ ...answers, [line.id]: value })}
                    options={[
                      { value: "accept", label: t("accept"), icon: "check" },
                      { value: "counter", label: t("counter"), icon: "scale" },
                    ]}
                  />
                  {answers[line.id] === "counter" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {line.columns.map((column) => (
                        <Field key={column.key} label={t("counterValue", { column: column.label })}>
                          <Input
                            inputSize="lg"
                            inputMode="decimal"
                            value={counters[line.id]?.[column.key] ?? column.value}
                            onChange={(event) =>
                              setCounters({
                                ...counters,
                                [line.id]: { ...counters[line.id], [column.key]: event.target.value },
                              })
                            }
                          />
                        </Field>
                      ))}
                      <Field label={t("comment")} className="md:col-span-2">
                        <Input
                          inputSize="lg"
                          value={comments[line.id] ?? ""}
                          onChange={(event) => setComments({ ...comments, [line.id]: event.target.value })}
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
