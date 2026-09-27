"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { useLocale } from "next-intl";
import { Ellipse, Group, Image as KImage, Layer, Line, Path, Rect, Stage, Text, Transformer } from "react-konva";
import { useEditor } from "@/features/designer/store/editor";
import {
  allFaces,
  bleedOutline,
  dielineLines,
  faceBounds,
  faceLabel,
  flattenContour,
  PX_PER_MM,
  safeZone,
  svgPathData,
  type EdgeRole,
} from "@packio/dieline";
import { buildPatternTile } from "@/features/designer/patterns";
import { CANVAS_COLORS } from "@/features/designer/canvas-colors";
import type { Dieline, DesignElement } from "@/features/designer/types";

export const SAFE_ZONE_MM = 3;
const TILE_PX_PER_MM = 8;

const flat = (pts: [number, number][]) => pts.flatMap((p) => p);

/** How each kind of die line looks on the canvas. Print marks: not themed (see canvas-colors). */
const LINE_LOOK: Record<EdgeRole, { stroke: string; dash?: number[] }> = {
  cut: { stroke: CANVAS_COLORS.cut },
  crease: { stroke: CANVAS_COLORS.fold, dash: [6, 4] },
  perforation: { stroke: CANVAS_COLORS.fold, dash: [2, 2] },
  half_cut: { stroke: CANVAS_COLORS.cut, dash: [6, 2, 2, 2] },
  glue_area: { stroke: CANVAS_COLORS.panelLabel, dash: [3, 2] },
  bleed: { stroke: CANVAS_COLORS.safeZone, dash: [1, 3] },
};

function useHtmlImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const i = new window.Image();
    i.onload = () => setImg(i);
    i.src = src;
    return () => {
      i.onload = null;
    };
  }, [src]);
  return img;
}

function ImageNode(props: { el: Extract<DesignElement, { type: "image" }> } & Record<string, unknown>) {
  const { el, ...rest } = props;
  const img = useHtmlImage(el.src);
  return <KImage image={img ?? undefined} width={el.width} height={el.height} {...rest} />;
}

interface Props {
  dieline: Dieline;
  paperColor: string;
  stageRef: React.RefObject<Konva.Stage | null>;
  width: number;
  height: number;
  fitSignal: number;
  /** Viewing only (a customer's design opened by prepress): nothing moves, nothing selects. */
  readOnly?: boolean;
}

