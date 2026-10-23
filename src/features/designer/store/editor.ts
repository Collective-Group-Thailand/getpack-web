"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import { DEFAULT_BLEED_MM } from "@getpack/dieline";
import { DEFAULT_PATTERN } from "@/features/designer/catalog";
import type { DesignContent, DesignElement, DesignSpec, NewElement, PatternSettings } from "@/features/designer/types";

/** Undo steps kept (studio-spec §6: at least 200). */
export const HISTORY_LIMIT = 200;

type Toggle = "showLabels" | "showSafeZone" | "showGrid" | "showRulers" | "snapping";

interface EditorState {
  designId: string;
  name: string;
  spec: DesignSpec | null;
  content: DesignContent;
  past: DesignContent[];
  future: DesignContent[];
  /** The primary selection (the last one picked) — what the properties panel shows. */
  selectedId: string | null;
  /** Everything selected, the primary last. Picking a grouped element selects its group. */
  selectedIds: string[];
  /** The face being edited up close: the canvas zooms to it and turns it upright. */
  focusedFaceId: string | null;
  zoom: number; // 1 = 100%
  showLabels: boolean;
  showSafeZone: boolean;
  showGrid: boolean;
  showRulers: boolean;
  snapping: boolean;
  dirty: boolean;
  /** Rendering the print file: artwork clipped to the bleed, on white, with no guides or chrome. */
  printMode: boolean;
  /** Bleed for the print file, from the catalogue's artwork rules (settings, D-070). */
  bleedMm: number;
  /** Copied elements, for paste. */
  clipboard: DesignElement[];
  /** Which side of the board is being edited (U4.3); new elements go on it. */
  side: "outside" | "inside";
  setSide: (side: "outside" | "inside") => void;
  setBleed: (mm: number) => void;

  load: (p: { id: string; name: string; spec: DesignSpec | null; content?: DesignContent }) => void;
  setSpec: (spec: DesignSpec) => void;
  setName: (name: string) => void;
  commit: (fn: (c: DesignContent) => DesignContent) => void;
  addElement: (el: NewElement) => void;
  updateElement: (id: string, patch: Partial<DesignElement>) => void;
  /** Several patches as one undo step (a group moved, an alignment). */
  updateElements: (patches: { id: string; patch: Partial<DesignElement> }[]) => void;
  moveElements: (moves: { id: string; dx: number; dy: number }[]) => void;
  removeElement: (id: string) => void;
  removeSelected: () => void;
  duplicateElement: (id: string) => void;
  duplicateSelected: () => void;
  reorder: (id: string, dir: "up" | "down" | "top" | "bottom") => void;
  setPattern: (p: Partial<PatternSettings>) => void;
  resetAll: () => void;
  resetPattern: () => void;
  undo: () => void;
  redo: () => void;
  /** Selects an element (with its group); `additive` toggles it within the selection. */
  select: (id: string | null, additive?: boolean) => void;
  selectMany: (ids: string[]) => void;
  selectAll: () => void;
  group: () => void;
  ungroup: () => void;
  setLocked: (ids: string[], locked: boolean) => void;
  copySelected: () => void;
  paste: () => void;
  focusFace: (faceId: string | null) => void;
  setZoom: (z: number) => void;
  toggle: (k: Toggle) => void;
  markSaved: () => void;
  setPrintMode: (on: boolean) => void;
}

const emptyContent = (): DesignContent => ({ elements: [], pattern: { ...DEFAULT_PATTERN } });

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;

/** The ids to select for one element: its whole group when it has one. */
function withGroup(elements: DesignElement[], id: string): string[] {
  const el = elements.find((e) => e.id === id);
  if (!el?.groupId) return [id];
  return elements.filter((e) => e.groupId === el.groupId).map((e) => e.id);
}

