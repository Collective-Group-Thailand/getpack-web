"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { TARGET, withTier, type Configurator, type ConfiguratorState } from "./state";

interface QuantityStepProps {
  configurator: Configurator;
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** The sales unit in the reader's language (`ชิ้น`, `ซอง`). */
  unit: string;
}

/**
 * The quantities to compare and the one to order. Several are priced at once so the customer
 * sees how the price per piece falls with the run (the dock's price breaks); the API caps how
 * many one calculation may price (`maxTiers`) and the range it accepts.
 *
 * And an optional target price per piece (U2.F1 §4, D-247): the API answers with the gap at each
 * quantity, and above it the ways to get there. It is the customer's private figure (D-190).
 */
export function QuantityStep({ configurator, state, onChange, unit }: QuantityStepProps) {
  const t = useTranslations("configurator.quantity");
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium" id="quantity-tiers-label">
          {t("tiers")}
        </p>
        <ul aria-labelledby="quantity-tiers-label" className="mt-2 flex flex-wrap gap-2">
          {state.quantities.map((quantity) => {
            const selected = quantity === state.quantity;
            return (
              <li
                key={quantity}
                className={cn(
                  "rounded-control flex items-center border",
                  selected ? "border-primary bg-primary-subtle" : "border-border-strong",
                )}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ quantity })}
                  className="min-h-9 rounded-s-full ps-3 pe-2 text-sm font-medium tabular-nums"
                >
                  {t("tier", { quantity: format.number(quantity), unit })}
                </button>
                {state.quantities.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => remove(quantity)}
                    aria-label={t("remove", { quantity: format.number(quantity), unit })}
                    className="text-muted hover:text-fg flex min-h-9 items-center rounded-e-full ps-1 pe-2.5"
                  >
                    <Icon name="close" size={14} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="text-muted mt-2 text-xs">{t("selectedHint")}</p>
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

      <Field
        label={t("target")}
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
    </div>
  );
}