export default function DesignCanvas({
  dieline,
  paperColor,
  stageRef,
  width,
  height,
  fitSignal,
  readOnly = false,
}: Props) {
  const { content, selectedId, select, updateElement, zoom, setZoom, showLabels, showSafeZone, printMode, bleedMm } =
    useEditor();
  const locale = useLocale() as "th" | "en";
  const trRef = useRef<Konva.Transformer>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const scale = zoom * PX_PER_MM;

  const faces = useMemo(() => allFaces(dieline), [dieline]);
  const lines = useMemo(() => dielineLines(dieline).filter((l) => l.role !== "bleed"), [dieline]);
  const tile = useMemo(() => buildPatternTile(content.pattern, TILE_PX_PER_MM), [content.pattern]);
  const safe = useMemo(() => faces.flatMap((f) => safeZone(f, SAFE_ZONE_MM)), [faces]);
  // Flattened face outlines and holes, for clipping the artwork (holes stay clear).
  const clipContours = useMemo(
    () => faces.flatMap((f) => [f.outline, ...f.holes].map((c) => flattenContour(c))),
    [faces],
  );
  // The print file's clip: every piece grown by the bleed, so artwork runs past the cut (D-070).
  const bleedContours = useMemo(() => dieline.pieces.flatMap((p) => bleedOutline(p, bleedMm)), [dieline, bleedMm]);

  /*
   * Fit to view whenever asked, or when the sheet or the viewport changes size. This reacts to
   * a *measured* DOM size, which is not knowable during render, so the setState calls below
   * are the effect's purpose rather than a cascade — the case `set-state-in-effect` cannot
   * express.
   */
  useEffect(() => {
    if (!width || !height) return;
    const pad = 60;
    const z = Math.min(
      (width - pad * 2) / (dieline.width * PX_PER_MM),
      (height - pad * 2) / (dieline.height * PX_PER_MM),
    );
    const nz = Math.max(0.1, Math.min(4, z));
    setZoom(nz);
    const s = nz * PX_PER_MM;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos({ x: (width - dieline.width * s) / 2, y: (height - dieline.height * s) / 2 });
  }, [fitSignal, dieline, width, height, setZoom]);

  // Keep the transformer attached to the selected node.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selectedId ? stage.findOne(`#${selectedId}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, content, stageRef]);

  const clipFaces = (ctx: Konva.Context) => {
    ctx.beginPath();
    for (const contour of printMode ? bleedContours : clipContours) {
      contour.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
    }
    // Even-odd, so a window cut into a panel is a hole in the artwork too.
    return ["evenodd"] as [CanvasFillRule];
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    const old = zoom;
    const next = Math.max(0.1, Math.min(4, old * (e.evt.deltaY > 0 ? 1 / 1.1 : 1.1)));
    const mm = { x: (pointer.x - pos.x) / (old * PX_PER_MM), y: (pointer.y - pos.y) / (old * PX_PER_MM) };
    setZoom(next);
    setPos({ x: pointer.x - mm.x * next * PX_PER_MM, y: pointer.y - mm.y * next * PX_PER_MM });
  };

  const common = (el: DesignElement) => ({
    id: el.id,
    name: "design-element",
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    scaleX: el.scaleX,
    scaleY: el.scaleY,
    opacity: el.opacity,
    draggable: !readOnly,
    listening: !readOnly,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      select(el.id);
    },
    onTap: () => select(el.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => updateElement(el.id, { x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const n = e.target;
      updateElement(el.id, { x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() });
    },
  });

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      x={pos.x}
      y={pos.y}
      scaleX={scale}
      scaleY={scale}
      draggable
      onDragEnd={(e) => {
        if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() });
      }}
      onWheel={onWheel}
      onMouseDown={(e) => {
        if (e.target.name() !== "design-element" && !e.target.getParent()?.className?.includes("Transformer"))
          select(null);
      }}
      onTouchStart={(e) => {
        if (e.target === e.target.getStage()) select(null);
      }}
    >
      <Layer>
        {/* The print file is ink on white: no board colour, no shadow (the substrate is not printed). */}
        {printMode ? (
          <Rect
            x={-bleedMm - 1}
            y={-bleedMm - 1}
            width={dieline.width + 2 * bleedMm + 2}
            height={dieline.height + 2 * bleedMm + 2}
            fill="#ffffff"
            listening={false}
          />
        ) : null}
        {/* Paper */}
        <Group name="paper" visible={!printMode}>
          {faces.map((f) => (
            <Path
              key={f.id}
              data={[f.outline, ...f.holes].map((c) => svgPathData(c)).join(" ")}
              fillRule="evenodd"
              fill={paperColor}
              shadowColor={CANVAS_COLORS.paperShadow}
              shadowOpacity={0.12}
              shadowBlur={12}
              shadowForStrokeEnabled={false}
              listening={false}
            />
          ))}
        </Group>

        {/* Artwork, clipped to the dieline */}
        <Group clipFunc={clipFaces}>
          {content.pattern.kind === "solid" && (
            <Rect
              x={-bleedMm}
              y={-bleedMm}
              width={dieline.width + 2 * bleedMm}
              height={dieline.height + 2 * bleedMm}
              fill={content.pattern.color}
              listening={false}
            />
          )}
          {tile && (
            <Rect
              x={-bleedMm}
              y={-bleedMm}
              width={dieline.width + 2 * bleedMm}
              height={dieline.height + 2 * bleedMm}
              fillPatternImage={tile as unknown as HTMLImageElement}
              fillPatternScaleX={1 / TILE_PX_PER_MM}
              fillPatternScaleY={1 / TILE_PX_PER_MM}
              listening={false}
            />
          )}
          {content.elements.map((el) => {
            switch (el.type) {
              case "text":
                return (
                  <Text
                    key={el.id}
                    {...common(el)}
                    text={el.text}
                    fontSize={el.fontSize}
                    fontFamily={el.fontFamily}
                    fontStyle={el.fontStyle}
                    fill={el.fill}
                    align={el.align}
                    lineHeight={1.25}
                  />
                );
              case "image":
                return <ImageNode key={el.id} el={el} {...common(el)} />;
              case "rect":
                return (
                  <Rect
                    key={el.id}
                    {...common(el)}
                    width={el.width}
                    height={el.height}
                    fill={el.fill}
                    stroke={el.strokeWidth ? el.stroke : undefined}
                    strokeWidth={el.strokeWidth}
                    cornerRadius={el.cornerRadius}
                  />
                );
              case "circle":
                return (
                  <Ellipse
                    key={el.id}
                    {...common(el)}
                    radiusX={el.width / 2}
                    radiusY={el.height / 2}
                    offsetX={-el.width / 2}
                    offsetY={-el.height / 2}
                    fill={el.fill}
                    stroke={el.strokeWidth ? el.stroke : undefined}
                    strokeWidth={el.strokeWidth}
                  />
                );
            }
          })}
        </Group>

        {/* Guides */}
        <Group name="guide" listening={false} visible={!printMode}>
          {showSafeZone &&
            safe.map((pts, i) => (
              <Line
                key={`s${i}`}
                points={flat(pts)}
                closed
                stroke={CANVAS_COLORS.safeZone}
                strokeWidth={0.8}
                dash={[3, 3]}
                strokeScaleEnabled={false}
                opacity={0.7}
              />
            ))}
          {lines.map((l, i) => (
            <Path
              key={i}
              data={svgPathData([l.edge], false)}
              stroke={LINE_LOOK[l.role].stroke}
              strokeWidth={1.3}
              dash={LINE_LOOK[l.role].dash}
              strokeScaleEnabled={false}
            />
          ))}
          {showLabels &&
            faces.map((f) => {
              const b = faceBounds(f);
              const cx = b.x + b.width / 2;
              const cy = b.y + b.height / 2;
              const size = Math.max(2, Math.min(14, 12 / (zoom * PX_PER_MM)));
              return (
                <Text
                  key={f.id}
                  text={faceLabel(f.label)[locale]}
                  x={cx - 50}
                  y={cy - size / 2}
                  width={100}
                  align="center"
                  fontSize={size}
                  fill={CANVAS_COLORS.panelLabel}
                  opacity={0.8}
                />
              );
            })}
        </Group>

        <Transformer
          ref={trRef}
          visible={!printMode && !readOnly}
          name="guide"
          rotateEnabled
          ignoreStroke
          anchorSize={9}
          borderStroke={CANVAS_COLORS.selection}
          anchorStroke={CANVAS_COLORS.selection}
          anchorCornerRadius={2}
          boundBoxFunc={(o, n) => (Math.abs(n.width) < 4 || Math.abs(n.height) < 4 ? o : n)}
        />
      </Layer>
    </Stage>
  );
}
