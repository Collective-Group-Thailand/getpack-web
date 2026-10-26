"use client";

import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";

import { usePostcodeArea } from "./postcode";
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
  const { area, unknown } = usePostcodeArea(state.postcode);

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
      {/* Its height is reserved, so the area arriving does not move the note under it. */}
      <p className="flex min-h-5 items-center gap-2 text-sm" aria-live="polite">
        {area ? (
          <>
            <Icon name="map-pin" size={16} aria-hidden="true" />
            {t("area", {
              district: pick(locale, area.district.nameTh, area.district.nameEn),
              province: pick(locale, area.province.nameTh, area.province.nameEn),
            })}
          </>
        ) : null}
      </p>
      <p className="text-muted text-xs">{t("note")}</p>
    </div>
  );
}
