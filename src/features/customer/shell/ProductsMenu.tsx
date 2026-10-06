"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * The header's product menu: a disclosure button and a panel of category links (the WAI-ARIA
 * disclosure-navigation pattern, not a `menu` — these are links, and a menu role would take
 * away the arrow-less tabbing people expect of links).
 *
 * The links are server-rendered children, so the panel's content costs no JavaScript and is
 * in the HTML for a crawler; this component only opens and closes it. Closes on Escape (focus
 * back to the button), on a click outside, and on navigation.
 */
export function ProductsMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // A new page closes the panel. Tracked as state, not an effect, so it happens during render.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="hover:bg-bg-subtle focus-visible:ring-focus-ring inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2"
      >
        {label}
        <Icon
          name="chevron-down"
          size={16}
          aria-hidden="true"
          className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")}
        />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="border-border bg-surface shadow-overlay absolute start-0 top-full mt-2 w-[min(56rem,calc(100vw-2rem))] rounded-xl border p-4"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The same menu on a phone (F3 page patterns: "full-screen menu with the same chips"): a button in
 * the header opens the columns full screen; Escape, the close button or a new page closes it.
 */
export function MobileProductsMenu({
  label,
  closeLabel,
  children,
}: {
  label: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="hover:bg-bg-subtle focus-visible:ring-focus-ring inline-flex size-9 items-center justify-center rounded-md outline-none focus-visible:ring-2 lg:hidden"
      >
        <Icon name="menu" size={20} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="bg-surface z-modal fixed inset-0 flex flex-col overflow-y-auto p-4 lg:hidden"
        >
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">{label}</p>
            <button
              type="button"
              autoFocus
              onClick={() => setOpen(false)}
              className="hover:bg-bg-subtle inline-flex size-9 items-center justify-center rounded-md"
            >
              <Icon name="close" size={20} aria-hidden="true" />
              <span className="sr-only">{closeLabel}</span>
            </button>
          </div>
          {/* A link followed from the sheet closes it: the header stays mounted across pages. */}
          <div
            className="mt-4 flex flex-col gap-6"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
