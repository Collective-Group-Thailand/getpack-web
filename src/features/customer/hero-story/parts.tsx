import type { CSSProperties, ReactNode } from "react";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/** `animationDelay` in seconds — every animated part of a scene schedules itself. */
export const at = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

/**
 * A scene's frame: the tag with the old way struck through, the claim, the stacked "paper" card and an
 * optional toast at the foot. Markup only (no hooks), so the business and factory stories render it on the
 * server and hand the result to the client carousel.
 */
export function Scene({
  tag,
  before,
  title,
  children,
  toast,
}: {
  tag: string;
  before: string;
  title: string;
  children: ReactNode;
  toast?: ReactNode;
}) {
  return (
    <>
      <p className="text-muted flex flex-wrap items-center gap-2.5 text-[13px]">
        <b className="text-primary text-xs font-bold tracking-[0.04em]">{tag}</b>
        <span aria-hidden="true" className="bg-muted size-[3px] rounded-full" />
        <span className="relative">
          {before}
          <span aria-hidden="true" className="pk-story-strike bg-instant absolute top-[52%] left-0 h-px" />
        </span>
      </p>
      <h3
        className="pk-story-up mt-2 text-[1.375rem] leading-[1.3] font-bold tracking-[-0.01em] sm:text-[1.75rem]"
        style={at(0.35)}
      >
        {title}
      </h3>
      <div className="pk-story-up relative mt-5 sm:mt-6" style={at(0.55)}>
        <span aria-hidden="true" className="pk-story-fan-l bg-primary-subtle rounded-panel absolute inset-0" />
        <span aria-hidden="true" className="pk-story-fan-r bg-bg-subtle rounded-panel absolute inset-0" />
        <div className="bg-surface rounded-panel shadow-panel relative overflow-hidden text-[13.5px]">{children}</div>
      </div>
      {toast}
    </>
  );
}

/** The toast that closes a scene — a pulsing dot, a bold result and a muted detail. */
export function Toast({ delay, title, detail }: { delay: number; title: string; detail?: string }) {
  return (
    <p
      className="pk-story-toast bg-surface shadow-overlay rounded-card absolute right-4 bottom-1 z-[2] flex items-center gap-2.5 px-4 py-3 text-[13px] sm:right-7"
      style={at(delay)}
    >
      <span aria-hidden="true" className="pk-story-ping bg-primary size-2 shrink-0 rounded-full" />
      <b className="font-semibold">{title}</b>
      {detail ? <span className="text-muted">{detail}</span> : null}
    </p>
  );
}

/** A line that rises into place at its time. */
export function Up({
  delay,
  className,
  children,
  highlight = false,
}: {
  delay: number;
  className?: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(highlight ? "pk-story-hi" : "pk-story-up", className)} style={at(delay)}>
      {children}
    </div>
  );
}

/** A tick that pops in. */
export function Tick({ delay, className }: { delay: number; className?: string }) {
  return (
    <span className={cn("pk-story-pop text-primary inline-flex", className)} style={at(delay)}>
      <Icon name="check" size={14} strokeWidth={2.8} aria-hidden="true" />
    </span>
  );
}

/** A primary button with the cursor arriving and pressing it. */
export function Pressed({ cursorAt, pressAt, children }: { cursorAt: number; pressAt: number; children: ReactNode }) {
  return (
    <span className="relative inline-flex">
      <span
        className="pk-story-press bg-primary text-primary-fg rounded-control inline-flex h-9 items-center px-4 text-[13px] font-semibold"
        style={at(pressAt)}
      >
        {children}
      </span>
      <svg
        aria-hidden="true"
        className="pk-story-cursor pointer-events-none absolute right-1.5 -bottom-3 z-[3]"
        style={at(cursorAt)}
        width="24"
        height="24"
        viewBox="0 0 24 24"
      >
        <path
          d="M4 3l7 17 2.5-7L21 10.5z"
          className="fill-surface stroke-fg"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** A bar filling to `percent` of its track at its time. */
export function Bar({ delay, percent, className }: { delay: number; percent: number; className?: string }) {
  return (
    <span className={cn("bg-bg-subtle rounded-thumb block h-1.5 overflow-hidden", className)} aria-hidden="true">
      <span className="block h-full" style={{ width: `${percent}%` }}>
        <span className="pk-story-bar bg-primary rounded-thumb block h-full" style={at(delay)} />
      </span>
    </span>
  );
}

/** A search field whose query is typed out at its time. */
export function Typed({ delay, text }: { delay: number; text: string }) {
  return (
    <span className="flex items-center gap-2.5 text-sm">
      <Icon name="search" size={16} aria-hidden="true" className="text-muted" />
      <span className="pk-story-type inline-block overflow-hidden whitespace-nowrap" style={at(delay)}>
        {text}
      </span>
      <span aria-hidden="true" className="pk-story-caret bg-primary -ml-1.5 inline-block h-[18px] w-0.5" />
    </span>
  );
}

/** A row of the card: a name, an optional middle column and a right-aligned figure. */
export function Row({
  delay,
  name,
  mid,
  end,
  highlight = false,
  last = false,
}: {
  delay: number;
  name: ReactNode;
  mid?: ReactNode;
  end?: ReactNode;
  highlight?: boolean;
  last?: boolean;
}) {
  return (
    <Up
      delay={delay}
      highlight={highlight}
      className={cn(
        "border-border -mx-2 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 rounded-lg px-2 py-2.5 text-sm",
        !last && "border-b",
      )}
    >
      <span className="truncate">{name}</span>
      <span className="text-muted tabular-nums">{mid}</span>
      <span className="text-right font-semibold tabular-nums">{end}</span>
    </Up>
  );
}

/** The card's muted foot: a pill on the left, something on the right. */
export function Foot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-bg/60 border-border flex items-center justify-between gap-3 border-t px-5 py-3", className)}>
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "primary",
  delay,
}: {
  children: ReactNode;
  tone?: "primary" | "muted";
  delay?: number;
}) {
  return (
    <span
      className={cn(
        "rounded-control inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold",
        tone === "primary" ? "bg-primary-subtle text-primary" : "bg-bg-subtle text-muted",
      )}
    >
      {delay !== undefined ? <Tick delay={delay} /> : null}
      {children}
    </span>
  );
}
