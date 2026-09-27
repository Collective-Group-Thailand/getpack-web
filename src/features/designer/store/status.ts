"use client";
import { create } from "zustand";

/**
 * Fast-changing canvas facts the chrome shows (the status bar's face under the pointer, the
 * rulers' origin), kept out of the editor store so a mouse move never re-renders the panels.
 */
interface CanvasStatus {
  /** The face under the pointer, or the focused one. */
  faceId: string | null;
  /** The stage's origin (px) and scale (px per mm), for the rulers. */
  origin: { x: number; y: number };
  scale: number;
  set: (patch: Partial<Omit<CanvasStatus, "set">>) => void;
}

export const useCanvasStatus = create<CanvasStatus>((set) => ({
  faceId: null,
  origin: { x: 0, y: 0 },
  scale: 1,
  set: (patch) => set(patch),
}));