export const useEditor = create<EditorState>((set, get) => ({
  designId: "",
  name: "แบบกล่องใหม่",
  spec: null,
  content: emptyContent(),
  past: [],
  future: [],
  selectedId: null,
  selectedIds: [],
  focusedFaceId: null,
  zoom: 1,
  showLabels: true,
  showSafeZone: true,
  showGrid: false,
  showRulers: true,
  snapping: true,
  dirty: false,
  printMode: false,
  bleedMm: DEFAULT_BLEED_MM,
  clipboard: [],
  side: "outside",
  setSide: (side) => set({ side, selectedId: null, selectedIds: [], focusedFaceId: null }),
  setBleed: (bleedMm) => set({ bleedMm }),

  load: ({ id, name, spec, content }) =>
    set({
      designId: id,
      name,
      spec,
      content: content ?? emptyContent(),
      past: [],
      future: [],
      selectedId: null,
      selectedIds: [],
      focusedFaceId: null,
      side: "outside",
      dirty: false,
    }),

  setSpec: (spec) => set({ spec, dirty: true, focusedFaceId: null }),
  setName: (name) => set({ name, dirty: true }),

  commit: (fn) => {
    const { content, past } = get();
    const next = fn(content);
    if (next === content) return;
    set({ content: next, past: [...past, content].slice(-HISTORY_LIMIT), future: [], dirty: true });
  },

  addElement: (el) => {
    const id = nanoid(8);
    const side = get().side === "inside" ? { side: "inside" as const } : {};
    // Face-aware editing (U4.3): placed while a face is focused, it is clipped to that face —
    // wrapping across a fold is the explicit choice in its properties.
    const focused = get().focusedFaceId;
    const clip = focused && !el.clipFaceId ? { clipFaceId: focused } : {};
    get().commit((c) => ({ ...c, elements: [...c.elements, { ...el, ...clip, ...side, id } as DesignElement] }));
    set({ selectedId: id, selectedIds: [id] });
  },

  updateElement: (id, patch) =>
    get().commit((c) => ({
      ...c,
      elements: c.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as DesignElement) : e)),
    })),

  updateElements: (patches) => {
    if (!patches.length) return;
    const byId = new Map(patches.map((p) => [p.id, p.patch]));
    get().commit((c) => ({
      ...c,
      elements: c.elements.map((e) => (byId.has(e.id) ? ({ ...e, ...byId.get(e.id) } as DesignElement) : e)),
    }));
  },

  moveElements: (moves) => {
    const byId = new Map(moves.filter((m) => m.dx || m.dy).map((m) => [m.id, m]));
    if (!byId.size) return;
    get().commit((c) => ({
      ...c,
      elements: c.elements.map((e) => {
        const m = byId.get(e.id);
        return m && !e.locked ? ({ ...e, x: e.x + m.dx, y: e.y + m.dy } as DesignElement) : e;
      }),
    }));
  },

  removeElement: (id) => {
    get().commit((c) => ({ ...c, elements: c.elements.filter((e) => e.id !== id) }));
    const rest = get().selectedIds.filter((s) => s !== id);
    set({ selectedIds: rest, selectedId: rest.at(-1) ?? null });
  },

  removeSelected: () => {
    const ids = new Set(get().selectedIds);
    const removable = get()
      .content.elements.filter((e) => ids.has(e.id) && !e.locked)
      .map((e) => e.id);
    if (!removable.length) return;
    get().commit((c) => ({ ...c, elements: c.elements.filter((e) => !removable.includes(e.id)) }));
    set({ selectedId: null, selectedIds: [] });
  },

  duplicateElement: (id) => {
    const src = get().content.elements.find((e) => e.id === id);
    if (!src) return;
    const copy = { ...src, x: src.x + 10, y: src.y + 10, locked: false, groupId: undefined } as Partial<DesignElement>;
    delete copy.id;
    get().addElement(copy as NewElement);
  },

  duplicateSelected: () => {
    const ids = new Set(get().selectedIds);
    const sources = get().content.elements.filter((e) => ids.has(e.id));
    if (!sources.length) return;
    const groups = new Map<string, string>();
    const copies = sources.map((src) => {
      let groupId: string | undefined;
      if (src.groupId) {
        if (!groups.has(src.groupId)) groups.set(src.groupId, nanoid(6));
        groupId = groups.get(src.groupId);
      }
      return { ...src, id: nanoid(8), x: src.x + 10, y: src.y + 10, locked: false, groupId } as DesignElement;
    });
    get().commit((c) => ({ ...c, elements: [...c.elements, ...copies] }));
    set({ selectedIds: copies.map((e) => e.id), selectedId: copies.at(-1)?.id ?? null });
  },

  reorder: (id, dir) =>
    get().commit((c) => {
      const list = [...c.elements];
      const i = list.findIndex((e) => e.id === id);
      if (i < 0) return c;
      const [el] = list.splice(i, 1);
      const to =
        dir === "top"
          ? list.length
          : dir === "bottom"
            ? 0
            : dir === "up"
              ? Math.min(list.length, i + 1)
              : Math.max(0, i - 1);
      list.splice(to, 0, el);
      return { ...c, elements: list };
    }),

  setPattern: (p) => get().commit((c) => ({ ...c, pattern: { ...c.pattern, ...p } })),

  resetAll: () => {
    get().commit(() => emptyContent());
    set({ selectedId: null, selectedIds: [] });
  },

  resetPattern: () => get().commit((c) => ({ ...c, pattern: { ...DEFAULT_PATTERN } })),

  undo: () => {
    const { past, content, future } = get();
    if (!past.length) return;
    set({
      content: past[past.length - 1],
      past: past.slice(0, -1),
      future: [content, ...future],
      selectedId: null,
      selectedIds: [],
      dirty: true,
    });
  },

  redo: () => {
    const { past, content, future } = get();
    if (!future.length) return;
    set({
      content: future[0],
      past: [...past, content],
      future: future.slice(1),
      selectedId: null,
      selectedIds: [],
      dirty: true,
    });
  },

  select: (id, additive = false) => {
    if (id === null) return set({ selectedId: null, selectedIds: [] });
    const ids = withGroup(get().content.elements, id);
    if (!additive) return set({ selectedId: id, selectedIds: ids });
    const current = get().selectedIds;
    const already = ids.every((i) => current.includes(i));
    const next = already
      ? current.filter((i) => !ids.includes(i))
      : [...current.filter((i) => !ids.includes(i)), ...ids];
    set({ selectedIds: next, selectedId: already ? (next.at(-1) ?? null) : id });
  },

  selectMany: (ids) => set({ selectedIds: ids, selectedId: ids.at(-1) ?? null }),
  selectAll: () => {
    const side = get().side;
    const ids = get()
      .content.elements.filter((e) => !e.locked && (e.side ?? "outside") === side)
      .map((e) => e.id);
    set({ selectedIds: ids, selectedId: ids.at(-1) ?? null });
  },

  group: () => {
    const ids = get().selectedIds;
    if (ids.length < 2) return;
    const groupId = nanoid(6);
    get().updateElements(ids.map((id) => ({ id, patch: { groupId } })));
  },

  ungroup: () => get().updateElements(get().selectedIds.map((id) => ({ id, patch: { groupId: undefined } }))),

  setLocked: (ids, locked) => get().updateElements(ids.map((id) => ({ id, patch: { locked } }))),

  copySelected: () => {
    const ids = new Set(get().selectedIds);
    set({ clipboard: structuredClone(get().content.elements.filter((e) => ids.has(e.id))) });
  },

  paste: () => {
    const { clipboard } = get();
    if (!clipboard.length) return;
    // Pasted onto the side being edited.
    const inside = get().side === "inside";
    const copies = clipboard.map((e) => {
      const { side: _side, ...rest } = e;
      void _side;
      return {
        ...rest,
        ...(inside ? { side: "inside" } : {}),
        id: nanoid(8),
        x: e.x + 10,
        y: e.y + 10,
        locked: false,
      } as DesignElement;
    });
    get().commit((c) => ({ ...c, elements: [...c.elements, ...copies] }));
    set({ selectedIds: copies.map((e) => e.id), selectedId: copies.at(-1)?.id ?? null, clipboard: copies });
  },

  focusFace: (focusedFaceId) => set({ focusedFaceId }),
  setZoom: (z) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) }),
  toggle: (k) => set((s) => ({ [k]: !s[k] }) as Partial<EditorState>),
  markSaved: () => set({ dirty: false }),
  setPrintMode: (printMode) => set({ printMode }),
}));
