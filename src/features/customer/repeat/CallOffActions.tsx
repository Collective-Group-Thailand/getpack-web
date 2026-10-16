"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/i18n/format";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

/**
 * Releasing part of a call-off (U2.F5, D-290): a quantity ≥ the factory's minimum and ≤ what is
 * left becomes a quotation at the locked unit price in the cart — a normal order from there — and
 * cancelling an agreement (what is not released lapses without charge). Only for whoever may commit
 * money (`canOrder`); getpack-api refuses anyone else anyway.
 */
export function CallOffActions({
  agreement,
  canOrder,
}: {
  agreement: Schemas["CallOffAgreementDto"];
  canOrder: boolean;
}) {
  const t = useTranslations("account.callOffs");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!canOrder) return <p className="text-muted text-sm">{t("noRight")}</p>;
  const n = Number(quantity);
  const valid = /^\d{1,7}$/.test(quantity) && n >= agreement.minReleaseQuantity && n <= agreement.remainingQuantity;

  const release = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await browserApi().POST("/v1/store/call-off-agreements/{agreementId}/releases", {
        params: { path: { agreementId: agreement.id }, header: { "Idempotency-Key": newIdempotencyKey() } },
        body: { quantity: n },
      });
      toast.success(t("released"));
      router.push("/cart");
    } catch (error) {
      setProblem(isApiError(error) ? error.detail : t("failed"));
      setBusy(false);
    }
  };
  const cancel = async () => {
    try {
      await browserApi().POST("/v1/store/call-off-agreements/{agreementId}/actions/cancel", {
        params: { path: { agreementId: agreement.id }, header: { "Idempotency-Key": newIdempotencyKey() } },
      });
      toast.success(t("cancelled"));
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {agreement.status === "active" ? (
        <section aria-labelledby="release" className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4">
          <h2 id="release" className="font-semibold">
            {t("releaseTitle")}
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <Field
              label={t("releaseQuantity", { unit: agreement.unit })}
              hint={t("releaseHint", {
                min: formatNumber(agreement.minReleaseQuantity, locale),
                left: formatNumber(agreement.remainingQuantity, locale),
              })}
              className="w-56"
            >
              <Input
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value.trim())}
              />
            </Field>
            <Button loading={busy} disabled={!valid} onClick={() => void release()}>
              {t("release")}
            </Button>
          </div>
          <p className="text-muted text-xs">{t("releaseNote")}</p>
          {problem ? <Callout tone="danger" title={problem} /> : null}
        </section>
      ) : null}
      {["pending_factory", "active"].includes(agreement.status) ? (
        <div>
          <Button variant="ghost" className="text-danger" onClick={() => setCancelling(true)}>
            {t("cancel")}
          </Button>
        </div>
      ) : null}
      <AlertDialog
        open={cancelling}
        onOpenChange={setCancelling}
        tone="destructive"
        title={t("cancelTitle")}
        description={t("cancelBody", { left: formatNumber(agreement.remainingQuantity, locale), unit: agreement.unit })}
        confirmLabel={t("cancel")}
        cancelLabel={tCommon("actions.cancel")}
        onConfirm={() => void cancel()}
      />
    </div>
  );
}
