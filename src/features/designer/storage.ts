import type { SavedDesign } from "./types";

const KEY = "packio.designs.v1";

/** Keys this store used before the rebrand, newest first. Read once, never written to. */
const LEGACY_KEYS = ["boxstudio.designs.v1"];

/**
 * Designs saved before the Packio rebrand still open: the first read after the rename
 * copies them across. The old entry is left where it is, so downgrading or opening an
 * older build does not lose anybody's work.
 */
function adoptLegacyDesigns(): SavedDesign[] {
  for (const legacyKey of LEGACY_KEYS) {
    const raw = localStorage.getItem(legacyKey);
    if (!raw) continue;
    const list = JSON.parse(raw) as SavedDesign[];
    if (!Array.isArray(list) || list.length === 0) continue;
    localStorage.setItem(KEY, raw);
    return list;
  }
  return [];
}

function readAll(): SavedDesign[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedDesign[]) : adoptLegacyDesigns();
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
    const copy: SavedDesign = {
      ...structuredClone(src),
      id: newId,
      name: `${src.name} (สำเนา)`,
      createdAt: now,
      updatedAt: now,
    };
    return writeAll([...readAll(), copy]) ? copy : undefined;
  },
};
