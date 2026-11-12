"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { isPast } from "@/features/agent/pipeline/dates";
import { newIdempotencyKey, useProblemText } from "@/features/agent/pipeline/problem";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

type Option = Schemas["AgentDiscountOptionDto"];

/**
 * getpack's answer to a discount request (D-468 §3, PROMPT P3 Web 5): the options as plain lines — "ลูกค้าได้ส่วนลด 6% ·
 * คุณได้ ฿56,400" — every figure the API's. The full-rate option is always first (the API orders it; `position` keeps
 * it so). Choosing one asks first; a co-fund option, which lowers the agent's own rate, needs an explicit tick that
 * states the amount the agent will get. Nothing about cost or margin, ever.
 */
export function DiscountOptions({
  agentQuoteId,
  options,
  locked,
}: {
  agentQuoteId: string;
  options: Option[];
  /** The round is no longer open to a choice (one is accepted, or it closed). */
  locked: boolean;
}) {
  const t = useTranslations("agentSales.options");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const problemText = useProblemText();
  const router = useRouter();
  const [chosen, setChosen] = useState<Option | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per decision: a retry after a dropped connection is the same acceptance, not a second one.
  const key = useRef<string>("");
  const sorted = [...options].sort((a, b) => a.position - b.position);

  const accept = async () => {
    if (!chosen) return;
    if (chosen.kind === "co_fund" && !agreed) return setError(t("coFundTick"));
    setBusy(true);
    setError(null);
    try {
      await browserApi().POST("/v1/store/agent/quotes/{agentQuoteId}/discount-options/{optionId}/actions/accept", {
        params: { path: { agentQuoteId, optionId: chosen.id }, header: { "Idempotency-Key": key.current } },
      });
      toast.success(t("accepted"));
      setChosen(null);
      router.refresh();
    } catch (failure) {
      setError(problemText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ol className="flex flex-col gap-3" aria-label={t("label")}>
        {sorted.map((option) => {
          const expired = isPast(option.validUntil);
          const accepted = option.status === "accepted";
          return (
            <li
              key={option.id}
              className={cn(
                "border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between",
                accepted && "border-success/40 bg-success-subtle/40",
                option.status === "lapsed" && "opacity-70",
              )}
              data-testid={`option-${option.kind}`}
            >
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={option.kind === "co_fund" ? "warning" : option.kind === "spiff" ? "success" : "primary"} icon={option.kind === "co_fund" ? "handshake" : option.kind === "spiff" ? "star" : "check"}>
                    {t(`kinds.${option.kind}`)}
                  </Badge>
                  {accepted ? <Badge tone="success" icon="check">{t("chosen")}</Badge> : null}
                </div>
                <p className="text-base font-semibold text-pretty tabular-nums">
                  {t("line", { discount: format.percent(option.discountPct), commission: format.thb(option.commissionAmount) })}
                </p>
                <p className="text-muted mt-0.5 text-sm tabular-nums">
                  {t("net", { net: format.thb(option.netAmount) })} ·{" "}
                  {option.kind === "standard"
                    ? t("fullRate", { rate: format.percent(option.ratePct) })
                    : t("rate", { rate: format.percent(option.ratePct), standard: format.percent(option.standardRatePct) })}
                </p>
                {option.conditionsTh ? <p className="text-muted mt-1 text-sm">{option.conditionsTh}</p> : null}
                <p className="text-muted mt-1 text-xs">{t("validUntil", { date: format.dateTime(option.validUntil) })}</p>
              </div>
              {locked || option.status !== "offered" ? null : (
                <Button
                  variant={option.position === 1 ? "primary" : "secondary"}
                  disabled={expired}
                  className="shrink-0"
                  onClick={() => {
                    key.current = newIdempotencyKey();
                    setAgreed(false);
                    setError(null);
                    setChosen(option);
                  }}
                >
                  {expired ? t("expired") : t("choose")}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      <Dialog
        open={chosen !== null}
        onOpenChange={(next) => !busy && !next && setChosen(null)}
        title={chosen?.kind === "co_fund" ? t("coFundTitle") : t("confirmTitle")}
        description={chosen ? t("confirmBody", { discount: format.percent(chosen.discountPct), net: format.thb(chosen.netAmount) }) : undefined}
        closeLabel={tCommon("actions.close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setChosen(null)} disabled={busy}>
              {tCommon("actions.cancel")}
            </Button>
            <Button loading={busy} onClick={() => void accept()} disabled={chosen?.kind === "co_fund" && !agreed}>
              {t("confirm")}
            </Button>
          </>
        }
      >
        {chosen ? (
          <div className="flex flex-col gap-4">
            <p className="bg-surface-subtle rounded-lg p-4 text-base">
              {t("youGet")} <strong className="text-lg font-semibold tabular-nums">{format.thb(chosen.commissionAmount)}</strong>
              <span className="text-muted block text-sm">
                {t("atRate", { rate: format.percent(chosen.ratePct), standard: format.percent(chosen.standardRatePct) })}
              </span>
            </p>
            {chosen.kind === "co_fund" ? (
              <>
                <Callout tone="warning" title={t("coFundWarning")}>
                  {t("coFundBody", { rate: format.percent(chosen.ratePct), standard: format.percent(chosen.standardRatePct) })}
                </Callout>
                <Checkbox
                  label={t("coFundAgree", { amount: format.thb(chosen.commissionAmount) })}
                  checked={agreed}
                  onCheckedChange={(on) => {
                    setAgreed(on === true);
                    setError(null);
                  }}
                />
              </>
            ) : null}
            {chosen.conditionsTh ? <p className="text-muted text-sm">{chosen.conditionsTh}</p> : null}
            {error ? <Callout tone="danger" title={error} live /> : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
