"use client";

import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";

import { usePostcodeArea } from "./postcode";
import type { PriceStep } from "./pricing";
import { POSTCODE, type ConfiguratorState } from "./state";
import { arrivalRangeText } from "./store-fields";

interface DeliveryStepProps {
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** The selected quantity's priced step: its destination zone and arrival window (C4-API-2/3), when shipping is priced. */
  priced?: PriceStep | null;
}

/**
 * Where it goes. The postcode is what the API prices delivery from (D-013) and plans the
 * receive date against; the area it resolves to is shown so a typo is caught here rather than
 * at checkout. The full address comes at checkout — nothing more is asked for now. Once shipping is priced, the
 * API's zone name (by locale) and arrival window ("ถึงประมาณ 12–14 ต.ค.") are shown as sent.
 */
export function DeliveryStep({ state, onChange, priced = null }: DeliveryStepProps) {
  const t = useTranslations("configurator.delivery");
  const tDock = useTranslations("configurator.dock");
  const locale = useLocale();
  const format = useFormat();
  const complete = POSTCODE.test(state.postcode);
  const zone = complete && priced?.zoneName ? pick(locale, priced.zoneName.th, priced.zoneName.en) : null;
  const arrival = complete && priced?.arrival ? arrivalRangeText(format, priced.arrival) : null;
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
      {zone || arrival ? (
        <p className="flex items-center gap-2 text-sm" data-zone-arrival="" aria-live="polite">
          <Icon name="truck" size={16} aria-hidden="true" className="text-primary shrink-0" />
          <span>
            {zone ? <span className="font-medium">{zone}</span> : null}
            {zone && arrival ? " · " : null}
            {arrival
              ? arrival.single
                ? tDock("arrivalOn", { date: arrival.date })
                : tDock("arrivalRange", { from: arrival.from, to: arrival.to })
              : null}
          </span>
        </p>
      ) : null}
      <p className="text-muted text-xs">{t("note")}</p>
    </div>
  );
}
