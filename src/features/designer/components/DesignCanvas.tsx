"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { useLocale } from "next-intl";
import {
  Circle,
  Ellipse,
  Group,
  Image as KImage,
  Layer,
  Line,
  Path,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import {
  allFaces,
  bleedOutline,
  dielineLines,
  faceBounds,
  faceLabel,
  flattenContour,
  pointInPolygon,
  PX_PER_MM,
  safeZone,
  svgPathData,
  type EdgeRole,
  type Face,
  type Bounds,
  type Pt,
} from "@packio/dieline";

import { CANVAS_COLORS } from "@/features/designer/canvas-colors";
import { formatMm } from "@/i18n/format";
import { barModules, barsPath, qrMatrix, qrPath } from "@/features/designer/lib/codes";
import { linesOf, snapBox, type SnapTargets } from "@/features/designer/lib/snapping";
import { buildPatternTile } from "@/features/designer/patterns";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "@/features/designer/store/editor";
import { useCommentPins } from "@/features/designer/comments/pins";
import { useCanvasStatus } from "@/features/designer/store/status";
import type { CodeElement, DesignContent, DesignElement, Dieline, ImageElement } from "@/features/designer/types";

export const SAFE_ZONE_MM = 3;
const TILE_PX_PER_MM = 8;
/** Snap within this many screen pixels. */
const SNAP_PX = 6;

const flat = (pts: Pt[]) => pts.flatMap((p) => p);

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
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = src;
    return () => {
      i.onload = null;
    };
  }, [src]);
  return img;
}

type NodeProps = Record<string, unknown>;

function ImageNode({ el, ...rest }: { el: ImageElement } & NodeProps) {
  const img = useHtmlImage(el.src);
  const crop =
    img && el.crop
      ? {
          x: el.crop.x * img.naturalWidth,
          y: el.crop.y * img.naturalHeight,
          width: el.crop.width * img.naturalWidth,
          height: el.crop.height * img.naturalHeight,
        }
      : undefined;
  return <KImage image={img ?? undefined} width={el.width} height={el.height} crop={crop} {...rest} />;
}

/** A QR code or barcode: its background (the quiet zone included) and its modules as one path. */
function CodeNode({ el, ...rest }: { el: CodeElement } & NodeProps) {
  const drawing = useMemo(() => {
    if (el.kind === "qr") {
      const m = qrMatrix(el.value);
      return m ? { d: qrPath(m), sx: el.width / m.size, sy: el.height / m.size, digits: null } : null;
    }
    const modules = barModules(el.kind, el.value);
    if (!modules) return null;
    return { d: barsPath(modules), sx: el.width / modules.length, sy: el.height * 0.82, digits: el.value };
  }, [el.kind, el.value, el.width, el.height]);
  return (
    <Group {...rest}>
      <Rect width={el.width} height={el.height} fill={el.background} />
      {drawing ? <Path data={drawing.d} scaleX={drawing.sx} scaleY={drawing.sy} fill={el.fill} /> : null}
      {drawing?.digits ? (
        <Text
          text={drawing.digits}
          y={el.height * 0.83}
          width={el.width}
          align="center"
          fontSize={el.height * 0.15}
          fontFamily="JetBrains Mono, monospace"
          fill={el.fill}
        />
      ) : null}
      {!drawing ? (
        <Rect width={el.width} height={el.height} stroke={CANVAS_COLORS.cut} strokeWidth={0.3} dash={[2, 2]} />
      ) : null}
    </Group>
  );
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
  /** Each face's rotation to read upright on the box (from the fold), for face focus. */
  upright?: Record<string, number>;
  safeMm?: number;
}

/** How each finish shows on the flat sheet (a preview: the 3D model and the print file use masks). */
const FINISH_LOOK: Record<NonNullable<DesignElement["finish"]>, string> = {
  foil: "#c9a227",
  spot_uv: "rgba(110, 150, 255, 0.4)",
  emboss: "rgba(150, 110, 200, 0.4)",
  window: "rgba(140, 200, 255, 0.5)",
};

/** The inside carries no background pattern (yet): only the outside has one. */
const NO_PATTERN = { kind: "none", color: "#000000", background: "#ffffff", size: 12 } as const;

