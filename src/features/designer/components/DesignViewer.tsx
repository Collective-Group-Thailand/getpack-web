import { buildDieline, dielineSegments } from "@packio/dieline";

import { CANVAS_COLORS } from "@/features/designer/canvas-colors";
import { BOX_STYLES, getPaper } from "@/features/designer/catalog";
import type { DesignContent, DesignElement, DesignSpec } from "@/features/designer/types";

/**
 * Reads a stored design document (`design_documents` → its current version's `document`) into
 * the designer's own types, or `null` when it is not one this build understands. A viewer must
 * not throw on a document written by a newer designer; it says it cannot show it instead.
 */
export function readDesignDocument(document: {
  spec: Record<string, unknown>;
  content: Record<string, unknown>;
}): { spec: DesignSpec; content: DesignContent } | null {
  const spec = document.spec as Partial<DesignSpec>;
  const content = document.content as Partial<DesignContent>;
  const dims = spec.dims;
  if (
    !spec.style ||
    !BOX_STYLES.some((style) => style.id === spec.style) ||
    !dims ||
    ![dims.length, dims.width, dims.height].every((value) => typeof value === "number" && value > 0) ||
    typeof spec.paperId !== "string" ||
    !Array.isArray(content.elements) ||
    !content.pattern
  ) {
    return null;
  }
  return { spec: spec as DesignSpec, content: content as DesignContent };
}

function transform(element: DesignElement): string {
  return `translate(${element.x} ${element.y}) rotate(${element.rotation}) scale(${element.scaleX} ${element.scaleY})`;
}

function Element({ element }: { element: DesignElement }) {
  switch (element.type) {
    case "text": {
      const anchor = element.align === "center" ? "middle" : element.align === "right" ? "end" : "start";
      return (
        <text
          transform={transform(element)}
          opacity={element.opacity}
          fill={element.fill}
          fontFamily={element.fontFamily}
          fontSize={element.fontSize}
          fontWeight={element.fontStyle.includes("bold") ? 700 : 400}
          fontStyle={element.fontStyle.includes("italic") ? "italic" : "normal"}
          textAnchor={anchor}
          dominantBaseline="hanging"
        >
          {element.text.split("\n").map((line, index) => (
            <tspan key={index} x={0} dy={index === 0 ? 0 : element.fontSize * 1.25}>
              {line}
            </tspan>
          ))}
        </text>
      );
    }
    case "image":
      return (
        <image
          transform={transform(element)}
          opacity={element.opacity}
          href={element.src}
          width={element.width}
          height={element.height}
          preserveAspectRatio="none"
        />
      );
    case "rect":
      return (
        <rect
          transform={transform(element)}
          opacity={element.opacity}
          width={element.width}
          height={element.height}
          rx={element.cornerRadius}
          fill={element.fill}
          stroke={element.strokeWidth ? element.stroke : undefined}
          strokeWidth={element.strokeWidth || undefined}
        />
      );
    case "circle":
      return (
        <ellipse
          transform={transform(element)}
          opacity={element.opacity}
          cx={element.width / 2}
          cy={element.height / 2}
          rx={element.width / 2}
          ry={element.height / 2}
          fill={element.fill}
          stroke={element.strokeWidth ? element.stroke : undefined}
          strokeWidth={element.strokeWidth || undefined}
        />
      );
  }
}

export interface DesignViewerProps {
  spec: DesignSpec;
  content: DesignContent;
  /** Accessible description of the picture, e.g. the design's title. */
  label: string;
  /** Prefix for the SVG ids, unique on the page. */
  idPrefix: string;
}

/**
 * A design, read-only, as an SVG of the flat dieline with its artwork clipped to the panels —
 * the same geometry (`@packio/dieline`) and coordinates (millimetres) the editor's canvas uses,
 * without the editor. For the back office's "open a design read-only" (F2 2.4); patterns other
 * than a solid fill show their background colour only, so this is a preview, not the proof.
 */
export function DesignViewer({ spec, content, label, idPrefix }: DesignViewerProps) {
  const dieline = buildDieline(spec.style, spec.dims);
  const segments = dielineSegments(dieline);
  const board = getPaper(spec.paperId);
  const pad = Math.max(dieline.width, dieline.height) * 0.04;
  const clipId = `${idPrefix}-clip`;
  const fill =
    content.pattern.kind === "solid"
      ? content.pattern.color
      : content.pattern.kind === "none"
        ? undefined
        : content.pattern.background;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${dieline.width + pad * 2} ${dieline.height + pad * 2}`}
      className="h-full w-full"
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id={clipId}>
          {dieline.faces.map((face) => (
            <polygon key={face.id} points={face.points.map((point) => point.join(",")).join(" ")} />
          ))}
        </clipPath>
      </defs>
      {dieline.faces.map((face) => (
        <polygon key={face.id} points={face.points.map((point) => point.join(",")).join(" ")} fill={board.color} />
      ))}
      <g clipPath={`url(#${clipId})`}>
        {fill ? <rect width={dieline.width} height={dieline.height} fill={fill} /> : null}
        {content.elements.map((element) => (
          <Element key={element.id} element={element} />
        ))}
      </g>
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
