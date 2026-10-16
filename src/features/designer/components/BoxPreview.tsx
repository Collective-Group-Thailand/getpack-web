import {
  allFaces,
  dielineLines,
  getStyle,
  REFERENCE_MATERIALS,
  svgPathData,
  type MaterialSpec,
  type ParamValues,
} from "@getpack/dieline";

import { CANVAS_COLORS } from "@/features/designer/canvas-colors";

export interface BoxPreviewProps {
  /** A `@getpack/dieline` style id. */
  styleId: string;
  /** The style's parameters (at least length, width, height in mm); defaults fill the rest. */
  values: ParamValues;
  /** The board, for caliper compensation. Defaults to a typical 350 g carton board. */
  material?: MaterialSpec;
  /** Board colour — describes real material, so it is literal, not a theme token. */
  colour?: string;
  /** Accessible description; omit only where a caption already names the same thing. */
  label?: string;
}

/**
 * The dieline as a small SVG — the setup dialog, the home page, and any card that should
 * "show the box" (design-system.md §1.2). Geometry comes from `@getpack/dieline`, so this
 * preview and the canvas can never disagree about the shape. Outlines are drawn from their
 * path data (true arcs), which keeps the offsetting engine out of the page.
 */
export function BoxPreview({
  styleId,
  values,
  material = REFERENCE_MATERIALS["board-350"],
  colour = "#fbfaf6",
  label,
}: BoxPreviewProps) {
  const dieline = getStyle(styleId).build(values, material);
  const pad = Math.max(dieline.width, dieline.height) * 0.04;
  const lines = dielineLines(dieline).filter((l) => l.role === "cut" || l.role === "crease");

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${dieline.width + pad * 2} ${dieline.height + pad * 2}`}
      className="h-full w-full"
      role={label ? "img" : "presentation"}
      aria-label={label}
    >
      {allFaces(dieline).map((face) => (
        <path
          key={face.id}
          d={[face.outline, ...face.holes].map((contour) => svgPathData(contour)).join(" ")}
          fillRule="evenodd"
          fill={colour}
        />
      ))}
      {lines.map((line, index) => (
        <path
          key={index}
          d={svgPathData([line.edge], false)}
          fill="none"
          stroke={line.role === "cut" ? CANVAS_COLORS.cut : CANVAS_COLORS.fold}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
          strokeDasharray={line.role === "crease" ? "4 3" : undefined}
        />
      ))}
    </svg>
  );
}
