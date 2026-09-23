import { buildDieline, dielineSegments } from "@packio/dieline";

import { CANVAS_COLORS } from "@/features/designer/canvas-colors";
import { getPaper } from "@/features/designer/catalog";
import type { BoxDims, BoxStyleId } from "@/features/designer/types";

export interface BoxPreviewProps {
  style: BoxStyleId;
  dims: BoxDims;
  /**
   * Board id from the paper catalogue. The preview looks the colour up itself, so a caller
   * never handles a hex — the board colours describe real material, not theme.
   */
  paper: string;
  /** Accessible description; omit only where a caption already names the same thing. */
  label?: string;
}

/**
 * The dieline as a small SVG — the setup dialog, the home page, and any card that should
 * "show the box" (design-system.md §1.2). Geometry comes from `@packio/dieline`, so this
 * preview and the canvas can never disagree about the shape.
 */
export function BoxPreview({ style, dims, paper, label }: BoxPreviewProps) {
  const dieline = buildDieline(style, dims);
  const segments = dielineSegments(dieline);
  const board = getPaper(paper);
  const pad = Math.max(dieline.width, dieline.height) * 0.04;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${dieline.width + pad * 2} ${dieline.height + pad * 2}`}
      className="h-full w-full"
      role={label ? "img" : "presentation"}
      aria-label={label}
    >
      {dieline.faces.map((face) => (
        <polygon key={face.id} points={face.points.map((point) => point.join(",")).join(" ")} fill={board.color} />
      ))}
      {segments.map((segment, index) => (
        <line
          key={index}
          x1={segment.a[0]}
          y1={segment.a[1]}
          x2={segment.b[0]}
          y2={segment.b[1]}
          stroke={segment.kind === "cut" ? CANVAS_COLORS.cut : CANVAS_COLORS.fold}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
          strokeDasharray={segment.kind === "fold" ? "4 3" : undefined}
        />
      ))}
    </svg>
  );
}
