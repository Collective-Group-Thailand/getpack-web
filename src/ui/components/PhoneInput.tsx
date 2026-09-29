"use client";

import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";
import { cn } from "../lib/cn";

export interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/** The dialling code shown beside the field. Thailand only, until Packio sells abroad. */
export const TH_DIALLING_CODE = "+66";

/**
 * Digits only, at most the ten a Thai mobile number has.
 *
 * Kept in the national form (`0812345678`) rather than normalised to E.164 here: the API
 * normalises it, and a field that rewrites what someone typed while they are typing is a
 * field that fights them.
 */
export function normaliseThaiMobile(input: string): string {
  return input.replace(/\D/g, "").slice(0, 10);
}

/**
 * A Thai mobile number field.
 *
 * `+66` sits beside the input as static text rather than inside the value, so what someone
 * types is exactly what they would read off their own phone — `081 234 5678` — and the caret
 * never has to step over a prefix it is not allowed to delete. It is `aria-hidden` because
 * the field's own label and hint already say which number is wanted, and a screen reader
 * reading "plus sixty-six" before an empty field is noise.
 */
export function PhoneInput({ value, onChange, onBlur, disabled, placeholder, className }: PhoneInputProps) {
  const fieldProps = useFieldProps();
  const isDisabled = disabled ?? fieldProps.disabled;

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "border-border-strong bg-surface-subtle text-muted rounded-control flex h-10 items-center border px-3 text-sm",
          isDisabled && "text-subtle",
        )}
      >
        {TH_DIALLING_CODE}
      </span>
      <input
        {...fieldProps}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(normaliseThaiMobile(event.target.value))}
        onBlur={onBlur}
        disabled={isDisabled}
        className={cn(controlVariants({ inputSize: "md" }), "flex-1")}
      />
    </div>
  );
}
