import type { BoxCategory, MaterialSpec } from "./types";

/**
 * Typical boards per category, for tests, fixtures and previews drawn before the catalogue
 * answers. **Not a catalogue**: real calipers come from the catalogue API (`paper_grade`,
 * `flute_type`), and a quote or print file never uses these.
 */
export const REFERENCE_MATERIALS: Readonly<Record<string, MaterialSpec>> = {
  "board-350": { caliperMm: 0.45, kind: "paperboard" },
  "board-450": { caliperMm: 0.6, kind: "paperboard" },
  "flute-e": { caliperMm: 1.6, kind: "corrugated", flute: "E" },
  "flute-b": { caliperMm: 3, kind: "corrugated", flute: "B" },
  "flute-bc": { caliperMm: 6.5, kind: "corrugated", flute: "BC" },
  "rigid-2": { caliperMm: 2, kind: "rigid" },
  "label-film": { caliperMm: 0.1, kind: "label" },
};

/** Which reference boards each category is exercised with, the first being its default. */
export const REFERENCE_BY_CATEGORY: Readonly<Record<BoxCategory, string[]>> = {
  folding_carton: ["board-350", "board-450", "flute-e"],
  corrugated: ["flute-e", "flute-b", "flute-bc"],
  tray_lid: ["board-350", "flute-e", "flute-b"],
  specialty: ["board-350", "board-450"],
  flat: ["label-film", "board-350"],
};
