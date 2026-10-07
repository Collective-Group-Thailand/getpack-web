"use client";

import { useId } from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface CheckboxProps extends Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "children"> {
  /** Rendered beside the box and wired to it, so the whole row is the hit target. */
  label: React.ReactNode;
  description?: React.ReactNode;
  /** `sm`: a 12px label on one line beside the box — a consent line under a form (home newsletter). */
  size?: "md" | "sm";
}

/**
 * A checkbox whose label is part of the component: a bare box with the label somewhere else
 * is the most common a11y defect in a form, so the API does not allow it.
 */
export function Checkbox({ label, description, size = "md", className, id, ...props }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const descriptionId = description ? `${checkboxId}-description` : undefined;

  return (
    <div className={cn("flex gap-2.5", size === "sm" && "items-center gap-2", className)}>
      <CheckboxPrimitive.Root
        id={checkboxId}
        aria-describedby={descriptionId}
        className={cn(
          "border-border-strong bg-surface grid size-5 shrink-0 place-items-center rounded-sm border",
          size === "md" && "mt-0.5",
          "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-fg",
          "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-fg",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator>
          <Icon name={props.checked === "indeterminate" ? "minus" : "check"} size={14} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>

      <div className="min-w-0">
        <label htmlFor={checkboxId} className={size === "sm" ? "text-xs leading-4" : "text-sm leading-normal"}>
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-muted text-xs">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
