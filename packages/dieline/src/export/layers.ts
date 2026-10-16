import type { EdgeRole } from "../types";

/** Export layer per line role. Names are what die-makers and CAD tools expect to find. */
export const LAYER_OF: Record<EdgeRole, LayerName> = {
  cut: "CUT",
  crease: "CREASE",
  perforation: "PERF",
  half_cut: "HALFCUT",
  glue_area: "GLUE",
  bleed: "BLEED",
};

export type LayerName = "CUT" | "CREASE" | "PERF" | "HALFCUT" | "GLUE" | "BLEED";

export const LAYER_ORDER: readonly LayerName[] = ["CUT", "CREASE", "PERF", "HALFCUT", "GLUE", "BLEED"];

/**
 * The die-maker's colour convention per layer. Pure red cut and pure blue crease are what the
 * trade reads; these are file conventions, not getpack's brand colours.
 */
export const LAYER_STYLE: Record<
  LayerName,
  { hex: string; dash?: string; dxfColor: number; spot: string; cmyk: [number, number, number, number] }
> = {
  CUT: { hex: "#ff0000", dxfColor: 1, spot: "CutContour", cmyk: [0, 1, 0, 0] },
  CREASE: { hex: "#0066ff", dash: "3 2", dxfColor: 5, spot: "Crease", cmyk: [1, 0.5, 0, 0] },
  PERF: { hex: "#00a651", dash: "1 1", dxfColor: 3, spot: "Perforation", cmyk: [0.8, 0, 1, 0] },
  HALFCUT: { hex: "#ff00ff", dash: "4 1 1 1", dxfColor: 6, spot: "HalfCut", cmyk: [0, 1, 0, 0] },
  GLUE: { hex: "#ffb000", dash: "2 1", dxfColor: 2, spot: "Glue", cmyk: [0, 0.3, 1, 0] },
  BLEED: { hex: "#00b7eb", dash: "1 2", dxfColor: 4, spot: "Bleed", cmyk: [0.7, 0, 0, 0] },
};
