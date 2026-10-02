import { assemble, face, piece } from "../faces";
import type { FaceLabel } from "../labels";
import type { Contour, Dieline, Edge } from "../types";

/** One flat shape — a label, tag or band: a single face, cut all round. No folding, no 3D (D-152: 2D mockups). */
export function flatDieline(
  styleId: string,
  outline: Contour,
  label: FaceLabel = "label",
  extra: { holes?: Contour[]; marks?: Edge[] } = {},
): Dieline {
  return assemble(styleId, [piece("blank", "blank", [face("label", label, "flat", outline, extra)])]);
}