export default function DesignCanvas({
  dieline,
  paperColor,
  stageRef,
  width,
  height,
  fitSignal,
  readOnly = false,
  upright = {},
  safeMm = SAFE_ZONE_MM,
}: Props) {
  const {
    content,
    selectedIds,
    select,
    selectMany,
    updateElements,
    zoom,
    setZoom,
    showLabels,
    showSafeZone,
    showGrid,
    showRulers,
    snapping,
    printMode,
    bleedMm,
    focusedFaceId,
    focusFace,
    side,
  } = useEditor();
  // The side being edited (U4.3): its elements only; the background pattern is the outside's.
  const elements = useMemo(
    () => content.elements.filter((e) => (e.side ?? "outside") === side),
    [content.elements, side],
  );
  const pattern = side === "inside" ? NO_PATTERN : content.pattern;
  const pins = useCommentPins((s) => s.pins);
  const activePin = useCommentPins((s) => s.active);
  const placing = useCommentPins((s) => s.placing);
  const locale = useLocale() as "th" | "en";
  const trRef = useRef<Konva.Transformer>(null);
  const worldRef = useRef<Konva.Group>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [guides, setGuides] = useState<{ axis: "x" | "y"; at: number }[]>([]);
  /** While dragging one element: its box and the face it is on, for the distance labels in mm (U4.3). */
  const [gaps, setGaps] = useState<{ box: Bounds; face: Bounds } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragStart = useRef<Map<string, { x: number; y: number }> | null>(null);
  const scale = zoom * PX_PER_MM;

  const faces = useMemo(() => allFaces(dieline), [dieline]);
  const faceById = useMemo(() => new Map(faces.map((f) => [f.id, f])), [faces]);
  const lines = useMemo(() => dielineLines(dieline).filter((l) => l.role !== "bleed"), [dieline]);
  const tile = useMemo(() => buildPatternTile(pattern, TILE_PX_PER_MM), [pattern]);
  const safe = useMemo(() => faces.flatMap((f) => safeZone(f, safeMm)), [faces, safeMm]);
  const facePolys = useMemo(() => faces.map((f) => ({ id: f.id, poly: flattenContour(f.outline, 0.5) })), [faces]);
  // Flattened outlines and holes: the sheet clip (holes stay clear) and each face's own clip.
  const contoursOf = (fs: Face[]) => fs.flatMap((f) => [f.outline, ...f.holes].map((c) => flattenContour(c)));
  const sheetContours = useMemo(() => contoursOf(faces), [faces]);
  const bleedContours = useMemo(() => dieline.pieces.flatMap((p) => bleedOutline(p, bleedMm)), [dieline, bleedMm]);
  const focused = focusedFaceId ? faceById.get(focusedFaceId) : undefined;
  const angle = focused ? (upright[focused.id] ?? 0) : 0;
  const focusBox = focused ? faceBounds(focused) : null;
  const pivot = focusBox ? { x: focusBox.x + focusBox.width / 2, y: focusBox.y + focusBox.height / 2 } : { x: 0, y: 0 };
  const selectable = new Set(elements.filter((e) => !e.locked).map((e) => e.id));

  // Snap targets: face edges and centres, safe-zone lines, the sheet's centre, and the other
  // elements' edges and centres (read from their nodes, so text is measured, not guessed).
  const targets = (exclude: Set<string>): SnapTargets => {
    const boxes = faces.map((f) => faceBounds(f));
    const faceLines = linesOf(boxes);
    const safeLines = linesOf(
      boxes.map((b) => ({
        x: b.x + safeMm,
        y: b.y + safeMm,
        width: b.width - 2 * safeMm,
        height: b.height - 2 * safeMm,
      })),
    );
    const world = worldRef.current;
    const others = world
      ? elements
          .filter((e) => !exclude.has(e.id))
          .map((e) => world.findOne(`#${e.id}`)?.getClientRect({ relativeTo: world }))
          .filter((r): r is NonNullable<typeof r> => !!r)
      : [];
    const elementLines = linesOf(others);
    return {
      xs: [...faceLines.xs, ...safeLines.xs, ...elementLines.xs, dieline.width / 2],
      ys: [...faceLines.ys, ...safeLines.ys, ...elementLines.ys, dieline.height / 2],
    };
  };

  /*
   * Fit to view whenever asked, when the sheet or the viewport changes size, or when a face is
   * focused (then the face fills the view, turned upright). This reacts to a *measured* DOM size,
   * which is not knowable during render, so the setState calls are the effect's purpose.
   */
  useEffect(() => {
    if (!width || !height) return;
    const pad = 60;
    const box = focusBox ?? { x: 0, y: 0, width: dieline.width, height: dieline.height };
    const turned = angle % 180 !== 0;
    const w = turned ? box.height : box.width;
    const h = turned ? box.width : box.height;
    const z = Math.min((width - pad * 2) / (w * PX_PER_MM), (height - pad * 2) / (h * PX_PER_MM));
    const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    setZoom(nz);
    const s = nz * PX_PER_MM;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos({ x: width / 2 - cx * s, y: height / 2 - cy * s });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal, dieline, width, height, setZoom, focusedFaceId]);

  useEffect(() => {
    useCanvasStatus.getState().set({ origin: pos, scale });
  }, [pos, scale]);

  // Keep the transformer attached to the selected, unlocked nodes.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = readOnly
      ? []
      : selectedIds
          .filter((id) => selectable.has(id))
          .flatMap((id) => {
            const node = stage.findOne(`#${id}`);
            return node ? [node] : [];
          });
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, content, stageRef, readOnly]);

  const clipTo = (contours: Pt[][]) => (ctx: Konva.Context) => {
    ctx.beginPath();
    for (const contour of contours) {
      contour.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
    }
    // Even-odd, so a window cut into a panel is a hole in the artwork too.
    return ["evenodd"] as [CanvasFillRule];
  };
  const sheetClip = clipTo(printMode ? bleedContours : sheetContours);

  /** Sheet millimetres under a stage point (undoing pan, zoom and the focus rotation). */
  const toSheet = (p: { x: number; y: number }): Pt => {
    const world = worldRef.current;
    if (world) {
      const t = world.getAbsoluteTransform().copy().invert().point(p);
      return [t.x, t.y];
    }
    return [(p.x - pos.x) / scale, (p.y - pos.y) / scale];
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    const old = zoom;
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, old * (e.evt.deltaY > 0 ? 1 / 1.1 : 1.1)));
    const mm = { x: (pointer.x - pos.x) / (old * PX_PER_MM), y: (pointer.y - pos.y) / (old * PX_PER_MM) };
    setZoom(next);
    setPos({ x: pointer.x - mm.x * next * PX_PER_MM, y: pointer.y - mm.y * next * PX_PER_MM });
  };

  const common = (el: DesignElement) => ({
    id: el.id,
    // A finish is previewed on screen but is not ink: captures of the artwork leave it out (`.guide`).
    name: el.finish ? "design-element guide" : "design-element",
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    scaleX: el.scaleX,
    scaleY: el.scaleY,
    opacity: el.opacity,
    draggable: !readOnly && !el.locked,
    listening: !readOnly && !printMode,
    perfectDrawEnabled: false,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      // Picking an already-selected element keeps the selection, so the group can be dragged.
      if (e.evt.shiftKey) select(el.id, true);
      else if (!selectedIds.includes(el.id)) select(el.id);
    },
    onTap: () => select(el.id),
    onDragStart: () => {
      const world = worldRef.current;
      if (!world) return;
      const moving = selectedIds.includes(el.id) ? selectedIds : [el.id];
      dragStart.current = new Map(
        moving.flatMap((id) => {
          const node = world.findOne(`#${id}`);
          return node ? [[id, { x: node.x(), y: node.y() }] as const] : [];
        }),
      );
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const world = worldRef.current;
      const start = dragStart.current;
      if (!world || !start) return;
      if (snapping && start.size === 1) {
        const box = node.getClientRect({ relativeTo: world });
        const snapped = snapBox(box, targets(new Set([el.id])), SNAP_PX / scale);
        node.x(node.x() + snapped.dx);
        node.y(node.y() + snapped.dy);
        setGuides(snapped.guides);
      }
      if (start.size === 1) {
        const box = node.getClientRect({ relativeTo: world });
        const centre: Pt = [box.x + box.width / 2, box.y + box.height / 2];
        const on = facePolys.find((f) => pointInPolygon(centre, f.poly));
        setGaps(on ? { box, face: faceBounds(faceById.get(on.id)!) } : null);
      }
      // Dragging one selected element moves the whole selection with it.
      const origin = start.get(el.id);
      if (origin && start.size > 1) {
        const dx = node.x() - origin.x;
        const dy = node.y() - origin.y;
        for (const [id, p] of start) {
          if (id === el.id) continue;
          const other = world.findOne(`#${id}`);
          other?.x(p.x + dx);
          other?.y(p.y + dy);
        }
      }
    },
    onDragEnd: () => {
      const world = worldRef.current;
      const start = dragStart.current;
      dragStart.current = null;
      setGuides([]);
      setGaps(null);
      if (!world || !start) return;
      updateElements(
        [...start.keys()].flatMap((id) => {
          const node = world.findOne(`#${id}`);
          return node ? [{ id, patch: { x: node.x(), y: node.y() } }] : [];
        }),
      );
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const n = e.target;
      updateElements([
        { id: el.id, patch: { x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() } },
      ]);
    },
  });

  const renderElement = (source: DesignElement) => {
    // Finishes are their own layers (U4.4): not in the print artwork, previewed in their look here.
    if (source.finish && printMode) return null;
    const el =
      source.finish && "fill" in source ? ({ ...source, fill: FINISH_LOOK[source.finish] } as DesignElement) : source;
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
      case "code":
        return <CodeNode key={el.id} el={el} {...common(el)} />;
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
      case "shape":
        return (
          <Group key={el.id} {...common(el)}>
            <Rect width={el.width} height={el.height} fill="transparent" />
            <Path
              data={el.path ?? ""}
              scaleX={el.width / 100}
              scaleY={el.height / 100}
              fill={el.fill}
              stroke={el.strokeWidth ? el.stroke : undefined}
              strokeWidth={el.strokeWidth ? el.strokeWidth / Math.max(el.width / 100, 0.001) : 0}
            />
          </Group>
        );
    }
  };

  // Consecutive elements with the same clip share one clip group — order is kept, and 200
  // elements do not mean 200 clip paths per frame.
  const batches: { key: string; elements: DesignElement[] }[] = [];
  for (const el of elements) {
    const key = el.clipFaceId && faceById.has(el.clipFaceId) && !printMode ? el.clipFaceId : "sheet";
    const last = batches.at(-1);
    if (last && last.key === key) last.elements.push(el);
    else batches.push({ key, elements: [el] });
  }

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Placing a comment (U4.7): the click is its place on the sheet, nothing else.
    if (useCommentPins.getState().placing) {
      const p = stageRef.current?.getPointerPosition();
      if (p) {
        const [xMm, yMm] = toSheet(p);
        useCommentPins.getState().pick({ xMm, yMm, faceId: null });
      }
      return;
    }
    const target = e.target;
    const onElement = target.name() === "design-element" || !!target.findAncestor(".design-element");
    const onTransformer = target.getParent()?.className?.includes("Transformer");
    if (onElement || onTransformer) return;
    if (e.evt.shiftKey && !readOnly) {
      // Shift-drag on empty board draws a selection rectangle instead of panning.
      const stage = stageRef.current;
      const p = stage?.getPointerPosition();
      if (stage && p) {
        stage.draggable(false);
        const [x, y] = toSheet(p);
        setMarquee({ x0: x, y0: y, x1: x, y1: y });
      }
      return;
    }
    select(null);
  };

  const onStageMouseMove = () => {
    const stage = stageRef.current;
    const p = stage?.getPointerPosition();
    if (!stage || !p) return;
    const mm = toSheet(p);
    if (marquee) setMarquee({ ...marquee, x1: mm[0], y1: mm[1] });
    const hit = focusedFaceId ?? facePolys.find((f) => pointInPolygon(mm, f.poly))?.id ?? null;
    if (useCanvasStatus.getState().faceId !== hit) useCanvasStatus.getState().set({ faceId: hit });
  };

  const onStageMouseUp = () => {
    const stage = stageRef.current;
    if (!marquee || !stage) return;
    stage.draggable(true);
    const world = worldRef.current;
    const x0 = Math.min(marquee.x0, marquee.x1);
    const y0 = Math.min(marquee.y0, marquee.y1);
    const x1 = Math.max(marquee.x0, marquee.x1);
    const y1 = Math.max(marquee.y0, marquee.y1);
    setMarquee(null);
    if (!world) return;
    const hits = elements.filter((el) => {
      if (el.locked) return false;
      const r = world.findOne(`#${el.id}`)?.getClientRect({ relativeTo: world });
      return r && r.x < x1 && r.x + r.width > x0 && r.y < y1 && r.y + r.height > y0;
    });
    selectMany(hits.map((el) => el.id));
  };

  const onStageDblClick = () => {
    if (readOnly) return;
    const stage = stageRef.current;
    const p = stage?.getPointerPosition();
    if (!p) return;
    const hit = facePolys.find((f) => pointInPolygon(toSheet(p), f.poly));
    if (hit) focusFace(focusedFaceId === hit.id ? null : hit.id);
  };

  const gridLines = useMemo(() => {
    if (!showGrid) return [];
    const out: { points: number[]; major: boolean }[] = [];
    for (let x = 0; x <= dieline.width; x += 5) out.push({ points: [x, 0, x, dieline.height], major: x % 10 === 0 });
    for (let y = 0; y <= dieline.height; y += 5) out.push({ points: [0, y, dieline.width, y], major: y % 10 === 0 });
    return out;
  }, [showGrid, dieline]);

  return (
    <>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        x={pos.x}
        y={pos.y}
        scaleX={scale}
        scaleY={scale}
        draggable={!placing}
        style={placing ? { cursor: "crosshair" } : undefined}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() });
        }}
        onWheel={onWheel}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        onMouseUp={onStageMouseUp}
        onDblClick={onStageDblClick}
        onDblTap={onStageDblClick}
        onTouchStart={(e) => {
          if (e.target === e.target.getStage()) select(null);
        }}
      >
        <Layer>
          <Group
            ref={worldRef}
            // Placing a comment: the design does not take the click, the sheet does.
            listening={!placing}
            name="world"
            x={pivot.x}
            y={pivot.y}
            offsetX={pivot.x}
            offsetY={pivot.y}
            rotation={-angle}
          >
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
            <Group name="paper" visible={!printMode} listening={false}>
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
                  perfectDrawEnabled={false}
                />
              ))}
            </Group>

            {/* Background pattern, then the artwork in clip batches. */}
            <Group clipFunc={sheetClip} listening={false}>
              {pattern.kind === "solid" && (
                <Rect
                  x={-bleedMm}
                  y={-bleedMm}
                  width={dieline.width + 2 * bleedMm}
                  height={dieline.height + 2 * bleedMm}
                  fill={pattern.color}
                />
              )}
              {pattern.kind === "gradient" && (
                <Rect
                  x={-bleedMm}
                  y={-bleedMm}
                  width={dieline.width + 2 * bleedMm}
                  height={dieline.height + 2 * bleedMm}
                  fillLinearGradientStartPoint={
                    gradientEnds(pattern.angle ?? 90, dieline.width + 2 * bleedMm, dieline.height + 2 * bleedMm)[0]
                  }
                  fillLinearGradientEndPoint={
                    gradientEnds(pattern.angle ?? 90, dieline.width + 2 * bleedMm, dieline.height + 2 * bleedMm)[1]
                  }
                  fillLinearGradientColorStops={[0, pattern.color, 1, pattern.background]}
                />
              )}
              {pattern.kind === "image" && pattern.image ? (
                <WrapImage
                  image={pattern.image}
                  x={-bleedMm}
                  y={-bleedMm}
                  width={dieline.width + 2 * bleedMm}
                  height={dieline.height + 2 * bleedMm}
                />
              ) : null}
              {tile && (
                <Rect
                  x={-bleedMm}
                  y={-bleedMm}
                  width={dieline.width + 2 * bleedMm}
                  height={dieline.height + 2 * bleedMm}
                  fillPatternImage={tile as unknown as HTMLImageElement}
                  fillPatternScaleX={1 / TILE_PX_PER_MM}
                  fillPatternScaleY={1 / TILE_PX_PER_MM}
                />
              )}
            </Group>
            {batches.map((batch, i) => (
              <Group
                key={`${batch.key}-${i}`}
                clipFunc={batch.key === "sheet" ? sheetClip : clipTo(contoursOf([faceById.get(batch.key)!]))}
              >
                {batch.elements.map(renderElement)}
              </Group>
            ))}

            {/* Guides */}
            <Group name="guide" listening={false} visible={!printMode}>
              {gridLines.map((g, i) => (
                <Line
                  key={`g${i}`}
                  points={g.points}
                  stroke={CANVAS_COLORS.panelLabel}
                  strokeWidth={g.major ? 0.6 : 0.3}
                  opacity={0.25}
                  strokeScaleEnabled={false}
                  perfectDrawEnabled={false}
                />
              ))}
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
                  perfectDrawEnabled={false}
                />
              ))}
              {/* A focused face: everything else is dimmed. */}
              {focused
                ? faces
                    .filter((f) => f.id !== focused.id)
                    .map((f) => (
                      <Path key={`dim-${f.id}`} data={svgPathData(f.outline)} fill="#ffffff" opacity={0.65} />
                    ))
                : null}
              {showLabels &&
                faces.map((f) => {
                  const b = faceBounds(f);
                  const size = Math.max(2, Math.min(14, 12 / (zoom * PX_PER_MM)));
                  return (
                    <Text
                      key={f.id}
                      text={faceLabel(f.label)[locale]}
                      x={b.x + b.width / 2 - 50}
                      y={b.y + b.height / 2 - size / 2}
                      width={100}
                      align="center"
                      fontSize={size}
                      fill={CANVAS_COLORS.panelLabel}
                      opacity={0.8}
                    />
                  );
                })}
              {guides.map((g, i) => (
                <Line
                  key={`sg${i}`}
                  points={
                    g.axis === "x" ? [g.at, -20, g.at, dieline.height + 20] : [-20, g.at, dieline.width + 20, g.at]
                  }
                  stroke={CANVAS_COLORS.selection}
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                />
              ))}
              {gaps ? <DistanceLabels box={gaps.box} face={gaps.face} scale={scale} locale={locale} /> : null}
              {/* Comment pins (U4.7): on the outside, never in a capture (`.guide`). */}
              {side === "outside" && !printMode
                ? pins.map((pin) => (
                    <Group
                      key={pin.id}
                      name="guide"
                      x={pin.xMm}
                      y={pin.yMm}
                      opacity={pin.resolved ? 0.45 : 1}
                      onClick={() => useCommentPins.getState().setActive(pin.id)}
                      onTap={() => useCommentPins.getState().setActive(pin.id)}
                    >
                      <Circle
                        radius={11 / scale}
                        fill={pin.id === activePin ? CANVAS_COLORS.selection : "#d9480f"}
                        stroke="#ffffff"
                        strokeWidth={2}
                        strokeScaleEnabled={false}
                      />
                      <Text
                        text={String(pin.n)}
                        width={22 / scale}
                        height={22 / scale}
                        offsetX={11 / scale}
                        offsetY={11 / scale}
                        align="center"
                        verticalAlign="middle"
                        fontSize={12 / scale}
                        fontStyle="bold"
                        fill="#ffffff"
                        listening={false}
                      />
                    </Group>
                  ))
                : null}
              {marquee ? (
                <Rect
                  x={Math.min(marquee.x0, marquee.x1)}
                  y={Math.min(marquee.y0, marquee.y1)}
                  width={Math.abs(marquee.x1 - marquee.x0)}
                  height={Math.abs(marquee.y1 - marquee.y0)}
                  stroke={CANVAS_COLORS.selection}
                  strokeWidth={1}
                  dash={[4, 3]}
                  strokeScaleEnabled={false}
                  fill={CANVAS_COLORS.selection}
                  opacity={0.12}
                />
              ) : null}
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
          </Group>
        </Layer>
      </Stage>
      {showRulers && !focused && !printMode ? (
        <Rulers width={width} height={height} origin={pos} scale={scale} />
      ) : null}
    </>
  );
}

