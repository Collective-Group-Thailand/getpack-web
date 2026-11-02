"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

type Example = Schemas["AgentCommissionExampleDto"];
const AMOUNT = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * The landing's calculator (D-466): the visitor types an order value; the API works out the commission at the
 * standard rates (`store.agentProgramme.example`) — the web only validates the text and formats the answer.
 */
export function CommissionCalculator({ initial }: { initial: Example | null }) {
  const t = useTranslations("agent.landing.commission");
  const format = useFormat();
  const resultId = useId();
  const [raw, setRaw] = useState(initial ? String(Number(initial.orderValue)) : "");
  const [result, setResult] = useState<Example | null>(initial);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const cleaned = raw.replace(/[,\s]/g, "");
  const invalid = cleaned !== "" && !AMOUNT.test(cleaned);
  const problem = invalid ? t("calcInvalid") : failed ? t("calcFailed") : null;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function change(next: string) {
    setRaw(next);
    setFailed(false);
    window.clearTimeout(timer.current);
    const value = next.replace(/[,\s]/g, "");
    if (!value || !AMOUNT.test(value)) return;
    timer.current = window.setTimeout(async () => {
      try {
        const { data } = await browserApi().GET("/v1/store/agent/programme/example", {
          params: { query: { orderValue: value } },
        });
        if (data) setResult(data);
      } catch {
        setFailed(true);
      }
    }, 300);
  }

  return (
    <div className="border-border bg-surface rounded-panel flex flex-col gap-4 border p-5">
      <h3 className="text-base font-semibold">{t("calcTitle")}</h3>
      <Field label={t("calcLabel")} hint={t("calcHint")} error={problem ?? undefined}>
        <Input
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          onChange={(event) => change(event.target.value)}
          aria-describedby={resultId}
        />
      </Field>
      <dl id={resultId} aria-live="polite" className="grid grid-cols-2 gap-3">
        <div className="bg-primary-subtle rounded-card flex flex-col gap-1 p-3.5">
          <dt className="text-muted text-xs">{t("calcFirst")}</dt>
          <dd className="text-primary text-xl font-bold tabular-nums">
            {result ? format.thb(result.firstOrder) : "—"}
          </dd>
        </div>
        <div className="bg-bg-subtle rounded-card flex flex-col gap-1 p-3.5">
          <dt className="text-muted text-xs">{t("calcRepeat")}</dt>
          <dd className="text-xl font-bold tabular-nums">{result ? format.thb(result.repeatOrder) : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
