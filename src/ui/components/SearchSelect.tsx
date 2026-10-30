"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";
import { MENU_ITEM, MENU_ITEM_ACTIVE, POPOVER_SURFACE } from "./menu-surface";

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
  /** Type-to-filter for long lists only (it still opens the same list). Default: from 11 options (more than 10). */
  searchFrom?: number;
  /** `sm` for a dense tool panel; every form field is `md` (44 px in the storefront). */
  size?: "sm" | "md";
  name?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const COARSE = "(pointer: coarse)";
const coarseQuery = () => (typeof window.matchMedia === "function" ? window.matchMedia(COARSE) : null);
const subscribeCoarse = (onChange: () => void) => {
  const query = coarseQuery();
  if (!query) return () => {};
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
/** A touch screen picks from the phone's own picker; the server and the first paint assume a pointer. */
const useCoarsePointer = () =>
  useSyncExternalStore(
    subscribeCoarse,
    () => coarseQuery()?.matches ?? false,
    () => false,
  );

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
  searchFrom = 11,
  size = "md",
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
  const coarse = useCoarsePointer();

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

  // The one select field (owner request 2026-10-30): on a touch screen the platform's own <select> — the phone's
  // picker is the best list there is — dressed exactly as the button below; on a desktop the listbox popover,
  // with type-to-filter once the list is long.
  if (coarse)
    return (
      <span className={cn("relative block", className)}>
        <select
          id={fieldProps.id}
          aria-describedby={fieldProps["aria-describedby"]}
          aria-invalid={fieldProps["aria-invalid"]}
          aria-label={props["aria-label"]}
          name={name}
          disabled={disabled ?? fieldProps.disabled}
          data-size={size}
          value={value ?? ""}
          onChange={(event) => {
            const option = options.find((item) => item.value === event.target.value);
            if (option) onValueChange?.(option.value);
          }}
          className={cn(controlVariants({ inputSize: size }), "appearance-none pe-9", !chosen && "text-muted")}
        >
          {!chosen ? (
            <option value="" disabled hidden>
              {placeholder ?? ""}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.description ? `${option.label} · ${option.description}` : option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          size={18}
          aria-hidden="true"
          className="text-muted pointer-events-none absolute end-3 top-1/2 -translate-y-1/2"
        />
      </span>
    );

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
        {/* The button stands for the field, so it carries the field's error state as every other control does. */}
        {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
        <button
          type="button"
          id={fieldProps.id}
          aria-describedby={fieldProps["aria-describedby"]}
          aria-invalid={fieldProps["aria-invalid"]}
          aria-label={props["aria-label"]}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled ?? fieldProps.disabled}
          data-size={size}
          className={cn(
            controlVariants({ inputSize: size }),
            "flex items-center justify-between gap-2 text-start",
            className,
          )}
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
            POPOVER_SURFACE,
            "flex flex-col",
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
                    MENU_ITEM,
                    option.value === active && MENU_ITEM_ACTIVE,
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
