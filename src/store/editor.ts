"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import { DEFAULT_PATTERN } from "@/lib/catalog";
import type { DesignContent, DesignElement, DesignSpec, NewElement, PatternSettings } from "@/lib/types";

const HISTORY_LIMIT = 100;

interface EditorState {
  designId: string;
  name: string;
  spec: DesignSpec | null;
  content: DesignContent;
  past: DesignContent[];
  future: DesignContent[];
  selectedId: string | null;
  zoom: number; // 1 = 100%
  showLabels: boolean;
  showSafeZone: boolean;
  dirty: boolean;

  load: (p: { id: string; name: string; spec: DesignSpec | null; content?: DesignContent }) => void;
  setSpec: (spec: DesignSpec) => void;
  setName: (name: string) => void;
  commit: (fn: (c: DesignContent) => DesignContent) => void;
  addElement: (el: NewElement) => void;
  updateElement: (id: string, patch: Partial<DesignElement>) => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  reorder: (id: string, dir: "up" | "down" | "top" | "bottom") => void;
  setPattern: (p: Partial<PatternSettings>) => void;
  resetAll: () => void;
  resetPattern: () => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setZoom: (z: number) => void;
  toggle: (k: "showLabels" | "showSafeZone") => void;
  markSaved: () => void;
}

const emptyContent = (): DesignContent => ({ elements: [], pattern: { ...DEFAULT_PATTERN } });

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;

export const useEditor = create<EditorState>((set, get) => ({
  designId: "",
  name: "แบบกล่องใหม่",
  spec: null,
  content: emptyContent(),
  past: [],
  future: [],
  selectedId: null,
  zoom: 1,
  showLabels: true,
  showSafeZone: true,
  dirty: false,

  load: ({ id, name, spec, content }) =>
    set({ designId: id, name, spec, content: content ?? emptyContent(), past: [], future: [], selectedId: null, dirty: false }),

  setSpec: (spec) => set({ spec, dirty: true }),
  setName: (name) => set({ name, dirty: true }),

  commit: (fn) => {
    const { content, past } = get();
    const next = fn(content);
    if (next === content) return;
    set({ content: next, past: [...past, content].slice(-HISTORY_LIMIT), future: [], dirty: true });
  },

  addElement: (el) => {
    const id = nanoid(8);
    get().commit((c) => ({ ...c, elements: [...c.elements, { ...el, id } as DesignElement] }));
    set({ selectedId: id });
  },

  updateElement: (id, patch) =>
    get().commit((c) => ({
      ...c,
      elements: c.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as DesignElement) : e)),
    })),

  removeElement: (id) => {
    get().commit((c) => ({ ...c, elements: c.elements.filter((e) => e.id !== id) }));
    if (get().selectedId === id) set({ selectedId: null });
  },

  duplicateElement: (id) => {
    const src = get().content.elements.find((e) => e.id === id);
    if (!src) return;
    const { id: _omit, ...rest } = src;
    void _omit;
    get().addElement({ ...rest, x: src.x + 10, y: src.y + 10 });
  },

  reorder: (id, dir) =>
    get().commit((c) => {
      const list = [...c.elements];
      const i = list.findIndex((e) => e.id === id);
      if (i < 0) return c;
      const [el] = list.splice(i, 1);
      const to = dir === "top" ? list.length : dir === "bottom" ? 0 : dir === "up" ? Math.min(list.length, i + 1) : Math.max(0, i - 1);
      list.splice(to, 0, el);
      return { ...c, elements: list };
    }),

  setPattern: (p) => get().commit((c) => ({ ...c, pattern: { ...c.pattern, ...p } })),

  resetAll: () => {
    get().commit(() => emptyContent());
    set({ selectedId: null });
  },

  resetPattern: () => get().commit((c) => ({ ...c, pattern: { ...DEFAULT_PATTERN } })),

  undo: () => {
    const { past, content, future } = get();
    if (!past.length) return;
    set({ content: past[past.length - 1], past: past.slice(0, -1), future: [content, ...future], selectedId: null, dirty: true });
  },

  redo: () => {
    const { past, content, future } = get();
    if (!future.length) return;
    set({ content: future[0], past: [...past, content], future: future.slice(1), selectedId: null, dirty: true });
  },

  select: (selectedId) => set({ selectedId }),
  setZoom: (z) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) }),
  toggle: (k) => set((s) => ({ [k]: !s[k] }) as Partial<EditorState>),
  markSaved: () => set({ dirty: false }),
}));
