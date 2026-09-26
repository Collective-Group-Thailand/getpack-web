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
        className="border-border bg-surface absolute start-0 top-full mt-2 w-[min(40rem,calc(100vw-2rem))] rounded-xl border p-4 shadow-lg"
      >
        {children}
      </div>
    </div>
  );
}
