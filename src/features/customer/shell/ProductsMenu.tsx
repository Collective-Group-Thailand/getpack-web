"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
        className="text-fg/85 hover:bg-bg-subtle hover:text-fg focus-visible:ring-focus-ring aria-expanded:text-fg inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2"
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
  headerEnd,
  footer,
  children,
}: {
  label: string;
  closeLabel: string;
  /** Beside the title — the language switch (the "MobileNav" board). */
  headerEnd?: React.ReactNode;
  /** Pinned to the drawer's foot — the LINE button. */
  footer?: React.ReactNode;
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
    // The page under a full-screen menu does not scroll.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);
  const close = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="hover:bg-bg-subtle focus-visible:ring-focus-ring inline-flex size-10 items-center justify-center rounded-md outline-none focus-visible:ring-2 lg:hidden"
      >
        <Icon name="menu" size={22} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
      {/*
        Portalled to <body>: the header's backdrop blur makes it the containing block of anything
        `fixed` inside it, which is why the menu used to open 64 px tall (round 2, MobileNav).
      */}
      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={label}
              className="bg-surface z-modal fixed inset-0 flex h-dvh flex-col lg:hidden"
            >
              <div className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setOpen(false)}
                  className="hover:bg-bg-subtle inline-flex size-10 items-center justify-center rounded-md"
                >
                  <Icon name="close" size={22} aria-hidden="true" />
                  <span className="sr-only">{closeLabel}</span>
                </button>
                <p className="flex-1 text-lg font-semibold">{label}</p>
                {headerEnd}
              </div>
              {/* A link followed from the menu closes it: the header stays mounted across pages. */}
              <div className="flex-1 overflow-y-auto px-5 py-4" onClick={close}>
                {children}
              </div>
              {footer ? (
                <div
                  className="border-border shrink-0 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                  onClick={close}
                >
                  {footer}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
