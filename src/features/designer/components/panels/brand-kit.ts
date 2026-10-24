import type { ImageElement } from "../../types";

/**
 * The brand kit kept in this browser (BrandPanel). Its own module: every colour field reads it
 * (`useSwatches`), and importing it from BrandPanel brought the whole panel — company kits and the
 * template layouts — into the editor's first load, though the panel itself loads on demand.
 */
const KEY = "getpack.brandkit";

export interface BrandKit {
  colours: string[];
  logo: Omit<ImageElement, "id" | "x" | "y"> | null;
}

export function readBrandKit(): BrandKit {
  try {
    const raw = localStorage.getItem(KEY);
    const kit = raw ? (JSON.parse(raw) as Partial<BrandKit>) : {};
    return { colours: Array.isArray(kit.colours) ? kit.colours : [], logo: kit.logo ?? null };
  } catch {
    return { colours: [], logo: null };
  }
}

export function saveBrandKit(kit: BrandKit) {
  try {
    localStorage.setItem(KEY, JSON.stringify(kit));
  } catch {
    // Storage full or blocked: the kit lasts for this visit.
  }
}
