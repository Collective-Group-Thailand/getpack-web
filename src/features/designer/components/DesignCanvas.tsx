"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Ellipse, Group, Image as KImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { useEditor } from "@/features/designer/store/editor";
import { dielineSegments, faceCentroid, flat, insetConvex, PX_PER_MM } from "@packio/dieline";
import { buildPatternTile } from "@/features/designer/patterns";
import { CANVAS_COLORS } from "@/features/designer/canvas-colors";
import type { Dieline, DesignElement } from "@/features/designer/types";

export const SAFE_ZONE_MM = 3;
const TILE_PX_PER_MM = 8;

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
}

export default function DesignCanvas({ dieline, paperColor, stageRef, width, height, fitSignal }: Props) {
  const { content, selectedId, select, updateElement, zoom, setZoom, showLabels, showSafeZone } = useEditor();
  const trRef = useRef<Konva.Transformer>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const scale = zoom * PX_PER_MM;

  const segments = useMemo(() => dielineSegments(dieline), [dieline]);
  const tile = useMemo(() => buildPatternTile(content.pattern, TILE_PX_PER_MM), [content.pattern]);
  const safe = useMemo(
    () => dieline.faces.map((f) => insetConvex(f.points, SAFE_ZONE_MM)).filter((p): p is NonNullable<typeof p> => !!p),
    [dieline],
  );

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
    for (const f of dieline.faces) {
      f.points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
    }
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
    draggable: true,
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
        {/* Paper */}
        <Group name="paper">
          {dieline.faces.map((f) => (
            <Line
              key={f.id}
              points={flat(f.points)}
              closed
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
            <Rect width={dieline.width} height={dieline.height} fill={content.pattern.color} listening={false} />
          )}
          {tile && (
            <Rect
              width={dieline.width}
              height={dieline.height}
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
        <Group name="guide" listening={false}>
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
          {segments.map((s, i) => (
            <Line
              key={i}
              points={[...s.a, ...s.b]}
              stroke={s.kind === "cut" ? CANVAS_COLORS.cut : CANVAS_COLORS.fold}
              strokeWidth={1.3}
              dash={s.kind === "fold" ? [6, 4] : undefined}
              strokeScaleEnabled={false}
            />
          ))}
          {showLabels &&
            dieline.faces.map((f) => {
              const [cx, cy] = faceCentroid(f);
              const size = Math.max(2, Math.min(14, 12 / (zoom * PX_PER_MM)));
              return (
                <Text
                  key={f.id}
                  text={f.name}
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
