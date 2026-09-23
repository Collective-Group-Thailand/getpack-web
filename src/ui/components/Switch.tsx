"use client";

import { useId } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "../lib/cn";

export interface SwitchProps extends Omit<React.ComponentProps<typeof SwitchPrimitive.Root>, "children"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Put the label first — the usual reading order for a settings row. */
  labelPosition?: "start" | "end";
}

/**
 * An immediate on/off setting. Use a Checkbox instead when the value is only committed on
 * submit: a switch that needs a Save button lies about what it does.
 */
export function Switch({ label, description, labelPosition = "end", className, id, ...props }: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const descriptionId = description ? `${switchId}-description` : undefined;

  const control = (
    <SwitchPrimitive.Root
      id={switchId}
      aria-describedby={descriptionId}
      className={cn(
        "bg-neutral-subtle relative h-6 w-11 shrink-0 rounded-full border border-transparent transition-colors",
        "duration-fast ease-standard data-[state=checked]:bg-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "bg-surface duration-fast ease-standard block size-5 rounded-full shadow-sm transition-transform",
          "translate-x-0.5 data-[state=checked]:translate-x-5",
        )}
      />
    </SwitchPrimitive.Root>
  );

  const text = (
    <div className="min-w-0">
      <label htmlFor={switchId} className="text-sm">
        {label}
      </label>
      {description ? (
        <p id={descriptionId} className="text-muted text-xs">
          {description}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {labelPosition === "start" ? (
        <>
          {text}
          <span className="ms-auto">{control}</span>
        </>
      ) : (
        <>
          {control}
          {text}
        </>
      )}
    </div>
  );
}
