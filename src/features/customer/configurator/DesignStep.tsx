"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";

import type { Configurator, ConfiguratorState, DesignOption, MockupOption } from "./state";

interface DesignStepProps {
  configurator: Configurator;
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** Whether the online designer can draw this product (a box style `@packio/dieline` knows). */
  designerAvailable: boolean;
}

/**
 * How the artwork gets made, the physical mockup add-on (D-072), and a promotion code.
 *
 * The code is checked as soon as it is entered so the customer knows it works for this product
 * (CONTRACT-REQUEST store.promo-check); what it takes off is the quotation's and the checkout's
 * to compute, so this says what the code gives in the API's words, never an amount.
 */
export function DesignStep({ configurator, state, onChange, designerAvailable }: DesignStepProps) {
  const t = useTranslations("configurator.design");
  const designOptions = configurator.design.options.filter(
    (option) => option !== "online_designer" || designerAvailable,
  );
  const check = useMutation({
    mutationFn: (code: string) =>
      browserRequests().call("POST /v1/store/promotions/actions/check", {
        body: { code, productTypeCode: configurator.productTypeCode, quantity: state.quantity },
      }),
  });
  const result = check.data;

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

      {configurator.mockup.options.length > 1 ? (
        <Field label={t("mockup")} hint={t("mockupHint")}>
          <RadioCards
            columns={3}
            value={state.mockupOption}
            onValueChange={(mockupOption) => onChange({ mockupOption: mockupOption as MockupOption })}
            options={configurator.mockup.options.map((option) => ({
              value: option,
              label: t(`mockups.${option}.label`),
              description: t(`mockups.${option}.description`),
            }))}
          />
        </Field>
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
          <Callout tone="success" live title={result.title ?? result.code}>
            {result.benefit}
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
