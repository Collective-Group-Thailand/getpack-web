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
  /** `lg`: the 52 px sign-in field with the flag (UX audit, sign-in). */
  size?: "md" | "lg";
  className?: string;
}

/** The dialling code shown beside the field. Thailand only, until getpack sells abroad. */
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
 * `0812345678` → `081 234 5678`, and a number typed without its leading zero (`812345678`) →
 * `81 234 5678`: groups a person can read back, while the value stays digits only.
 */
export function formatThaiMobile(digits: string): string {
  const lead = digits.startsWith("0") ? 3 : 2;
  return [digits.slice(0, lead), digits.slice(lead, lead + 3), digits.slice(lead + 3)].filter(Boolean).join(" ");
}

/**
 * Whether `digits` is a whole Thai mobile number: ten digits from `0`, or nine typed without the
 * leading zero after the `+66` prefix (`8x`, `9x`, `6x`) — getpack-api normalises both to E.164.
 */
export function isThaiMobile(digits: string): boolean {
  return /^0[689]\d{8}$/.test(digits) || /^[689]\d{8}$/.test(digits);
}

function ThaiFlag() {
  return (
    <svg viewBox="0 0 24 16" width="22" height="15" aria-hidden="true">
      <rect width="24" height="16" fill="#A51931" />
      <rect y="2.7" width="24" height="10.6" fill="#F4F5F8" />
      <rect y="5.3" width="24" height="5.4" fill="#2D2A4A" />
    </svg>
  );
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
export function PhoneInput({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  size = "md",
  className,
}: PhoneInputProps) {
  const fieldProps = useFieldProps();
  const isDisabled = disabled ?? fieldProps.disabled;

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "border-border-strong rounded-control flex items-center border",
          size === "lg"
            ? "bg-surface text-fg h-13 gap-2 px-3.5 text-base font-semibold"
            : "bg-surface-subtle text-muted h-10 px-3 text-sm",
          isDisabled && "text-subtle",
        )}
      >
        {size === "lg" ? <ThaiFlag /> : null}
        {TH_DIALLING_CODE}
      </span>
      <input
        {...fieldProps}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={formatThaiMobile(value)}
        placeholder={placeholder}
        onChange={(event) => onChange(normaliseThaiMobile(event.target.value))}
        onBlur={onBlur}
        disabled={isDisabled}
        className={cn(
          controlVariants({ inputSize: size === "lg" ? "lg" : "md" }),
          "flex-1 tabular-nums",
          size === "lg" && "h-13 text-lg tracking-wide",
        )}
      />
    </div>
  );
}
