import { assemble, face, piece } from "../faces";
import type { FaceLabel } from "../labels";
import type { Contour, Dieline, Edge, MaterialSpec } from "../types";
import { t } from "./_shared";

/** One flat shape — a label, tag or band: a single face, cut all round. No folding, no 3D (D-152: 2D mockups). */
export function flatDieline(
  styleId: string,
  outline: Contour,
  label: FaceLabel = "label",
  extra: { holes?: Contour[]; marks?: Edge[] } = {},
): Dieline {
  return assemble(styleId, [piece("blank", "blank", [face("label", label, "flat", outline, extra)])]);
}

export const FLAT_MATERIALS: MaterialSpec["kind"][] = ["label", "paperboard", "flexible"];

export const LABEL_PRESETS = [
  { id: "a", label: t("50 × 50", "50 × 50"), values: { length: 50, width: 50 } },
  { id: "b", label: t("100 × 60", "100 × 60"), values: { length: 100, width: 60 } },
  { id: "c", label: t("150 × 100", "150 × 100"), values: { length: 150, width: 100 } },
];
