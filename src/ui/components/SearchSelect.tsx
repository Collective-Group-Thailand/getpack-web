"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import { useId, useMemo, useRef, useState } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";

export interface SearchSelectOption<T extends string = string> {
  value: T;
  label: string;
  /** A second line under the label (a code, a unit). Searched too. */
  description?: string;
  disabled?: boolean;
}

export interface SearchSelectProps<T extends string = string> {
  value?: T | null;
  onValueChange?: (value: T) => void;
  options: SearchSelectOption<T>[];
  /** Shown when nothing is chosen. From `src/i18n`. */
  placeholder?: string;
  /** Copy from `src/i18n`: the search box's placeholder and the no-match line. */
  labels: { search: string; empty: string };
  /** Hide the search box for very short lists (it still opens the same list). Default: shown from 6 options. */
  searchFrom?: number;
  name?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Thai and English matched without case or tone-mark fuss: lower-cased, whitespace collapsed. */
const fold = (text: string) => text.toLocaleLowerCase("th").replace(/\s+/g, " ").trim();

/**
 * A single choice from a local list, with a search box at the top of the list — for lists an owner
 * would otherwise scroll through (materials, banks, product types, reasons). Same contract as
 * `Select` (value in, `onValueChange` out), so a screen swaps one for the other.
 *
 * The trigger is a button; the list is a listbox driven from the search input
 * (`aria-activedescendant`), so focus stays in the box while arrows move the highlight, Enter
 * picks, Escape closes and returns focus to the trigger (Radix Popover).
 */
export function SearchSelect<T extends string = string>({
  value,
  onValueChange,
  options,
  placeholder,
  labels,
  searchFrom = 6,
  name,
  disabled,
  className,
  ...props
}: SearchSelectProps<T>) {
  const fieldProps = useFieldProps();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<T | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const chosen = options.find((option) => option.value === value) ?? null;
  const searchable = options.length >= searchFrom;

  const shown = useMemo(() => {
    const q = fold(query);
    if (!q) return options;
    return options.filter((option) => fold(`${option.label} ${option.description ?? ""}`).includes(q));
  }, [options, query]);
  const enabled = shown.filter((option) => !option.disabled);

  function pick(option: SearchSelectOption<T>) {
    if (option.disabled) return;
    onValueChange?.(option.value);
    setOpen(false);
  }

  function move(step: 1 | -1) {
    if (!enabled.length) return;
    const index = enabled.findIndex((option) => option.value === active);
    const next = enabled[(index + step + enabled.length) % enabled.length]!;
    setActive(next.value);
    listRef.current?.querySelector(`[data-value="${CSS.escape(next.value)}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = enabled.find((item) => item.value === active) ?? (enabled.length === 1 ? enabled[0] : undefined);
      if (option) pick(option);
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActive(chosen?.value ?? enabled[0]?.value ?? null);
        }
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={fieldProps.id}
          aria-describedby={fieldProps["aria-describedby"]}
          aria-invalid={fieldProps["aria-invalid"]}
          aria-label={props["aria-label"]}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled ?? fieldProps.disabled}
          className={cn(controlVariants(), "flex items-center justify-between gap-2 text-start", className)}
        >
          {/* Muted, not subtle: this is text in a button, not a native placeholder, so it needs 4.5:1. */}
          <span className={cn("min-w-0 truncate", !chosen && "text-muted")}>{chosen?.label ?? placeholder}</span>
          <Icon name="chevron-down" size={18} className="text-muted shrink-0" />
        </button>
      </PopoverPrimitive.Trigger>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(event) => {
            // Focus the search box (or the list) instead of the first focusable thing.
            event.preventDefault();
            (listRef.current?.parentElement?.querySelector("input") ?? listRef.current)?.focus();
          }}
          className={cn(
            "z-modal border-border bg-surface-raised shadow-overlay flex flex-col rounded-lg border",
            "max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) min-w-56",
          )}
        >
          {searchable ? (
            <div className="border-border flex items-center gap-2 border-b px-3">
              <Icon name="search" size={16} className="text-muted shrink-0" />
              <input
                type="search"
                role="combobox"
                aria-controls={listId}
                aria-expanded
                aria-autocomplete="list"
                aria-activedescendant={active ? `${listId}-${active}` : undefined}
                aria-label={labels.search}
                placeholder={labels.search}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  const first = options.find(
                    (option) =>
                      !option.disabled &&
                      fold(`${option.label} ${option.description ?? ""}`).includes(fold(event.target.value)),
                  );
                  setActive(first?.value ?? null);
                }}
                onKeyDown={onKeyDown}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          ) : null}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={searchable ? -1 : 0}
            aria-label={props["aria-label"]}
            aria-activedescendant={!searchable && active ? `${listId}-${active}` : undefined}
            onKeyDown={searchable ? undefined : onKeyDown}
            className="min-h-0 flex-1 overflow-y-auto p-1 outline-none"
          >
            {shown.length ? (
              shown.map((option) => (
                <li
                  key={option.value}
                  id={`${listId}-${option.value}`}
                  data-value={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  onPointerMove={() => !option.disabled && setActive(option.value)}
                  onClick={() => pick(option)}
                  className={cn(
                    "flex cursor-default items-start gap-2 rounded-md px-2 py-2 text-sm",
                    option.value === active && "bg-primary-subtle text-primary-subtle-fg",
                    option.disabled && "pointer-events-none opacity-50",
                  )}
                >
                  <Icon
                    name="check"
                    size={16}
                    className={cn("mt-0.5 shrink-0", option.value === value ? "visible" : "invisible")}
                  />
                  <span className="min-w-0">
                    <span className="block">{option.label}</span>
                    {option.description ? <span className="text-muted block text-xs">{option.description}</span> : null}
                  </span>
                </li>
              ))
            ) : (
              <li role="presentation" className="text-muted px-3 py-3 text-sm">
                {labels.empty}
              </li>
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
