"use client";

import type Konva from "konva";

/**
 * Runs `fn` with the sheet laid flat: a focused face turns the canvas's world group upright,
 * and a capture of the sheet must not be turned with it. Synchronous — nothing re-renders.
 */
export function withFlatWorld<T>(stage: Konva.Stage, fn: () => T): T {
  const world = stage.findOne(".world");
  const rotation = world?.rotation() ?? 0;
  world?.rotation(0);
  try {
    return fn();
  } finally {
    world?.rotation(rotation);
  }
}
