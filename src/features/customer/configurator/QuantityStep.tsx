"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Button } from "@/ui/components/Button";
import { DisclosureList } from "@/ui/components/DisclosureList";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";

import { PriceSlot } from "./OptionFigure";
import type { PriceStep } from "./pricing";
import { TARGET, withTier, type Configurator, type ConfiguratorState } from "./state";
import { mergeEqualTiers, tierRowLabels } from "./tiers";

interface QuantityStepProps {
  configurator: Configurator;
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** The sales unit in the reader's language (`ชิ้น`, `ซอง`). */
  unit: string;
  /** What the calculation priced at every quantity on screen (the API's own figures). */
  steps: PriceStep[] | undefined;
  /** A new price is on its way: the figures on the cards are the last ones, dimmed. */
  pending: boolean;
}

/**
 * The quantities to compare and the one to order, as cards (the prototype's `.qgrid`): the smallest
 * first, each with the API's price per piece at that quantity, the selected one highlighted. Quantities
 * the API prices at the same figure share a card ("100–500"), as the price table used to merge them.
 * A card shows the API's `savingPercent` of its quantity ("ประหยัด 12%", C4-API-2); none is computed here.
 *
 * A quantity of the customer's own is added through the field under the cards: it must fit the API's
 * range and the number of quantities it prices at once (`maxTiers`), and the new card is priced by the
 * ordinary calculation. An optional target per piece (U2.F1 §4, D-247) sits behind a collapsed
 * disclosure: the API answers with the gap at each quantity; it is the customer's private figure (D-190).
 */
export function QuantityStep({ configurator, state, onChange, unit, steps, pending }: QuantityStepProps) {
  const t = useTranslations("configurator.quantity");
  const tOptions = useTranslations("configurator.options");
  const format = useFormat();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { min, max, maxTiers, presets } = configurator.quantity;

  // The range is the API's; where it publishes none, any whole number is sent and the API decides.
  const range = min !== null && max !== null ? { min: format.number(min), max: format.number(max), unit } : null;

  const add = (quantity: number) => {
    const next = withTier(configurator, state.quantities, quantity);
    if (!next) {
      setError(
        state.quantities.length >= maxTiers
          ? t("tooMany", { count: maxTiers })
          : range
            ? t("outOfRange", range)
            : t("invalid"),
      );
      return false;
    }
    setError(null);
    onChange({ quantities: next, quantity });
    return true;
  };

  const remove = (quantity: number) => {
    const next = state.quantities.filter((value) => value !== quantity);
    if (next.length === 0) return;
    onChange({ quantities: next, quantity: state.quantity === quantity ? next[0]! : state.quantity });
  };

  // One step per quantity on screen: the API's where it has priced it, else a placeholder with no figure.
  const known = new Map((steps ?? []).map((step) => [step.quantity, step]));
  const cards = mergeEqualTiers(
    state.quantities.map(
      (quantity) =>
        known.get(quantity) ?? ({ quantity, instant: false, unitPrice: null, reason: null } as unknown as PriceStep),
    ),
  );
  const labelsOf = (group: (typeof cards)[number]) =>
    tierRowLabels(group, {
      number: (value) => format.number(value),
      range: (from, to) => `${from}–${to}`,
      withUnit: (quantity) => `${quantity} ${unit}`,
    });
  const figureOf = (group: (typeof cards)[number]) => {
    if (!known.has(group.first.quantity)) return "";
    if (!group.first.instant || !group.first.unitPrice) return tOptions("quoteOnly");
    return tOptions("perPiece", { price: format.thb(group.first.unitPrice), unit });
  };
  // C4-API-2: the API's saving for the card's quantity (null for the smallest priced tier and unpriced ones).
  const savingOf = (group: (typeof cards)[number]) =>
    known.has(group.first.quantity) && group.first.instant ? (group.first.savingPercent ?? null) : null;
  const selected = cards.find((group) => group.steps.some((step) => step.quantity === state.quantity));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <RadioCards
          columns={4}
          aria-label={t("tiers")}
          value={selected ? String(selected.first.quantity) : undefined}
          onValueChange={(key) => {
            // A card of several quantities keeps the one already chosen inside it.
            const group = cards.find((candidate) => String(candidate.first.quantity) === key);
            if (group && !group.steps.some((step) => step.quantity === state.quantity))
              onChange({ quantity: group.first.quantity });
          }}
          options={cards.map((group) => ({
            value: String(group.first.quantity),
            label: <span className="text-base font-semibold tabular-nums">{labelsOf(group).quantity}</span>,
            description: (
              <>
                <PriceSlot pending={pending} unitPrice={known.has(group.first.quantity) ? group.first.unitPrice : null}>
                  {figureOf(group)}
                </PriceSlot>
                {savingOf(group) ? (
                  <span data-saving="" className="text-primary block text-[0.71875rem] leading-[1.2] font-semibold">
                    {t("saving", { percent: format.number(savingOf(group)!) })}
                  </span>
                ) : null}
              </>
            ),
          }))}
        />
        <p className="text-muted text-xs">{t("selectedHint")}</p>
        {state.quantities.length > 1 ? (
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(state.quantity)}>
              {t("remove", { quantity: format.number(state.quantity), unit })}
            </Button>
          </div>
        ) : null}
      </div>

      <form
        className="flex items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const quantity = Number(draft);
          if (add(quantity)) setDraft("");
        }}
      >
        <Field
          label={t("add")}
          hint={range ? t("range", range) : undefined}
          error={error ?? undefined}
          className="flex-1"
        >
          <NumberInput
            min={min ?? 1}
            max={max ?? undefined}
            step={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            unit={unit}
          />
        </Field>
        <Button type="submit" variant="secondary" className="mt-[1.625rem]" disabled={draft.trim() === ""}>
          {t("addButton")}
        </Button>
      </form>

      {presets.length > 0 ? (
        <div>
          <p className="text-muted text-xs">{t("presets")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {presets
              .filter((preset) => !state.quantities.includes(preset))
              .map((preset) => (
                <Button
                  key={preset}
                  size="sm"
                  variant="ghost"
                  iconStart="plus"
                  onClick={() => add(preset)}
                  disabled={state.quantities.length >= maxTiers}
                >
                  {t("tier", { quantity: format.number(preset), unit })}
                </Button>
              ))}
          </div>
        </div>
      ) : null}

      <DisclosureList
        items={[
          {
            summary: t("target"),
            defaultOpen: state.target !== "",
            content: (
              <div className="flex flex-col gap-2">
                <Field
                  label={t("targetLabel")}
                  hint={t("targetHint", { unit })}
                  error={state.target !== "" && !TARGET.test(state.target) ? t("targetInvalid") : undefined}
                >
                  <Input
                    inputMode="decimal"
                    autoComplete="off"
                    value={state.target}
                    onChange={(event) => onChange({ target: event.target.value.replace(/[^\d.]/g, "").slice(0, 12) })}
                    className="max-w-48 tabular-nums"
                  />
                </Field>
                <p className="text-muted m-0 text-xs">{t("targetPrivate")}</p>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
