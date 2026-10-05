"use client";

import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { NumberInput } from "@/ui/components/Input";
import { MaterialSwatch } from "@/ui/components/MaterialSwatch";
import { RadioCards } from "@/ui/components/RadioCards";

import { isProcessInk, placementOf, type ChoiceGroup, type Placement, type StoreOption } from "./model";
import type { AreaInput, Configurator, ConfiguratorState } from "./state";
import { GlossaryChip } from "@/features/customer/learn/GlossaryChip";

/** "None" for a single-choice group the customer may leave unanswered. */
const NONE = "__none__";

interface ChoicesStepProps {
  configurator: Configurator;
  groups: ChoiceGroup[];
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** Group kinds with a required answer still missing — shown as an error on that group. */
  missing: Set<string>;
}

function AreaFields({
  placement,
  value,
  onChange,
}: {
  placement: Placement;
  value: AreaInput | undefined;
  onChange: (area: AreaInput) => void;
}) {
  const t = useTranslations("configurator.choices");
  const current: AreaInput = value ?? { amount: 1, widthMm: null, lengthMm: null };
  const toNumber = (text: string) => (text.trim() === "" ? null : Math.max(0, Math.round(Number(text))));
  return (
    <div className="border-border ms-7 mt-2 grid grid-cols-3 gap-2 rounded-lg border p-3">
      <Field label={t("areaAmount")} className="col-span-1">
        <NumberInput
          min={1}
          value={current.amount || ""}
          onChange={(event) => onChange({ ...current, amount: toNumber(event.target.value) ?? 0 })}
          unit={t("areaAmountUnit")}
        />
      </Field>
      {placement.requiresWidth ? (
        <Field label={t("areaWidth")} required>
          <NumberInput
            min={1}
            value={current.widthMm ?? ""}
            onChange={(event) => onChange({ ...current, widthMm: toNumber(event.target.value) })}
            unit={t("mm")}
          />
        </Field>
      ) : null}
      {placement.requiresLength ? (
        <Field label={t("areaLength")} required>
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
 * the decision is made (design-system.md §1.5): a swatch and the catalogue's own sentence.
 *
 * Printing (U2.F1): the ink colours the product offers, per side; a process ink is one full-colour
 * pass (CMYK), any other ink one colour. Corrugated boxes also ask where the colours print. Group
 * names are the storefront's, per kind — the API publishes the options only.
 */
export function ChoicesStep({ configurator, groups, state, onChange, missing }: ChoicesStepProps) {
  const t = useTranslations("configurator.choices");
  const locale = useLocale();

  const setChoice = (group: ChoiceGroup, ids: string[]) =>
    onChange({
      choices: { ...state.choices, [group.kind]: ids },
      // A recommendation is for the board it named; another material leaves it (D-240).
      ...(group.kind === "material" ? { advisory: null } : {}),
    });
  const describe = (group: ChoiceGroup, option: StoreOption) => {
    const own = pick(locale, option.descriptionTh ?? "", option.descriptionEn) || undefined;
    if (group.step !== "printing") return own;
    const kind = typeof option.attributes?.colourKind === "string" ? option.attributes.colourKind : null;
    const note = isProcessInk(option) ? t("ink.process") : kind ? t(`ink.${kind}`) : null;
    return [note, own].filter(Boolean).join(" · ") || undefined;
  };
  const printing = groups.some((group) => group.kind === "print_front" || group.kind === "print_back");
  const anyColour = (state.choices.print_front?.length ?? 0) + (state.choices.print_back?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const chosen = state.choices[group.kind] ?? [];
        const name = t(`groups.${group.kind}`);
        const hasSwatch = group.options.some((option) => option.swatchHex || option.imageUrl);
        if (group.selection === "single") {
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
                  ...(group.required ? [] : [{ value: NONE, label: t(`none.${group.kind}`) }]),
                  ...group.options.map((option) => ({
                    value: option.id,
                    label: pick(locale, option.nameTh, option.nameEn),
                    description: describe(group, option),
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
            {group.step === "printing" ? (
              <p className="text-muted text-xs">
                {t("ink.hint")} <GlossaryChip slug="offset" /> <GlossaryChip slug="digital-print" />
              </p>
            ) : null}
            <ul className="mt-1 flex flex-col gap-3">
              {group.options.map((option) => {
                const checked = chosen.includes(option.id);
                const placement = placementOf(group, option);
                return (
                  <li key={option.id} className="flex items-start gap-2">
                    {hasSwatch ? (
                      <MaterialSwatch colour={option.swatchHex} imageUrl={option.imageUrl} size="sm" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) =>
                          setChoice(
                            group,
                            next === true ? [...chosen, option.id] : chosen.filter((id) => id !== option.id),
                          )
                        }
                        label={pick(locale, option.nameTh, option.nameEn)}
                        description={describe(group, option)}
                      />
                      {checked && placement ? (
                        <AreaFields
                          placement={placement}
                          value={state.areas[option.id]}
                          onChange={(area) => onChange({ areas: { ...state.areas, [option.id]: area } })}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}

      {printing && configurator.printAreas.length > 0 && anyColour ? (
        <Field label={t("printArea")} hint={t("printAreaHint")}>
          <RadioCards
            columns={2}
            value={state.printArea ?? configurator.printAreas[0]}
            onValueChange={(printArea) => onChange({ printArea: printArea as ConfiguratorState["printArea"] })}
            options={configurator.printAreas.map((area) => ({ value: area, label: t(`printAreas.${area}`) }))}
          />
        </Field>
      ) : null}
    </div>
  );
}
