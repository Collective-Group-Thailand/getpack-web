"use client";

import { useState } from "react";

import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";
import { cn } from "../lib/cn";

export interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Digits the API says the code has — never assumed to be 6 (see docs/contract-requests.md). */
  length: number;
  disabled?: boolean;
  /** Called once the field holds a full-length code, so the form can submit itself. */
  onComplete?: (value: string) => void;
  /**
   * `boxes`: one box per digit, 64 px (UX audit, sign-in) — drawn over the same single input, so
   * pasting, SMS autofill and a screen reader behave exactly as with `field`.
   */
  appearance?: "field" | "boxes";
  /** The field is wrong (an error message sits under it). */
  invalid?: boolean;
  className?: string;
}

/**
 * A one-time-code field.
 *
 * Deliberately **one** `<input>`, not a row of single-character boxes. WCAG 2.2 §3.3.8
 * (Accessible Authentication) requires that a code can be pasted, and split boxes are where
 * that usually breaks: paste lands in the first box, autofill has no single target, and a
 * screen reader announces six unlabelled fields. `inputMode="numeric"` raises the number pad,
 * `autocomplete="one-time-code"` lets iOS and Android fill it straight from the SMS, and the
 * letter spacing gives the same "this is a code" affordance the boxes were drawn for.
 *
 * It composes `controlVariants` rather than restyling, so it inherits the invalid border, the
 * disabled treatment and the product's one focus ring (design-system.md §8).
 */
export function OTPInput({
  value,
  onChange,
  onBlur,
  length,
  disabled,
  onComplete,
  appearance = "field",
  invalid,
  className,
}: OTPInputProps) {
  const fieldProps = useFieldProps();
  const [focused, setFocused] = useState(false);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Keep only digits, so a pasted "123 456" — or "รหัส 123456" out of an SMS — still works.
    const digits = event.target.value.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  }

  const input = (boxes: boolean) => (
    <input
      {...fieldProps}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      // Neither spellcheck nor autocorrect has anything useful to say about a numeric code.
      spellCheck={false}
      autoCorrect="off"
      // Deliberately no `maxLength`: the browser applies it to the raw text before any
      // handler runs, so pasting the whole SMS — "รหัส OTP ของคุณคือ 123456" — would be cut
      // to its first six characters and leave one digit behind. The slice below is the
      // limit, applied after the non-digits are gone.
      value={value}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      aria-invalid={invalid || fieldProps["aria-invalid"] || undefined}
      disabled={disabled ?? fieldProps.disabled}
      className={
        boxes
          ? // Over the boxes, invisible but real: it takes the taps, the keys and the paste.
            "absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
          : cn(
              controlVariants({ inputSize: "lg" }),
              // The indent matches the tracking so the digits stay optically centred: letter
              // spacing is added after each character, including the last.
              "text-center indent-[0.5em] tracking-[0.5em] tabular-nums",
              className,
            )
      }
    />
  );

  if (appearance === "field") return input(false);

  const active = Math.min(value.length, length - 1);
  return (
    <div
      className={cn("relative grid gap-2 sm:gap-2.5", className)}
      style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
    >
      {Array.from({ length }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            "rounded-control bg-surface flex h-14 items-center justify-center border text-2xl font-semibold tabular-nums transition-colors sm:h-16",
            invalid ? "border-danger" : "border-border-strong",
            focused && index === active && !invalid && "border-primary ring-primary/25 ring-4",
            disabled && "opacity-60",
          )}
        >
          {value[index] ?? ""}
        </span>
      ))}
      {input(true)}
    </div>
  );
}
