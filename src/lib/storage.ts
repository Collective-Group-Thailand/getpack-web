import type { SavedDesign } from "./types";

const KEY = "boxstudio.designs.v1";

function readAll(): SavedDesign[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedDesign[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: SavedDesign[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // quota exceeded or storage blocked
  }
}

/**
 * Local persistence layer. Swap this module for API calls
 * (e.g. /api/designs backed by Postgres + S3) when adding a backend.
 */
export const designRepo = {
  list(): SavedDesign[] {
    return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string): SavedDesign | undefined {
    return readAll().find((d) => d.id === id);
  },
  save(design: SavedDesign): boolean {
    const list = readAll().filter((d) => d.id !== design.id);
    list.push(design);
    return writeAll(list);
  },
  remove(id: string): void {
    writeAll(readAll().filter((d) => d.id !== id));
  },
  duplicate(id: string, newId: string): SavedDesign | undefined {
    const src = readAll().find((d) => d.id === id);
    if (!src) return;
    const now = Date.now();
    const copy: SavedDesign = { ...structuredClone(src), id: newId, name: `${src.name} (สำเนา)`, createdAt: now, updatedAt: now };
    return writeAll([...readAll(), copy]) ? copy : undefined;
  },
};
