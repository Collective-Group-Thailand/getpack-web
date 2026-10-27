"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Input } from "@/ui/components/Input";

import type { Configurator, ConfiguratorState } from "./state";

/**
 * The discount code (prototype `.disc`), under the price summary. The code is checked as soon as it is
 * entered so the customer knows it works for this product (`store.promotions.checkCode`, D-053); what
 * it takes off is the quotation's and the checkout's to compute, so this says what the code gives —
 * the offer's own percent or amount — never what it would take off this order.
 */
export function PromoCode({
  configurator,
  state,
  onChange,
}: {
  configurator: Configurator;
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
}) {
  const t = useTranslations("configurator.design");
  const format = useFormat();
  const check = useMutation({
    mutationFn: async (code: string) =>
      (
        await browserApi().POST("/v1/store/promotions/actions/check", {
          body: {
            code,
            productTypeCode: configurator.productTypeCode,
            ...(state.quantity > 0 ? { quantity: state.quantity } : {}),
          },
        })
      ).data!,
  });
  const result = check.data;
  const offer = result?.offer ?? null;

  /** What the offer gives, in its own terms (the amount off this order is the cart's). */
  const benefitText = (benefit: Schemas["OfferBenefitDto"]) => {
    const cap = benefit.maxAmount ? t("promoBenefit.cap", { amount: format.thb(benefit.maxAmount) }) : "";
    if (benefit.pct) return `${t("promoBenefit.percent", { pct: format.percent(benefit.pct) })}${cap}`;
    if (benefit.amount) return `${t("promoBenefit.fixed", { amount: format.thb(benefit.amount) })}${cap}`;
    return null;
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (state.promoCode.trim()) check.mutate(state.promoCode.trim());
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          aria-label={t("promo")}
          placeholder={t("promo")}
          value={state.promoCode}
          autoComplete="off"
          autoCapitalize="characters"
          inputSize="sm"
          onChange={(event) => {
            check.reset();
            onChange({ promoCode: event.target.value.toUpperCase() });
          }}
          className="min-w-0 flex-1 uppercase"
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          loading={check.isPending}
          disabled={!state.promoCode.trim()}
        >
          {t("promoCheck")}
        </Button>
      </div>
      {result?.valid ? (
        <Callout tone="success" live title={offer?.title ?? result.code}>
          {offer ? (
            <>
              {offer.description ?? benefitText(offer.benefit)}
              {offer.validUntil ? (
                <span className="text-muted block text-xs">
                  {t("promoValidUntil", { date: format.dateTime(offer.validUntil) })}
                </span>
              ) : null}
            </>
          ) : null}
        </Callout>
      ) : null}
      {result && !result.valid ? (
        <Callout tone="warning" live>
          {t(`promoReasons.${result.reason ?? "not_found"}`)}
        </Callout>
      ) : null}
      {check.isError ? (
        <Callout tone="danger" live>
          {isApiError(check.error) && check.error.status === 429 ? t("promoTooMany") : t("promoFailed")}
        </Callout>
      ) : null}
      <p className="text-muted m-0 text-xs">{t("promoHint")}</p>
    </form>
  );
}
