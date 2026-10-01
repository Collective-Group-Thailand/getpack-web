"use client";

import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { NumberInput } from "@/ui/components/Input";
import { MaterialSwatch } from "@/ui/components/MaterialSwatch";
import { RadioCards } from "@/ui/components/RadioCards";

import type { AreaInput, ConfiguratorGroup, ConfiguratorOption, ConfiguratorState } from "./state";

/** "No coating" for a single-choice group the customer may leave unanswered. */
const NONE = "__none__";

interface ChoicesStepProps {
  groups: ConfiguratorGroup[];
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** Group kinds with a required answer still missing — shown as an error on that group. */
  missing: Set<string>;
}

function AreaFields({
  option,
  value,
  onChange,
}: {
  option: ConfiguratorOption;
  value: AreaInput | undefined;
  onChange: (area: AreaInput) => void;
}) {
  const t = useTranslations("configurator.choices");
  const area = option.area!;
  const current: AreaInput = value ?? { amount: 1, widthMm: null, lengthMm: null };
  const toNumber = (text: string) => (text.trim() === "" ? null : Math.max(0, Math.round(Number(text))));
  return (
    <div className="border-border ms-7 mt-2 grid grid-cols-3 gap-2 rounded-lg border p-3">
      <Field label={t("areaAmount")} className="col-span-1">
        <NumberInput
          min={1}
          max={area.maxAmount ?? undefined}
          value={current.amount || ""}
          onChange={(event) => onChange({ ...current, amount: toNumber(event.target.value) ?? 0 })}
          unit={t("areaAmountUnit")}
        />
      </Field>
      {area.requiresWidth ? (
        <Field label={t("areaWidth")} required={area.requiresWidth}>
          <NumberInput
            min={1}
            value={current.widthMm ?? ""}
            onChange={(event) => onChange({ ...current, widthMm: toNumber(event.target.value) })}
            unit={t("mm")}
          />
        </Field>
      ) : null}
      {area.requiresLength ? (
        <Field label={t("areaLength")} required={area.requiresLength}>
          <NumberInput
            min={1}
            value={current.lengthMm ?? ""}
            onChange={(event) => onChange({ ...current, lengthMm: toNumber(event.target.value) })}
            unit={t("mm")}
          />
        </Field>
      ) : null}
    </div>
  );
}

/**
 * The choice groups of one step (material, printing, finishing, assembly), each explained where
 * the decision is made (design-system.md §1.5): a swatch and a sentence per material.
 *
 * The group's name is the storefront's, per kind (the API publishes the options only).
 * CONTRACT-GAP store.configurator — no help text per group is published, so none is shown.
 */
export function ChoicesStep({ groups, state, onChange, missing }: ChoicesStepProps) {
  const t = useTranslations("configurator.choices");
  const locale = useLocale();

  const setChoice = (group: ConfiguratorGroup, ids: string[]) =>
    onChange({ choices: { ...state.choices, [group.kind]: ids } });

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const chosen = state.choices[group.kind] ?? [];
        const name = t(`groups.${group.kind}`);
        if (group.selection === "single") {
          const hasSwatch = group.options.some((option) => option.swatchHex || option.imageUrl);
          return (
            <Field
              key={group.kind}
              label={name}
              required={group.required}
              requiredLabel={t("required")}
              error={missing.has(group.kind) ? t("pickOne", { name }) : undefined}
            >
              <RadioCards
                columns={2}
                value={chosen[0] ?? (group.required ? undefined : NONE)}
                onValueChange={(id) => setChoice(group, id === NONE ? [] : [id])}
                options={[
                  ...(group.required ? [] : [{ value: NONE, label: t("none"), description: t("noneHint") }]),
                  ...group.options.map((option) => ({
                    value: option.id,
                    label: pick(locale, option.nameTh, option.nameEn),
                    description: pick(locale, option.descriptionTh ?? "", option.descriptionEn) || undefined,
                    visual: hasSwatch ? (
                      <MaterialSwatch colour={option.swatchHex} imageUrl={option.imageUrl} size="md" />
                    ) : undefined,
                  })),
                ]}
              />
            </Field>
          );
        }
        return (
          <fieldset key={group.kind} className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{name}</legend>
            <ul className="mt-1 flex flex-col gap-3">
              {group.options.map((option) => {
                const checked = chosen.includes(option.id);
                return (
                  <li key={option.id}>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        setChoice(
                          group,
                          next === true ? [...chosen, option.id] : chosen.filter((id) => id !== option.id),
                        )
                      }
                      label={pick(locale, option.nameTh, option.nameEn)}
                      description={pick(locale, option.descriptionTh ?? "", option.descriptionEn) || undefined}
                    />
                    {checked && option.area ? (
                      <AreaFields
                        option={option}
                        value={state.areas[option.id]}
                        onChange={(area) => onChange({ areas: { ...state.areas, [option.id]: area } })}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}
