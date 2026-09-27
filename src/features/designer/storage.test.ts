import { beforeEach, describe, expect, it } from "vitest";
import { designRepo } from "./storage";
import type { SavedDesign } from "./types";

const KEY = "packio.designs.v1";
const LEGACY_KEY = "boxstudio.designs.v1";

const content = { elements: [], pattern: { kind: "none" as const, color: "#000000", background: "#ffffff", size: 12 } };

const design = (id: string, name: string, updatedAt: number): SavedDesign => ({
  id,
  name,
  spec: {
    specVersion: 2,
    styleId: "rsc",
    values: { length: 150, width: 100, height: 80 },
    material: { caliperMm: 1.6, kind: "corrugated", flute: "E" },
    materialId: "e-white",
  },
  content,
  createdAt: updatedAt,
  updatedAt,
});

/** A design as BoxStudio stored it: `{ style, dims, paperId }`, no spec version. */
const boxStudioDesign = (id: string, name: string, updatedAt: number) => ({
  id,
  name,
  spec: { style: "rsc", dims: { length: 150, width: 100, height: 80 }, paperId: "e-white" },
  content,
  createdAt: updatedAt,
  updatedAt,
});

beforeEach(() => localStorage.clear());

describe("designRepo", () => {
  it("lists newest first", () => {
    designRepo.save(design("a", "เก่า", 1));
    designRepo.save(design("b", "ใหม่", 2));
    expect(designRepo.list().map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("saves, reads back and removes", () => {
    designRepo.save(design("a", "กล่อง", 1));
    expect(designRepo.get("a")?.name).toBe("กล่อง");
    designRepo.remove("a");
    expect(designRepo.get("a")).toBeUndefined();
  });

  it("duplicates under a new id with a copy suffix", () => {
    designRepo.save(design("a", "กล่อง", 1));
    const copy = designRepo.duplicate("a", "b");
    expect(copy?.id).toBe("b");
    expect(copy?.name).toBe("กล่อง (สำเนา)");
    expect(designRepo.list()).toHaveLength(2);
  });
});

describe("migration from BoxStudio", () => {
  it("reads a BoxStudio-era spec as an engine v2 spec", () => {
    localStorage.setItem(KEY, JSON.stringify([boxStudioDesign("old", "แบบเดิม", 1)]));
    expect(designRepo.get("old")?.spec).toMatchObject({
      specVersion: 2,
      styleId: "rsc",
      values: { length: 150, width: 100, height: 80 },
      materialId: "e-white",
    });
  });

  it("adopts designs saved before the rebrand", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([boxStudioDesign("old", "แบบเดิม", 1)]));

    expect(designRepo.list().map((d) => d.id)).toEqual(["old"]);
    // copied under the new key, and the old entry is left intact
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(1);
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });

  it("does not resurrect old designs once the new key exists", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([boxStudioDesign("old", "แบบเดิม", 1)]));
    designRepo.save(design("new", "แบบใหม่", 2));
    designRepo.remove("old");
    designRepo.remove("new");

    expect(designRepo.list()).toEqual([]);
  });

  it("ignores an empty or unreadable legacy entry", () => {
    localStorage.setItem(LEGACY_KEY, "[]");
    expect(designRepo.list()).toEqual([]);

    localStorage.setItem(LEGACY_KEY, "{ not json");
    expect(designRepo.list()).toEqual([]);
  });
});
