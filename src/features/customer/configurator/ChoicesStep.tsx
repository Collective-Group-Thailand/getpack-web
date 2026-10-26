"use client";

import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { Badge } from "@/ui/components/Badge";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { NumberInput } from "@/ui/components/Input";
import { MaterialSwatch } from "@/ui/components/MaterialSwatch";
import { RadioCards } from "@/ui/components/RadioCards";

import {
  isProcessInk,
  optionsById,
  placementOf,
  toggleChoice,
  type ChoiceGroup,
  type Placement,
  type StoreOption,
} from "./model";
import {
  partsOf,
  printOfPart,
  type AreaInput,
  type Configurator,
  type ConfiguratorState,
  type PartPrint,
} from "./state";
import { GlossaryChip } from "@/features/customer/learn/GlossaryChip";
import { materialNoteKey } from "./material-notes";
import { PriceSlot, useOptionFigures } from "./OptionFigure";
import { materialKey, type OptionPrices } from "./option-prices";
import { PrintSideChoice } from "./PrintSideChoice";
import { isCorrugate } from "./print-model";

/** "None" for a single-choice group the customer may leave unanswered. */
const NONE = "__none__";

interface ChoicesStepProps {
  configurator: Configurator;
  groups: ChoiceGroup[];
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** Group kinds with a required answer still missing — shown as an error on that group. */
  missing: Set<string>;
  /** The price change of each material and print card against the current selection (the batch answer). */
  prices: OptionPrices;
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
    <div className="bg-surface border-border ms-7 mt-2 grid grid-cols-3 gap-2 rounded-lg border p-3">
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
 * pass (CMYK), any other ink one colour. A corrugate side is one method from the product's print
 * model (D-443, `PrintSideChoice`). Corrugated boxes also ask where the colours print. Group
 * names are the storefront's, per kind — the API publishes the options only. A box of several
 * parts (a telescope body and lid) prints alike unless the customer prints each part on its own;
 * every part is priced either way.
 */
export function ChoicesStep({ configurator, groups, state, onChange, missing, prices }: ChoicesStepProps) {
  const t = useTranslations("configurator.choices");
  const tNotes = useTranslations("configurator.materialNotes");
  const tOptions = useTranslations("configurator.options");
  const figures = useOptionFigures();
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
  /** A material's one line: the content file's sentence, else the API's own, else none (never invented). */
  const materialNote = (option: StoreOption) => {
    const key = materialNoteKey(option);
    if (key && tNotes.has(key)) return tNotes(key);
    return pick(locale, option.descriptionTh ?? "", option.descriptionEn) || undefined;
  };
  const isPrint = (group: ChoiceGroup): group is ChoiceGroup & { kind: keyof PartPrint } =>
    group.kind === "print_front" || group.kind === "print_back";
  const printing = groups.some(isPrint);
  const parts = printing ? partsOf(configurator, state) : [];
  const perPart = parts.length > 1 && parts.some((part) => state.partPrints[part.subPatternId]);
  const prints = perPart ? parts.map((part) => printOfPart(state, part.subPatternId)) : [printOfPart(state, undefined)];
  const anyColour = prints.some((print) => print.print_front.length + print.print_back.length > 0);
  const setPerPart = (next: boolean) => {
    if (next) {
      const box = printOfPart(state, undefined);
      onChange({ partPrints: Object.fromEntries(parts.map((part) => [part.subPatternId, box])) });
    } else {
      // The parts print alike again, as the first one did.
      const first = printOfPart(state, parts[0]?.subPatternId);
      onChange({ partPrints: {}, choices: { ...state.choices, ...first } });
    }
  };

  const byId = optionsById(configurator);
  const corrugate = isCorrugate(configurator);
  const optionList = (group: ChoiceGroup, chosen: string[], set: (ids: string[]) => void, placed: boolean) => {
    const hasSwatch = group.options.some((option) => option.swatchHex || option.imageUrl);
    return (
      <ul className="mt-1 flex flex-col gap-3">
        {group.options.map((option) => {
          const checked = chosen.includes(option.id);
          const placement = placed ? placementOf(group, option) : null;
          return (
            <li key={option.id} className="flex items-start gap-2">
              {hasSwatch ? <MaterialSwatch colour={option.swatchHex} imageUrl={option.imageUrl} size="sm" /> : null}
              <div className="min-w-0 flex-1">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => set(toggleChoice(group, byId, chosen, option.id, next === true))}
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
    );
  };
  const printHint = (
    <p className="text-muted text-xs">
      {t("ink.hint")} <GlossaryChip slug="offset" />
    </p>
  );

  return (
    <div className="flex flex-col gap-6">
      {parts.length > 1 ? (
        <Checkbox
          checked={perPart}
          onCheckedChange={(next) => setPerPart(next === true)}
          label={t("perPart.label")}
          description={t("perPart.description", { parts: parts.map((part) => part.name).join(", ") })}
        />
      ) : null}
      {perPart
        ? parts.map((part) => (
            <fieldset
              key={part.subPatternId}
              className="bg-surface border-border flex flex-col gap-4 rounded-lg border p-4"
            >
              <legend className="px-1 text-sm font-semibold">{part.name}</legend>
              {corrugate ? null : printHint}
              {groups.filter(isPrint).map((group) => {
                const print = printOfPart(state, part.subPatternId);
                return (
                  <fieldset key={group.kind} className="flex flex-col gap-2">
                    <legend className="text-sm font-medium">{t(`groups.${group.kind}`)}</legend>
                    {(() => {
                      const set = (ids: string[]) =>
                        onChange({
                          partPrints: { ...state.partPrints, [part.subPatternId]: { ...print, [group.kind]: ids } },
                        });
                      return corrugate ? (
                        <PrintSideChoice
                          configurator={configurator}
                          group={group}
                          ids={print[group.kind]}
                          onChange={set}
                          byId={byId}
                        />
                      ) : (
                        optionList(group, print[group.kind], set, false)
                      );
                    })()}
                  </fieldset>
                );
              })}
            </fieldset>
          ))
        : null}
      {groups.map((group) => {
        if (perPart && isPrint(group)) return null;
        const chosen = state.choices[group.kind] ?? [];
        const name = t(`groups.${group.kind}`);
        const hasSwatch = group.options.some((option) => option.swatchHex || option.imageUrl);
        // D-443: a corrugate side is one method (none / spot / CMYK), never a set of ticked inks.
        if (corrugate && isPrint(group)) {
          return (
            <Field key={group.kind} label={name}>
              <PrintSideChoice
                configurator={configurator}
                group={group}
                ids={chosen}
                onChange={(ids) => setChoice(group, ids)}
                byId={byId}
              />
            </Field>
          );
        }
        if (group.kind === "material") {
          return (
            <Field
              key={group.kind}
              label={name}
              labelHidden
              required={group.required}
              requiredLabel={t("required")}
              error={missing.has(group.kind) ? t("pickOne", { name }) : undefined}
            >
              <RadioCards
                columns={2}
                value={chosen[0]}
                onValueChange={(id) => setChoice(group, [id])}
                options={group.options.map((option) => {
                  const price = prices.price(materialKey(option.id));
                  return {
                    value: option.id,
                    label: pick(locale, option.nameTh, option.nameEn),
                    description: materialNote(option),
                    badge: option.isDefault ? (
                      <Badge size="sm" tone="neutral">
                        {tOptions("default")}
                      </Badge>
                    ) : undefined,
                    // The prototype's cards are text; only a real photo of the board earns the room.
                    visual: option.imageUrl ? (
                      <MaterialSwatch colour={option.swatchHex} imageUrl={option.imageUrl} size="md" />
                    ) : undefined,
                    trailing: (
                      <PriceSlot
                        pending={prices.pending}
                        unitPrice={price?.unitPrice}
                        className="min-w-[4.5rem] text-end"
                      >
                        {figures.delta(price, chosen[0] === option.id)}
                      </PriceSlot>
                    ),
                  };
                })}
              />
            </Field>
          );
        }
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
            {group.step === "printing" ? printHint : null}
            {optionList(group, chosen, (ids) => setChoice(group, ids), true)}
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
