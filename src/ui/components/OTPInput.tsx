"use client";

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
export function OTPInput({ value, onChange, onBlur, length, disabled, onComplete, className }: OTPInputProps) {
  const fieldProps = useFieldProps();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Keep only digits, so a pasted "123 456" — or "รหัส 123456" out of an SMS — still works.
    const digits = event.target.value.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  }

  return (
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
      onBlur={onBlur}
      disabled={disabled ?? fieldProps.disabled}
      className={cn(
        controlVariants({ inputSize: "lg" }),
        // The indent matches the tracking so the digits stay optically centred: letter
        // spacing is added after each character, including the last.
        "text-center indent-[0.5em] font-mono tracking-[0.5em] tabular-nums",
        className,
      )}
    />
  );
}
