"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useProblemText } from "@/features/agent/pipeline/problem";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

type AgentQuote = Schemas["AgentQuoteDto"];

/**
 * A quote's own actions (D-468 §2, §4): send a new link (the old one stops working), withdraw it (asks first — the
 * customer's link stops), and "จองดีล" for a quote below the automatic threshold (protection and a rate lock, no
 * approval). Shown only while the quote is live.
 */
export function QuoteActions({ quote }: { quote: AgentQuote }) {
  const t = useTranslations("agentSales.quote");
  const tCommon = useTranslations("common");
  const problemText = useProblemText();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const live = quote.status === "sent" || quote.status === "opened";
  if (!live) return null;

  const run = async (key: string, call: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await call();
      toast.success(done);
      router.refresh();
    } catch (error) {
      toast.error(problemText(error));
    } finally {
      setBusy(null);
    }
  };
  const path = { params: { path: { agentQuoteId: quote.id } } };

  return (
    <section aria-labelledby="quote-manage" className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5">
      <h2 id="quote-manage" className="font-semibold">
        {t("manage")}
      </h2>
      <div className="flex flex-wrap gap-2">
      {quote.dealRegistration ? null : (
        <Button
          variant="secondary"
          iconStart="shield-check"
          loading={busy === "deal"}
          onClick={() =>
            void run("deal", () => browserApi().POST("/v1/store/agent/quotes/{agentQuoteId}/actions/register-deal", path), t("dealDone"))
          }
        >
          {t("registerDeal")}
        </Button>
      )}
      <Button
        variant="secondary"
        iconStart="refresh"
        loading={busy === "resend"}
        onClick={() => void run("resend", () => browserApi().POST("/v1/store/agent/quotes/{agentQuoteId}/actions/resend", path), t("resent"))}
      >
        {t("resend")}
      </Button>
      <Button variant="destructive" iconStart="undo" onClick={() => setConfirm(true)}>
        {t("withdraw")}
      </Button>
      <AlertDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("withdrawTitle")}
        description={t("withdrawBody", { name: quote.lead.contactName })}
        cancelLabel={tCommon("actions.cancel")}
        confirmLabel={t("withdrawConfirm")}
        tone="destructive"
        onConfirm={() =>
          void run(
            "withdraw",
            () => browserApi().POST("/v1/store/agent/quotes/{agentQuoteId}/actions/withdraw", { ...path, body: {} }),
            t("withdrawn"),
          )
        }
      />
      </div>
    </section>
  );
}
