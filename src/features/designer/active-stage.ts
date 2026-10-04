import type Konva from "konva";

/**
 * The open editor's canvas, for work done outside the render (the studio's order renders, U4.6).
 * Set by the editor in an effect; never read during a render.
 */
let current: (() => Konva.Stage | null) | null = null;

export function setActiveStage(getter: (() => Konva.Stage | null) | null): void {
  current = getter;
}

export function activeStage(): Konva.Stage | null {
  return current?.() ?? null;
}
