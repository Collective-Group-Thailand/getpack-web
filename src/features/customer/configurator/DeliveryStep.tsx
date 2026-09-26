"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";

import { POSTCODE, type ConfiguratorState } from "./state";

interface DeliveryStepProps {
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
}

/**
 * Where it goes. The postcode is what the API prices delivery from (D-013) and plans the
 * receive date against; the area it resolves to is shown so a typo is caught here rather than
 * at checkout. The full address comes at checkout — nothing more is asked for now.
 */
export function DeliveryStep({ state, onChange }: DeliveryStepProps) {
  const t = useTranslations("configurator.delivery");
  const locale = useLocale();
  const complete = POSTCODE.test(state.postcode);
  const lookup = useQuery({
    queryKey: [...queryKeys.zone("customer"), "postcode", state.postcode],
    queryFn: async ({ signal }) =>
      (
        await browserApi().GET("/v1/store/catalog/geo/postcodes/{postcode}", {
          params: { path: { postcode: state.postcode } },
          signal,
        })
      ).data ?? [],
    enabled: complete,
    staleTime: Infinity,
  });
  const area = lookup.data?.[0];
  const unknown = complete && lookup.isSuccess && lookup.data.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <Field
        label={t("postcode")}
        hint={t("postcodeHint")}
        error={state.postcode !== "" && !complete ? t("postcodeInvalid") : unknown ? t("postcodeUnknown") : undefined}
      >
        <Input
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          value={state.postcode}
          onChange={(event) => onChange({ postcode: event.target.value.replace(/\D/g, "").slice(0, 5) })}
          className="max-w-40 tabular-nums"
        />
      </Field>
      {area ? (
        <p className="flex items-center gap-2 text-sm" aria-live="polite">
          <Icon name="map-pin" size={16} aria-hidden="true" />
          {t("area", {
            district: pick(locale, area.district.nameTh, area.district.nameEn),
            province: pick(locale, area.province.nameTh, area.province.nameEn),
          })}
        </p>
      ) : null}
      <p className="text-muted text-xs">{t("note")}</p>
    </div>
  );
}
