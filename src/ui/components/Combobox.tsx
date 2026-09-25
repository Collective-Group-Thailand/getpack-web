"use client";

import { useId, useRef, useState } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";
import { Spinner } from "./Spinner";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

export interface ComboboxProps {
  /** The chosen option, or `null`. */
  value: ComboboxOption | null;
  onValueChange: (option: ComboboxOption | null) => void;
  /** What has been typed — the caller fetches `options` for it (async, server-side search). */
  query: string;
  onQueryChange: (query: string) => void;
  options: readonly ComboboxOption[];
  loading?: boolean;
  placeholder?: string;
  labels: { loading: string; empty: string; clear: string };
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * An editable combobox (WAI-ARIA 1.2 pattern) for choosing one record from a long, remote list —
 * a customer by phone, a factory, a staff member to delegate to (design-system.md §3).
 *
 * Focus never leaves the input: the active option is `aria-activedescendant`, tracked by option
 * **value** so a result set that changes while someone arrows through it cannot leave the
 * pointer on an element that no longer exists (the same lesson as the command palette).
 */
export function Combobox({
  value,
  onValueChange,
  query,
  onQueryChange,
  options,
  loading = false,
  placeholder,
  labels,
  disabled,
  className,
  ...props
}: ComboboxProps) {
  const fieldProps = useFieldProps();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeIndex = options.findIndex((option) => option.value === activeValue);
  const optionId = (option: ComboboxOption) => `${listId}-${option.value}`;

  function choose(option: ComboboxOption) {
    onValueChange(option);
    onQueryChange("");
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (options.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next =
        activeIndex < 0 ? (step > 0 ? 0 : options.length - 1) : (activeIndex + step + options.length) % options.length;
      setActiveValue(options[next]!.value);
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      choose(options[activeIndex]!);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      } else if (query) {
        onQueryChange("");
      }
    }
  }

  const showList = open && !disabled;
  const displayValue = open || !value ? query : value.label;

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeIndex >= 0 ? optionId(options[activeIndex]!) : undefined}
        aria-label={props["aria-label"]}
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={displayValue}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(true);
          setActiveValue(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(controlVariants(), value ? "pe-9" : undefined)}
        {...fieldProps}
      />
      {value && !disabled ? (
        <button
          type="button"
          aria-label={labels.clear}
          className="text-muted hover:text-fg absolute end-2 top-1/2 -translate-y-1/2 rounded-sm p-1"
          onClick={() => {
            onValueChange(null);
            inputRef.current?.focus();
          }}
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}

      <ul
        id={listId}
        role="listbox"
        hidden={!showList}
        className="border-border bg-surface-raised z-modal absolute inset-x-0 top-full mt-1 max-h-64 overflow-y-auto rounded-lg border p-1 shadow-lg"
      >
        {loading ? (
          <li role="presentation" className="text-muted flex items-center gap-2 px-2 py-2 text-sm">
            <Spinner label={null} size={16} />
            {labels.loading}
          </li>
        ) : options.length === 0 ? (
          <li role="presentation" className="text-muted px-2 py-2 text-sm">
            {labels.empty}
          </li>
        ) : (
          options.map((option) => (
            <li
              key={option.value}
              id={optionId(option)}
              role="option"
              aria-selected={option.value === value?.value}
              // `mousedown` so the choice lands before the input's blur closes the list.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseMove={() => setActiveValue(option.value)}
              className={cn(
                "cursor-default rounded-md px-2 py-2 text-sm",
                option.value === activeValue && "bg-primary-subtle text-primary-subtle-fg",
              )}
            >
              <span className="block">{option.label}</span>
              {option.description ? <span className="text-muted block text-xs">{option.description}</span> : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
