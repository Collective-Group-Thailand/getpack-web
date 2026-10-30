"use client";

import { cn } from "@/ui/lib/cn";

const CHIP = "rounded-control border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50";
// Selected in brand green (Project A: selected states are green, never a black chip).
const ON = "border-primary bg-primary text-primary-fg";
const OFF = "border-border-strong bg-surface text-muted hover:text-fg";

/** One choice among chips (`role="radio"`), for the reply channel, a call-back day and a slot. */
export function RadioChips<T extends string>({
  label,
  value,
  options,
  onChange,
  invalid,
  describedBy,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      tabIndex={invalid ? -1 : undefined}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(CHIP, option.value === value ? ON : OFF)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Several choices among chips (toggle buttons, `aria-pressed`), for capabilities and interests. */
export function ToggleChips<T extends string>({
  label,
  values,
  options,
  onChange,
  invalid,
  describedBy,
}: {
  label: string;
  values: T[];
  options: { value: T; label: React.ReactNode }[];
  onChange: (values: T[]) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-invalid={invalid || undefined}
      aria-describedby={describedBy}
      tabIndex={invalid ? -1 : undefined}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => {
        const on = values.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((item) => item !== option.value) : [...values, option.value])}
            className={cn(CHIP, on ? "border-primary bg-primary text-primary-fg" : OFF)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
