"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";

import type { Configurator, ConfiguratorState, DesignOption } from "./state";

interface DesignStepProps {
  configurator: Configurator;
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** Whether the online designer can draw this product (a box style `@packio/dieline` knows). */
  designerAvailable: boolean;
}

/**
 * How the artwork gets made and a promotion code. (The physical mockup add-on became the sample
 * of D-192: it is ordered on its own path, U2.F3, not chosen here.)
 *
 * The code is checked as soon as it is entered so the customer knows it works for this product
 * (`store.promotions.checkCode`, D-053); what it takes off is the quotation's and the checkout's
 * to compute, so this says what the code gives — the offer's own percent or amount — never what
 * it would take off this order.
 */
export function DesignStep({ configurator, state, onChange, designerAvailable }: DesignStepProps) {
  const t = useTranslations("configurator.design");
  const format = useFormat();
  const designOptions = configurator.design.options.filter(
    (option) => option !== "online_designer" || designerAvailable,
  );
  // The Studio design this order carries (the studio's "order this"): named here so the customer
  // sees it is attached, and can drop it to order the box blank or with an upload instead.
  const attached = state.designOption === "online_designer" ? state.designDocumentId : null;
  const design = useQuery({
    queryKey: [...queryKeys.zone("customer"), "design-brief", attached],
    queryFn: async ({ signal }) =>
      (await browserApi().GET("/v1/store/designs/{designId}", { params: { path: { designId: attached! } }, signal }))
        .data!,
    enabled: !!attached,
    staleTime: 60_000,
  });
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
    <div className="flex flex-col gap-6">
      <Field label={t("option")}>
        <RadioCards
          columns={2}
          value={state.designOption}
          onValueChange={(designOption) => onChange({ designOption: designOption as DesignOption })}
          options={designOptions.map((option) => ({
            value: option,
            label: t(`options.${option}.label`),
            description: t(`options.${option}.description`),
          }))}
        />
      </Field>

      {attached ? (
        <Callout tone="success" title={t("attached.title")}>
          <p className="text-sm">
            {design.data
              ? t("attached.body", { title: design.data.title, version: design.data.versionNo ?? 1 })
              : t("attached.loading")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={`/studio/${attached}`}>{t("attached.open")}</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange({ designDocumentId: null })}>
              {t("attached.detach")}
            </Button>
          </div>
        </Callout>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (state.promoCode.trim()) check.mutate(state.promoCode.trim());
        }}
      >
        <div className="flex items-start gap-2">
          <Field label={t("promo")} hint={t("promoHint")} className="flex-1">
            <Input
              value={state.promoCode}
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(event) => {
                check.reset();
                onChange({ promoCode: event.target.value.toUpperCase() });
              }}
              className="uppercase"
            />
          </Field>
          <Button
            type="submit"
            variant="secondary"
            className="mt-[1.625rem]"
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
      </form>
    </div>
  );
}
