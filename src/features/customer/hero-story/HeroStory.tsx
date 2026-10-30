"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/ui/lib/cn";

/** How long a scene plays before the next one (the dot's fill runs the same length). */
const SCENE_MS = 6000;
/** A swipe shorter than this is a tap. */
const SWIPE_PX = 40;

export interface StoryScene {
  key: string;
  /** The dot's accessible name and the tab label. */
  label: string;
  /** The scene's markup — server-rendered, every animated part carrying its own `animationDelay`. */
  content: ReactNode;
}

/**
 * The hero story (business / getpack Factory heroes, 2026-10-30): one scene at a time inside the hero panel,
 * advancing every six seconds, with a dot per scene whose fill shows the time left. Pointing at it pauses,
 * leaving restarts the scene; the dots, ← → and a swipe choose a scene; it only plays while on screen. A scene
 * is remounted when chosen, so its CSS sequence plays from the start. With less motion requested nothing
 * auto-advances and the scene appears whole (`pk-story-*` in base.css).
 */
export function HeroStory({
  label,
  roleDescription,
  scenes,
  className,
}: {
  label: string;
  /** The translated word for what this is ("carousel"), read by screen readers. */
  roleDescription: string;
  scenes: StoryScene[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  // Bumped when the same scene is chosen again (pointer leaves, dot clicked) so it remounts and replays.
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const dots = useRef<HTMLDivElement>(null);
  const pointerX = useRef<number | null>(null);
  const count = scenes.length;

  const go = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
      setRun((n) => n + 1);
    },
    [count],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = root.current;
    if (!node || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), {
      threshold: 0.35,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The clock: one timeout per run, so choosing a scene always restarts the full six seconds.
  useEffect(() => {
    if (reduced || paused || !visible || count < 2) return;
    const timer = window.setTimeout(() => go(index + 1), SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [index, run, reduced, paused, visible, count, go]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = event.key === "ArrowRight" ? index + 1 : index - 1;
    go(next);
    const button = dots.current?.children[((next % count) + count) % count] as HTMLElement | undefined;
    button?.focus();
  };

  const scene = scenes[index];
  if (!scene) return null;

  return (
    <div
      ref={root}
      className={cn(
        "bg-sage-subtle rounded-panel relative flex flex-col overflow-hidden pt-7 pb-3 sm:pt-10 sm:pb-4",
        paused && "pk-story-paused",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setRun((n) => n + 1);
      }}
      onKeyDown={onKeyDown}
    >
      <div
        className="relative flex-1 touch-pan-y"
        role="group"
        aria-roledescription={roleDescription}
        aria-label={label}
        onPointerDown={(event) => {
          pointerX.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (pointerX.current === null) return;
          const dx = event.clientX - pointerX.current;
          pointerX.current = null;
          if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? index + 1 : index - 1);
        }}
      >
        <div
          key={`${scene.key}:${run}`}
          className="pk-story-enter absolute inset-0 flex flex-col px-4 sm:px-8 xl:px-11"
        >
          {scene.content}
        </div>
      </div>

      <div ref={dots} role="tablist" aria-label={label} className="relative z-10 flex items-center justify-center">
        {scenes.map((item, at) => {
          const active = at === index;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={item.label}
              onClick={() => go(at)}
              className="focus-visible:ring-focus-ring rounded-control grid h-11 min-w-11 place-items-center outline-none focus-visible:ring-2"
            >
              <span
                className={cn(
                  "bg-sage/35 rounded-thumb relative block h-2 overflow-hidden transition-[width] duration-300",
                  active ? "w-8" : "w-2",
                )}
              >
                {active && !reduced ? (
                  <span key={run} className="pk-story-fill bg-primary rounded-thumb absolute inset-y-0 left-0" />
                ) : null}
                {active && reduced ? <span className="bg-primary rounded-thumb absolute inset-0" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
