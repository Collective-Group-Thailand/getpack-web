"use client";

import { useTranslations } from "next-intl";

import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { NumberInput } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { Switch } from "@/ui/components/Switch";

import type { ConfiguratorState, LoadInput } from "./state";

const FRAGILITY: Schemas["AdvisoryFragility"][] = ["low", "medium", "high"];
const TRANSPORT: Schemas["AdvisoryTransportMode"][] = ["pickup", "parcel_domestic", "pallet_domestic", "sea_export"];
const HUMIDITY: Schemas["AdvisoryHumidityBand"][] = ["dry", "normal", "humid", "very_humid"];
const STORAGE: Schemas["AdvisoryStorageBand"][] = ["up_to_10_days", "up_to_30_days", "up_to_90_days", "over_90_days"];

/**
 * The goods and their journey (U2.F1 §2, D-238): what the Structure Advisor needs to size the
 * board. All optional and never blocking — without the goods' weight, units and stacking the
 * advisor simply does not answer, and the configurator prices the board the customer picks.
 */
export function LogisticsStep({
  load,
  onChange,
}: {
  load: LoadInput;
  onChange: (patch: Partial<ConfiguratorState>) => void;
}) {
  const t = useTranslations("configurator.logistics");
  const set = (patch: Partial<LoadInput>) => onChange({ load: { ...load, ...patch }, advisory: null });
  const whole = (text: string, max: number) => {
    if (text.trim() === "") return null;
    const value = Math.round(Number(text));
    return Number.isFinite(value) && value >= 1 ? Math.min(value, max) : null;
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted text-sm">{t("intro")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("weight")} hint={t("weightHint")}>
          <NumberInput
            min={1}
            max={100000}
            value={load.productWeightG ?? ""}
            onChange={(event) => set({ productWeightG: whole(event.target.value, 100000) })}
            unit={t("grams")}
          />
        </Field>
        <Field label={t("units")} hint={t("unitsHint")}>
          <NumberInput
            min={1}
            max={10000}
            value={load.unitsPerBox ?? ""}
            onChange={(event) => set({ unitsPerBox: whole(event.target.value, 10000) })}
            unit={t("pieces")}
          />
        </Field>
        <Field label={t("stack")} hint={t("stackHint")}>
          <NumberInput
            min={1}
            max={100}
            value={load.stackLayers ?? ""}
            onChange={(event) => set({ stackLayers: whole(event.target.value, 100) })}
            unit={t("layers")}
          />
        </Field>
      </div>

      <Field label={t("fragility")} hint={t("defaultHint")}>
        <RadioCards
          columns={3}
          value={load.fragility ?? undefined}
          onValueChange={(fragility) => set({ fragility: fragility as LoadInput["fragility"] })}
          options={FRAGILITY.map((value) => ({
            value,
            label: t(`fragilities.${value}.label`),
            description: t(`fragilities.${value}.description`),
          }))}
        />
      </Field>
      <Field label={t("transport")}>
        <RadioCards
          columns={2}
          value={load.transportMode ?? undefined}
          onValueChange={(transportMode) => set({ transportMode: transportMode as LoadInput["transportMode"] })}
          options={TRANSPORT.map((value) => ({
            value,
            label: t(`transports.${value}.label`),
            description: t(`transports.${value}.description`),
          }))}
        />
      </Field>
      <Field label={t("humidity")}>
        <RadioCards
          columns={2}
          value={load.humidity ?? undefined}
          onValueChange={(humidity) => set({ humidity: humidity as LoadInput["humidity"] })}
          options={HUMIDITY.map((value) => ({
            value,
            label: t(`humidities.${value}.label`),
            description: t(`humidities.${value}.description`),
          }))}
        />
      </Field>
      <Field label={t("storage")}>
        <RadioCards
          columns={2}
          value={load.storage ?? undefined}
          onValueChange={(storage) => set({ storage: storage as LoadInput["storage"] })}
          options={STORAGE.map((value) => ({ value, label: t(`storages.${value}`) }))}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <Switch
          checked={load.pallet !== null}
          onCheckedChange={(on) => set({ pallet: on ? { pattern: "column", overhang: false } : null })}
          label={t("pallet")}
          description={t("palletHint")}
        />
        {load.pallet ? (
          <div className="bg-surface border-border flex flex-col gap-3 rounded-lg border p-3">
            <Field label={t("palletPattern")}>
              <RadioCards
                columns={2}
                value={load.pallet.pattern}
                onValueChange={(pattern) =>
                  set({ pallet: { ...load.pallet!, pattern: pattern as Schemas["AdvisoryPalletPattern"] } })
                }
                options={(["column", "interlocked"] as const).map((value) => ({
                  value,
                  label: t(`palletPatterns.${value}.label`),
                  description: t(`palletPatterns.${value}.description`),
                }))}
              />
            </Field>
            <Checkbox
              checked={load.pallet.overhang}
              onCheckedChange={(next) => set({ pallet: { ...load.pallet!, overhang: next === true } })}
              label={t("overhang")}
              description={t("overhangHint")}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
