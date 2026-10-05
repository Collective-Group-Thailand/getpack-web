"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "../lib/cn";
import { Button } from "./Button";

export interface CoachMark {
  /** A CSS selector for the element the mark points at; the card sits in a corner when it is missing. */
  target: string;
  title: React.ReactNode;
  body: React.ReactNode;
}

export interface CoachMarksProps {
  /** At most three (U5.2): more than that is a manual, not a hint. */
  marks: readonly CoachMark[];
  open: boolean;
  onClose: () => void;
  labels: { next: string; done: string; skip: string; progress: (current: number, total: number) => string };
  className?: string;
}

const GAP = 10;
const WIDTH = 288;

type Place = { top: number; left: number } | null;

function placeFor(selector: string, height: number): Place {
  const target = document.querySelector(selector);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  const above = rect.bottom + GAP + height > window.innerHeight && rect.top - GAP - height > 0;
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - WIDTH - 8));
  return { top: above ? rect.top - GAP - height : rect.bottom + GAP, left };
}

/**
 * First-run hints beside the real controls (U5.2 §2): one card at a time next to its target, never
 * modal — the page stays usable behind it, focus moves into the card and Escape or "skip" closes it.
 * Nothing is drawn over the target, so the hint never hides what it explains.
 */
export function CoachMarks({ marks, open, onClose, labels, className }: CoachMarksProps) {
  const shown = marks.slice(0, 3);
  const [index, setIndex] = useState(0);
  const [place, setPlace] = useState<Place>(null);
  const card = useRef<HTMLDivElement>(null);
  const mark = shown[index];
  const selector = mark?.target ?? null;

  const close = () => {
    setIndex(0);
    onClose();
  };

  useLayoutEffect(() => {
    if (!open || !selector) return;
    const measure = () => setPlace(placeFor(selector, card.current?.offsetHeight ?? 160));
    // Positioned from the target's box once it is on screen, and again when the page moves.
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, selector]);

  useEffect(() => {
    if (open) card.current?.focus();
  }, [open, index]);

  if (!open || !mark || typeof document === "undefined") return null;
  const last = index === shown.length - 1;

  return createPortal(
    <div
      ref={card}
      role="dialog"
      aria-modal="false"
      aria-label={labels.progress(index + 1, shown.length)}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
      style={place ? { top: place.top, left: place.left, width: WIDTH } : { bottom: 16, right: 16, width: WIDTH }}
      className={cn(
        "z-modal border-border bg-surface-raised shadow-overlay fixed flex flex-col gap-2 rounded-lg border p-4 text-sm outline-none",
        className,
      )}
    >
      <p className="text-muted text-xs">{labels.progress(index + 1, shown.length)}</p>
      <p className="font-semibold">{mark.title}</p>
      <div className="text-muted">{mark.body}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={close}>
          {labels.skip}
        </Button>
        <Button size="sm" onClick={() => (last ? close() : setIndex(index + 1))}>
          {last ? labels.done : labels.next}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