/**
 * Rulers in millimetres along the top and left edges: a label every 10 mm (every 50 or 100 when
 * zoomed out), ticks between. Drawn from the stage's origin and scale, so they follow pan and zoom.
 */
function Rulers({
  width,
  height,
  origin,
  scale,
}: {
  width: number;
  height: number;
  origin: { x: number; y: number };
  scale: number;
}) {
  const step = scale > 3 ? 10 : scale > 1 ? 50 : 100;
  const minor = step / (step === 10 ? 10 : 5);
  const ticks = (length: number, start: number) => {
    const out: { at: number; value: number; major: boolean }[] = [];
    const first = Math.floor(-start / scale / minor) * minor;
    for (let v = first; v * scale + start < length; v += minor) {
      const rounded = Math.round(v * 1000) / 1000;
      out.push({ at: v * scale + start, value: rounded, major: Math.abs(rounded % step) < 1e-6 });
    }
    return out;
  };
  const size = 18;
  return (
    <>
      <svg
        aria-hidden="true"
        className="bg-surface/90 text-muted border-border pointer-events-none absolute start-0 top-0 border-b"
        width={width}
        height={size}
      >
        {ticks(width, origin.x).map((tick) => (
          <g key={`x${tick.at}`}>
            <line
              x1={tick.at}
              x2={tick.at}
              y1={tick.major ? 4 : 12}
              y2={size}
              stroke="currentColor"
              strokeWidth={0.8}
            />
            {tick.major ? (
              <text x={tick.at + 2} y={10} fontSize={9} fill="currentColor">
                {tick.value}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <svg
        aria-hidden="true"
        className="bg-surface/90 text-muted border-border pointer-events-none absolute start-0 top-0 border-e"
        width={size}
        height={height}
      >
        {ticks(height, origin.y).map((tick) => (
          <g key={`y${tick.at}`}>
            <line
              y1={tick.at}
              y2={tick.at}
              x1={tick.major ? 4 : 12}
              x2={size}
              stroke="currentColor"
              strokeWidth={0.8}
            />
            {tick.major ? (
              <text x={2} y={tick.at - 2} fontSize={9} fill="currentColor">
                {tick.value}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </>
  );
}

/**
 * The gaps between a dragged element and the edges of the face it is on, in millimetres
 * (studio-spec §③ "distance labels in mm"): a line from the face's left edge and one from its top
 * edge to the element, each with its length.
 */
function DistanceLabels({
  box,
  face,
  scale,
  locale,
}: {
  box: Bounds;
  face: Bounds;
  scale: number;
  locale: "th" | "en";
}) {
  const size = 11 / scale;
  const left = box.x - face.x;
  const top = box.y - face.y;
  const midY = box.y + box.height / 2;
  const midX = box.x + box.width / 2;
  const label = (mm: number) => formatMm(mm, locale, 1);
  return (
    <Group listening={false}>
      {left > 0.05 ? (
        <>
          <Line
            points={[face.x, midY, box.x, midY]}
            stroke={CANVAS_COLORS.selection}
            strokeWidth={1}
            strokeScaleEnabled={false}
            dash={[4, 3]}
          />
          <Text
            x={face.x}
            y={midY - size * 1.4}
            width={left}
            align="center"
            text={label(left)}
            fontSize={size}
            fill={CANVAS_COLORS.selection}
          />
        </>
      ) : null}
      {top > 0.05 ? (
        <>
          <Line
            points={[midX, face.y, midX, box.y]}
            stroke={CANVAS_COLORS.selection}
            strokeWidth={1}
            strokeScaleEnabled={false}
            dash={[4, 3]}
          />
          <Text
            x={midX + size * 0.4}
            y={face.y + top / 2 - size / 2}
            text={label(top)}
            fontSize={size}
            fill={CANVAS_COLORS.selection}
          />
        </>
      ) : null}
    </Group>
  );
}

/** A linear gradient across a box at an angle (degrees, 0 = left to right), as Konva's start and end points. */
function gradientEnds(
  angle: number,
  width: number,
  height: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  const r = (angle * Math.PI) / 180;
  const half = (Math.abs(width * Math.cos(r)) + Math.abs(height * Math.sin(r))) / 2;
  const [cx, cy] = [width / 2, height / 2];
  return [
    { x: cx - Math.cos(r) * half, y: cy - Math.sin(r) * half },
    { x: cx + Math.cos(r) * half, y: cy + Math.sin(r) * half },
  ];
}

/** The full-wrap background (U4.4): one picture covering the sheet and its bleed, centred. */
function WrapImage({
  image,
  x,
  y,
  width,
  height,
}: {
  image: NonNullable<DesignContent["pattern"]["image"]>;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const img = useHtmlImage(image.src);
  if (!img) return null;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const [w, h] = [image.naturalWidth * scale, image.naturalHeight * scale];
  return <KImage image={img} x={x + (width - w) / 2} y={y + (height - h) / 2} width={w} height={h} />;
}
