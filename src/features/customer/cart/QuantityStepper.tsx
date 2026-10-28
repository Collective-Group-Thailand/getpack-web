"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * The cart line's quantity (checkout redesign item 2): − / + move by the step the API names
 * (`CartDto.quantityStep`, `storefront.cart_quantity_step`), never below the product's minimum (`quantityLimits.min`)
 * nor above its maximum; a typed quantity is any whole number in that range. Nothing is priced here: the change is
 * sent once the customer pauses (buttons) or leaves the field / presses Enter, and the API prices it.
 */
export function QuantityStepper({
  value,
  step,
  min,
  max,
  unit,
  pending,
  onCommit,
}: {
  value: number;
  /** Null: the buttons are not shown, the field still takes a typed quantity. */
  step: number | null;
  min: number;
  max: number | null;
  unit: string;
  pending: boolean;
  onCommit: (quantity: number) => void;
}) {
  const t = useTranslations("cart");
  const format = useFormat();
  const id = useId();
  // What the customer is typing or nudging; null shows the quantity the API holds.
  const [typed, setDraft] = useState<string | null>(null);
  const draft = typed ?? String(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const clamp = (n: number) => Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, Math.round(n)));
  const commit = (raw: string) => {
    const n = Number(raw);
    setDraft(null);
    if (!Number.isFinite(n) || raw.trim() === "") return;
    const next = clamp(n);
    if (next !== value) onCommit(next);
  };
  const nudge = (delta: number) => {
    const next = clamp((Number(draft) || value) + delta);
    setDraft(String(next));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDraft(null);
      if (next !== value) onCommit(next);
    }, 600);
  };
  const current = Number(draft) || value;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-muted text-[12.5px]">
        {t("quantity")}
      </label>
      <span
        className={cn(
          "border-border bg-surface inline-flex items-center overflow-hidden rounded-lg border",
          pending && "opacity-60",
        )}
      >
        {step ? (
          <button
            type="button"
            className="bg-bg-subtle hover:bg-border/60 focus-visible:ring-focus-ring grid h-9.5 w-9 place-items-center outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:opacity-40"
            aria-label={t("decrease", { step: format.number(step) })}
            aria-controls={id}
            disabled={current <= min}
            onClick={() => nudge(-step)}
          >
            <Icon name="minus" size={16} aria-hidden="true" />
          </button>
        ) : null}
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max ?? undefined}
          step={step ?? 1}
          value={draft}
          aria-describedby={`${id}-hint`}
          className="focus-visible:ring-focus-ring h-9.5 w-21 [appearance:textfield] border-0 bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit((event.target as HTMLInputElement).value);
            }
          }}
        />
        {step ? (
          <button
            type="button"
            className="bg-bg-subtle hover:bg-border/60 focus-visible:ring-focus-ring grid h-9.5 w-9 place-items-center outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:opacity-40"
            aria-label={t("increase", { step: format.number(step) })}
            aria-controls={id}
            disabled={max !== null && current >= max}
            onClick={() => nudge(step)}
          >
            <Icon name="plus" size={16} aria-hidden="true" />
          </button>
        ) : null}
      </span>
      <span id={`${id}-hint`} className="sr-only">
        {unit} · {t("quantityMin", { min: format.number(min) })}
      </span>
    </div>
  );
}
