"use client";

import { create } from "zustand";

/** The Studio editor's two modes over one document (D-456): switching never changes the design. */
export type EditorMode = "easy" | "pro";

/** The pro toolbox's tools (C8 Phase 3): one key each. */
export type EditorTool =
  "select" | "hand" | "zoom" | "text" | "rect" | "ellipse" | "line" | "pen" | "eyedropper" | "comment";

export const TOOL_KEYS: Record<string, EditorTool> = {
  v: "select",
  h: "hand",
  z: "zoom",
  t: "text",
  r: "rect",
  e: "ellipse",
  l: "line",
  p: "pen",
  i: "eyedropper",
  c: "comment",
};

const MODE_KEY = "getpack.editorMode";
const WELCOMED_KEY = "getpack.editorWelcomed";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / full storage: the choice holds for this visit only.
  }
}

interface ModeState {
  mode: EditorMode;
  /** Whether a choice exists (this browser or the account); without one the first-open chooser asks. */
  chosen: boolean;
  tool: EditorTool;
  /** Print view toggles (pro "เส้นช่วยและระยะ"); easy shows cut, fold and labels only. */
  overlays: { cut: boolean; fold: boolean; bleed: boolean; safe: boolean; labels: boolean; grid: boolean };
  /** "จำลองหมึกบนผิวกล่อง": the artwork multiplied onto the board colour. */
  inkOnBoard: boolean;
  /** "แยกหมึก": the whole artwork, its black ink only, or its other colours only. */
  separation: "all" | "black" | "colours";
  /** Reads this browser's choice (once, after mount). */
  hydrate: () => void;
  /** The account's choice wins over this browser's (D-456). */
  adopt: (mode: EditorMode) => void;
  setMode: (mode: EditorMode) => void;
  setTool: (tool: EditorTool) => void;
  setOverlay: (key: keyof ModeState["overlays"], on: boolean) => void;
  setInkOnBoard: (on: boolean) => void;
  setSeparation: (s: ModeState["separation"]) => void;
}

export const useEditorMode = create<ModeState>((set) => ({
  mode: "easy",
  chosen: false,
  tool: "select",
  overlays: { cut: true, fold: true, bleed: true, safe: true, labels: true, grid: false },
  inkOnBoard: false,
  separation: "all",
  hydrate: () => {
    const stored = read(MODE_KEY);
    const mode = stored === "pro" || stored === "easy" ? stored : null;
    set({ mode: mode ?? "easy", chosen: mode !== null || read(WELCOMED_KEY) === "1" });
  },
  adopt: (mode) => {
    write(MODE_KEY, mode);
    write(WELCOMED_KEY, "1");
    set({ mode, chosen: true });
  },
  setMode: (mode) => {
    write(MODE_KEY, mode);
    write(WELCOMED_KEY, "1");
    set((s) => ({ mode, chosen: true, tool: mode === "easy" ? "select" : s.tool }));
  },
  setTool: (tool) => set({ tool }),
  setOverlay: (key, on) => set((s) => ({ overlays: { ...s.overlays, [key]: on } })),
  setInkOnBoard: (inkOnBoard) => set({ inkOnBoard }),
  setSeparation: (separation) => set({ separation }),
}));

/** What the canvas shows in a mode: easy keeps the cut and fold lines and the panel names only (Phase 2 item 1). */
export function overlaysFor(mode: EditorMode, overlays: ModeState["overlays"]): ModeState["overlays"] {
  return mode === "pro" ? overlays : { cut: true, fold: true, labels: true, bleed: false, safe: false, grid: false };
}
