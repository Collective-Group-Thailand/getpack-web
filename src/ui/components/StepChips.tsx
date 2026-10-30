"use client";

import { useEffect, useState } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";

export type StepChipState =
  /** Answered or confirmed by the customer. */
  | "done"
  /** Still the starting value nobody confirmed or changed. */
  | "default"
  /** Needs the customer's attention (a missing postcode). */
  | "todo"
  /** Nothing to say yet. */
  | "idle";

export interface StepChip {
  /** The id of the `StepCard` it scrolls to. */
  id: string;
  label: React.ReactNode;
  state: StepChipState;
  /** "ค่าเริ่มต้น" — drawn and announced after the label of a `default` chip. */
  stateLabel?: string;
  /** Announced after the label of a `done` or `todo` chip ("เรียบร้อยแล้ว", "ยังไม่ได้ระบุ"). */
  srLabel?: string;
}

export interface StepChipsProps {
  chips: StepChip[];
  "aria-label": string;
  /** Where the bar sticks: a CSS length, normally the storefront header's token. */
  top?: string;
  className?: string;
}

/**
 * Whether a motion preference is "reduce": scrolling is then instant, never animated.
 */
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Scrolls to a step card and moves focus onto it (the card is `tabIndex={-1}`), without a second scroll. */
export function scrollToStep(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
  try {
    window.history.replaceState(null, "", `#${id}`);
  } catch {
    // A sandboxed frame may refuse; the scroll already happened.
  }
}

/**
 * The step in view: the last card whose top has passed the line just under the sticky bars. Read
 * with an IntersectionObserver (no scroll listener), so the chip bar's `aria-current` follows the
 * page without work on every frame.
 */
export function useActiveStep(ids: readonly string[], rootMarginTop = "-160px"): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");
  useEffect(() => {
    const cards = key
      .split("|")
      .filter(Boolean)
      .flatMap((id) => {
        const element = document.getElementById(id);
        return element ? [element] : [];
      });
    if (cards.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // The first card (in page order) still crossing the band under the bars is the one being read.
        const current = cards.find((card) => visible.has(card.id));
        if (current) setActive(current.id);
      },
      // A band from just under the sticky bars to a third of the way down the viewport.
      { rootMargin: `${rootMarginTop} 0px -60% 0px`, threshold: 0 },
    );
    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, [key, rootMarginTop]);
  return active;
}

/**
 * The sticky progress bar of a long configuration (design-system.md §3 "StepChips"): one chip per
 * step with its state — done ✓, "ค่าเริ่มต้น", or a highlighted to-do — and a click that scrolls to
 * the step. A navigation landmark whose chip for the step in view is `aria-current="step"`.
 *
 * On a phone the row scrolls inside the bar (never the page), edge to edge with room after the last chip, so a
 * half-shown chip reads as "more this way"; from `md` the chips wrap instead, so none is ever cut off.
 * The state is an icon, a word or a number plus a highlight, never colour alone.
 */
export function StepChips({ chips, top, className, ...props }: StepChipsProps) {
  const active = useActiveStep(chips.map((chip) => chip.id));
  return (
    <nav
      aria-label={props["aria-label"]}
      data-step-chips
      className={cn("bg-bg/95 border-border z-sticky sticky border-b backdrop-blur", className)}
      style={{ top: top ?? "var(--site-sticky-top)" }}
    >
      <ol className="m-0 flex [scrollbar-width:none] list-none gap-1.5 overflow-x-auto overscroll-x-contain p-0 py-2.5 max-md:px-5 md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
        {chips.map((chip, index) => (
          <li key={chip.id} className="shrink-0">
            <a
              href={`#${chip.id}`}
              aria-current={active === chip.id ? "step" : undefined}
              onClick={(event) => {
                event.preventDefault();
                scrollToStep(chip.id);
              }}
              className={cn(
                "rounded-control focus-visible:ring-focus-ring relative inline-flex min-h-10 items-center gap-1.5 border py-1 ps-1.5 pe-3 text-sm font-medium whitespace-nowrap no-underline outline-none focus-visible:ring-2",
                chip.state === "todo"
                  ? "border-instant text-instant-subtle-fg bg-surface"
                  : "border-border text-muted bg-surface hover:bg-bg-subtle",
                active === chip.id && "border-primary text-fg",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "rounded-control flex size-6 items-center justify-center text-xs font-semibold tabular-nums",
                  chip.state === "done" && "bg-primary text-primary-fg",
                  chip.state === "todo" && "bg-instant-subtle text-instant-subtle-fg",
                  (chip.state === "default" || chip.state === "idle") && "bg-bg-subtle text-muted",
                )}
              >
                {chip.state === "done" ? <Icon name="check" size={14} /> : index + 1}
              </span>
              {chip.label}
              {chip.state === "default" && chip.stateLabel ? <span> · {chip.stateLabel}</span> : null}
              {chip.state !== "default" && chip.srLabel ? <span className="sr-only"> — {chip.srLabel}</span> : null}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
