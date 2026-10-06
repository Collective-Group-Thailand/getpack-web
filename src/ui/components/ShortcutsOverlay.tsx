"use client";

import { useEffect } from "react";

import { cn } from "../lib/cn";
import { Dialog } from "./Dialog";
import { Kbd } from "./Kbd";

export interface Shortcut {
  /** The keys, already resolved for this platform — see `useModKey`. */
  keys: readonly string[];
  description: string;
  group?: string;
}

export interface ShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  shortcuts: readonly Shortcut[];
}

/**
 * The `?` overlay: every shortcut this zone answers to, in one list
 * (design-system.md §5 — "keyboard shortcuts documented in a `?` overlay").
 *
 * A keyboard-first workspace whose shortcuts are undiscoverable is a workspace with no
 * shortcuts, so this is part of the feature rather than documentation about it.
 */
export function ShortcutsOverlay({ open, onOpenChange, title, closeLabel, shortcuts }: ShortcutsOverlayProps) {
  const groups = new Map<string, Shortcut[]>();
  for (const shortcut of shortcuts) {
    const key = shortcut.group ?? "";
    groups.set(key, [...(groups.get(key) ?? []), shortcut]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} closeLabel={closeLabel} size="md">
      <div className="flex flex-col gap-5">
        {[...groups].map(([group, items]) => (
          <section key={group}>
            {group ? <h3 className="text-muted mb-2 text-xs font-medium tracking-wide uppercase">{group}</h3> : null}
            <dl className="flex flex-col gap-2">
              {items.map((shortcut) => (
                <div key={shortcut.description} className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm">{shortcut.description}</dt>
                  <dd className={cn("flex shrink-0 items-center gap-1")}>
                    {shortcut.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

/**
 * Opens the overlay on `?`.
 *
 * `?` is a printable character, so unlike ⌘K this *must* stand down inside any text field —
 * otherwise typing a question mark into a search box opens a dialog instead. Shift is not
 * checked: `?` is Shift+/ on a US layout but unshifted on several others, and `event.key` has
 * already resolved the layout for us.
 */
export function useShortcutsOverlayShortcut(onOpen: () => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "?") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

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
