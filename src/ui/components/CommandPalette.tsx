"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";
import { isApplePlatform, KEYCAP } from "./Kbd";
import { Spinner } from "./Spinner";

export interface CommandItem {
  id: string;
  label: string;
  /** Second line — an order code, a customer name, whatever disambiguates two similar hits. */
  hint?: string;
  /** Shown as a group heading above the first item of each group. */
  group?: string;
  icon?: IconName;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Becomes the dialog's accessible name; visually hidden. */
  title: string;
  placeholder: string;
  /** Live region text while `loading`, e.g. "กำลังค้นหา". */
  loadingLabel: string;
  emptyLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  items: readonly CommandItem[];
  loading?: boolean;
  /** Rendered under the input when the query is empty — recent searches, hints. */
  footer?: React.ReactNode;
}

/**
 * ⌘K. A combobox in a modal: one text input owning focus, a listbox the arrow keys move
 * through, and Enter to act (design-system.md §3 Navigation, §5 Admin).
 *
 * Built on Radix `Dialog` rather than `cmdk`. ADR-0002 fixes the component base as Radix +
 * CVA, and the part that is actually hard here — focus trap, scrim, Escape, scroll lock — is
 * what `Dialog` already does. What is left is the ARIA combobox wiring below, which is about
 * forty lines and is ours to keep consistent with the rest of `src/ui`.
 *
 * **Focus stays in the input the whole time.** The listbox is never focused; the active option
 * is pointed at by `aria-activedescendant`, which is the pattern that lets someone keep typing
 * while arrowing through results. Focusing the options instead is the common mistake — it
 * works with a mouse and traps a keyboard user on the first result.
 *
 * F1 1.3 ships the shell: it opens, filters what it is given, and acts. F2.1 gives it
 * something to search.
 */
