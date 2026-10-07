"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/ui/icons";

/**
 * The storefront's phone menu (F3 page patterns: "full-screen menu"): a button in
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
