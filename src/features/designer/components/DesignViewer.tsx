import { allFaces, dielineLines, svgPathData } from "@getpack/dieline";

import { CANVAS_COLORS } from "@/features/designer/canvas-colors";
import { boardColour } from "@/features/designer/catalog";
import { dielineOf, readDesign } from "@/features/designer/document";
import { barModules, barsPath, qrMatrix, qrPath } from "@/features/designer/lib/codes";
import type { DesignContent, DesignElement, DesignSpec } from "@/features/designer/types";

/**
 * Reads a stored design document (`design_documents` → its current version's `document`) into
 * the designer's own types — migrating a BoxStudio-era one — or `null` when it is not one this
 * build understands. A viewer must not throw on a document written by a newer designer; it
 * says it cannot show it instead.
 */
export function readDesignDocument(document: {
  spec: Record<string, unknown>;
  content: Record<string, unknown>;
}): { spec: DesignSpec; content: DesignContent } | null {
  return readDesign(document.spec, document.content);
}

function transform(element: DesignElement): string {
  return `translate(${element.x} ${element.y}) rotate(${element.rotation}) scale(${element.scaleX} ${element.scaleY})`;
}

function Element({ element, idPrefix }: { element: DesignElement; idPrefix: string }) {
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
    case "image": {
      const crop = element.crop;
      if (!crop) {
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
      }
      // The shown part of the image stretched to the element's box, the rest clipped away.
      const w = element.width / crop.width;
      const h = element.height / crop.height;
      const clip = `${idPrefix}-crop-${element.id}`;
      return (
        <g transform={transform(element)} opacity={element.opacity}>
          <clipPath id={clip}>
            <rect width={element.width} height={element.height} />
          </clipPath>
          <image
            clipPath={`url(#${clip})`}
            href={element.src}
            x={-crop.x * w}
            y={-crop.y * h}
            width={w}
            height={h}
            preserveAspectRatio="none"
          />
        </g>
      );
    }
    case "shape":
      return (
        <path
          transform={`${transform(element)} scale(${element.width / 100} ${element.height / 100})`}
          opacity={element.opacity}
          d={element.path}
          fill={element.fill}
          stroke={element.strokeWidth ? element.stroke : undefined}
          strokeWidth={element.strokeWidth ? (element.strokeWidth * 100) / element.width : undefined}
        />
      );
    case "code": {
      const qr = element.kind === "qr" ? qrMatrix(element.value) : null;
      const modules = element.kind !== "qr" ? barModules(element.kind, element.value) : null;
      return (
        <g transform={transform(element)} opacity={element.opacity}>
          <rect width={element.width} height={element.height} fill={element.background} />
          {qr ? (
            <path
              d={qrPath(qr)}
              transform={`scale(${element.width / qr.size} ${element.height / qr.size})`}
              fill={element.fill}
            />
          ) : null}
          {modules ? (
            <>
              <path
                d={barsPath(modules)}
                transform={`scale(${element.width / modules.length} ${element.height * 0.82})`}
                fill={element.fill}
              />
              <text
                x={element.width / 2}
                y={element.height * 0.83}
                fontSize={element.height * 0.15}
                fontFamily="JetBrains Mono, monospace"
                textAnchor="middle"
                dominantBaseline="hanging"
                fill={element.fill}
              >
                {element.value}
              </text>
            </>
          ) : null}
        </g>
      );
    }
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
 * the same geometry (`@getpack/dieline`) and coordinates (millimetres) the editor's canvas uses,
 * without the editor. For the back office's "open a design read-only" (F2 2.4); patterns other
 * than a solid fill show their background colour only, so this is a preview, not the proof.
 */
export function DesignViewer({ spec, content, label, idPrefix }: DesignViewerProps) {
  const dieline = dielineOf(spec);
  const faces = allFaces(dieline);
  const lines = dielineLines(dieline).filter((l) => l.role === "cut" || l.role === "crease");
  const board = boardColour(spec);
  const facePath = (face: (typeof faces)[number]) => [face.outline, ...face.holes].map((c) => svgPathData(c)).join(" ");
  const pad = Math.max(dieline.width, dieline.height) * 0.04;
  const clipId = `${idPrefix}-clip`;
  const fill =
    content.pattern.kind === "solid" || content.pattern.kind === "gradient"
      ? content.pattern.color
      : content.pattern.kind === "none" || content.pattern.kind === "image"
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
          {faces.map((face) => (
            <path key={face.id} d={facePath(face)} clipRule="evenodd" />
          ))}
        </clipPath>
        {faces.map((face) => (
          <clipPath key={face.id} id={`${clipId}-${face.id}`}>
            <path d={facePath(face)} clipRule="evenodd" />
          </clipPath>
        ))}
      </defs>
      {faces.map((face) => (
        <path key={face.id} d={facePath(face)} fillRule="evenodd" fill={board} />
      ))}
      <g clipPath={`url(#${clipId})`}>
        {fill ? <rect width={dieline.width} height={dieline.height} fill={fill} /> : null}
        {content.elements.map((element) =>
          element.clipFaceId && faces.some((f) => f.id === element.clipFaceId) ? (
            <g key={element.id} clipPath={`url(#${clipId}-${element.clipFaceId})`}>
              <Element element={element} idPrefix={idPrefix} />
            </g>
          ) : (
            <Element key={element.id} element={element} idPrefix={idPrefix} />
          ),
        )}
      </g>
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