export function CommandPalette({
  open,
  onOpenChange,
  title,
  placeholder,
  loadingLabel,
  emptyLabel,
  value,
  onValueChange,
  items,
  loading,
  footer,
}: CommandPaletteProps) {
  const listId = useId();
  const inputId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  /*
   * The highlight is tracked by **item id, not index**, and the index is derived from it.
   *
   * A new result set invalidates an index: leaving it at 4 when three items came back points
   * `aria-activedescendant` at an element that no longer exists, and Enter then does nothing
   * with no explanation. Storing the id makes that self-correcting — if the highlighted item
   * is gone, `findIndex` returns -1 and the first row takes over — with no effect
   * synchronising two pieces of state, which is the thing that goes wrong under concurrent
   * rendering.
   */
  const [activeId, setActiveId] = useState<string | null>(null);
  const foundIndex = items.findIndex((item) => item.id === activeId);
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;

  const active = items[activeIndex];

  /**
   * Consecutive items with the same group form one section; an item with no group stands alone.
   * The overall index is kept, because the active option is still counted across the whole list.
   */
  const sections = useMemo(() => {
    const result: { key: string; name: string | null; entries: { item: CommandItem; index: number }[] }[] = [];
    items.forEach((item, index) => {
      const name = item.group ?? null;
      const last = result.at(-1);
      if (last && last.name === name && name !== null) last.entries.push({ item, index });
      else result.push({ key: `${name ?? "none"}-${index}`, name, entries: [{ item, index }] });
    });
    return result;
  }, [items]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (items.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      // Wrapping, so Up from the first result reaches the last — a list of five should not
      // need five keystrokes to get to the bottom.
      const next = items[(activeIndex + delta + items.length) % items.length];
      if (next) setActiveId(next.id);
      return;
    }

    if (event.key === "Enter" && active) {
      event.preventDefault();
      active.onSelect();
      onOpenChange(false);
    }
  }

  // Keep the highlighted row on screen when the arrow keys walk past the fold.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, items]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="z-overlay bg-overlay fixed inset-0" />
        <DialogPrimitive.Content
          aria-label={title}
          className={cn(
            "z-modal fixed top-[12vh] left-1/2 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2",
            "border-border bg-surface-raised flex flex-col overflow-hidden rounded-2xl border shadow-xl",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>

          <div className="border-border flex items-center gap-2 border-b px-4">
            <Icon name="search" size={18} className="text-subtle" />
            <input
              id={inputId}
              // The combobox role goes on the input, not a wrapper: that is what pairs the
              // text field with the popup for a screen reader.
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
              className="placeholder:text-subtle h-12 flex-1 bg-transparent text-base outline-none"
              placeholder={placeholder}
              value={value}
              onChange={(event) => {
                // Typing starts a new search, so the highlight goes back to the top. Doing it
                // here rather than in an effect keeps it tied to the act that caused it.
                setActiveId(null);
                onValueChange(event.target.value);
              }}
              onKeyDown={onKeyDown}
            />
            {loading ? <Spinner size={16} label={loadingLabel} /> : null}
          </div>

          {/*
            A listbox may contain only options and groups. Consecutive items that share a group
            become a `role="group"` named by its heading, so a screen reader announces
            "หน้าจอ, group" before the first option in it — and nothing else sits in the listbox.
          */}
          <ul id={listId} ref={listRef} role="listbox" aria-label={title} className="max-h-80 overflow-y-auto py-1">
            {sections.map((section) => {
              const options = section.entries.map(({ item, index }) => (
                <li
                  key={item.id}
                  id={`${listId}-${item.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-active={index === activeIndex}
                  // Pointer only: focus never leaves the input, so this is not tabbable and
                  // needs no key handler of its own.
                  onMouseMove={() => setActiveId(item.id)}
                  onClick={() => {
                    item.onSelect();
                    onOpenChange(false);
                  }}
                  className={cn(
                    "mx-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                    index === activeIndex && "bg-primary-subtle text-primary-subtle-fg",
                  )}
                >
                  {item.icon ? <Icon name={item.icon} size={16} className="shrink-0" /> : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint ? <span className="text-muted shrink-0 text-xs">{item.hint}</span> : null}
                </li>
              ));
              if (!section.name) return options;
              const headingId = `${listId}-group-${section.key}`;
              return (
                <li key={section.key} role="presentation">
                  <ul role="group" aria-labelledby={headingId}>
                    <li
                      role="presentation"
                      id={headingId}
                      className="text-muted px-4 pt-3 pb-1 text-xs font-medium tracking-wide uppercase"
                    >
                      {section.name}
                    </li>
                    {options}
                  </ul>
                </li>
              );
            })}
          </ul>

          {items.length === 0 && !loading ? (
            <p className="text-muted px-4 py-6 text-center text-sm">{emptyLabel}</p>
          ) : null}

          {footer ? <div className="border-border text-muted border-t px-4 py-2 text-xs">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Opens the palette on ⌘K / Ctrl+K from anywhere on the page.
 *
 * Deliberately ignores the shortcut while the user is typing somewhere else: ⌘K in a text
 * field is "insert link" in most editors, and stealing it mid-sentence is the kind of thing
 * that makes people stop trusting a keyboard shortcut.
 */
export function useCommandPaletteShortcut(onOpen: () => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return;
      if (!(event.metaKey || event.ctrlKey)) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      event.preventDefault();
      onOpen();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);
}

/**
 * The modifier to *display* in a ⌘K hint.
 *
 * Rendered as `Ctrl` on the server and corrected after hydration, so the markup the server
 * sent and the markup React expects agree — reading `navigator` during render would be a
 * hydration mismatch on every Mac.
 */
export function useModKey(): string {
  // `useSyncExternalStore` rather than state-plus-effect: the platform is an external value
  // that never changes, so there is nothing to subscribe to, and React wants the server
  // snapshot declared separately instead of rendered and then corrected. It also gets the
  // right answer on the first client render rather than after an extra pass.
  return useSyncExternalStore(subscribeToNothing, getModKey, getServerModKey);
}

const subscribeToNothing = () => () => {};
const getModKey = () => (isApplePlatform() ? KEYCAP.cmd : KEYCAP.ctrl);
const getServerModKey = () => KEYCAP.ctrl;
