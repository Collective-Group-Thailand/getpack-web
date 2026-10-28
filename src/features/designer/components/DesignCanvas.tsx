"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { useLocale, useTranslations } from "next-intl";
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
} from "@getpack/dieline";

import { CANVAS_COLORS } from "@/features/designer/canvas-colors";
import { formatMm } from "@/i18n/format";
import { barModules, barsPath, qrMatrix, qrPath } from "@/features/designer/lib/codes";
import { uiFontFamily } from "@/features/designer/lib/ui-font";
import { linesOf, snapBox, type SnapTargets } from "@/features/designer/lib/snapping";
import { buildPatternTile } from "@/features/designer/patterns";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "@/features/designer/store/editor";
import { useCommentPins } from "@/features/designer/comments/pins";
import { useCanvasStatus } from "@/features/designer/store/status";
import type {
  CodeElement,
  DesignContent,
  DesignElement,
  Dieline,
  FillGradient,
  ImageElement,
  NewElement,
} from "@/features/designer/types";
import type { DesignIssue } from "@/features/designer/lib/checks";
import { newText } from "@/features/designer/lib/create";
import { constrain45, dragBox, newPath, newRectangle, polylineOf } from "@/features/designer/lib/draw";
import { fitAreas } from "@/features/designer/lib/fit";
import { inkOf } from "@/features/designer/lib/ink";
import { measureText } from "@/features/designer/lib/measure";
import type { EditorMode, EditorTool } from "@/features/designer/store/mode";

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
  const ref = useRef<Konva.Image>(null);
  // "ภาพสีเดียว" (C8): one ink, shown in grey — a filter needs the node cached.
  useEffect(() => {
    const node = ref.current;
    if (!node || !img) return;
    if (el.mono) node.cache({ pixelRatio: 1 });
    else node.clearCache();
    node.getLayer()?.batchDraw();
  }, [el.mono, img, el.width, el.height, el.crop]);
  const crop =
    img && el.crop
      ? {
          x: el.crop.x * img.naturalWidth,
          y: el.crop.y * img.naturalHeight,
          width: el.crop.width * img.naturalWidth,
          height: el.crop.height * img.naturalHeight,
        }
      : undefined;
  return (
    <KImage
      ref={ref}
      image={img ?? undefined}
      width={el.width}
      height={el.height}
      crop={crop}
      filters={el.mono ? [Konva.Filters.Grayscale] : undefined}
      {...rest}
    />
  );
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
          fontFamily={uiFontFamily()}
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
  /** The Studio editor shell (C8): its mode, tool, print view and live preflight. Absent = the classic canvas. */
  studio?: CanvasStudio;
}

/** What the Studio editor shell (C8) adds to the canvas. */
export interface CanvasStudio {
  mode: EditorMode;
  tool: EditorTool;
  overlays: { cut: boolean; fold: boolean; bleed: boolean; safe: boolean; labels: boolean; grid: boolean };
  /** "จำลองหมึกบนผิวกล่อง": the artwork multiplied onto the board. */
  inkOnBoard: boolean;
  /** "แยกหมึก": everything, the black ink only, or the other colours only. */
  separation: "all" | "black" | "colours";
  /** The live preflight findings, drawn as markers (red = must fix, amber = advice). */
  issues: DesignIssue[];
  onIssue: (issue: DesignIssue) => void;
  /** Screen pixels the fit keeps clear on each edge (the toolbox, the view bar). */
  insets: { top: number; right: number; bottom: number; left: number };
  /** The 3D card in the top-right corner: the fit never puts the sheet under it. */
  pip: { width: number; height: number; top: number; right: number } | null;
  /** A one-shot tool finished (tools revert to "select" after one shape). */
  onToolDone: () => void;
}

const RATIO_TYPES = new Set(["image", "text", "code"]);

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
  studio,
}: Props) {
  const t = useTranslations("designer.shell");
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
    setFitZoom,
    addElement,
  } = useEditor();
  const ov = studio?.overlays;
  const pro = studio?.mode === "pro";
  // The side being edited (U4.3): its elements only; the background pattern is the outside's.
  const elements = useMemo(
    () => content.elements.filter((e) => (e.side ?? "outside") === side && !e.hidden),
    [content.elements, side],
  );
  const guideLines = useMemo(
    () => (content.guides ?? []).filter((g) => (g.side ?? "outside") === side),
    [content.guides, side],
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
  /** Space held: the view pans (C8). */
  const [spaceDown, setSpaceDown] = useState(false);
  /** A rectangle, ellipse or line being dragged out (C8 pro tools), in sheet mm. */
  const [draft, setDraft] = useState<{ tool: "rect" | "ellipse" | "line"; a: Pt; b: Pt; shift: boolean } | null>(null);
  /** The pen's points so far, and where the next would go. */
  const [pen, setPen] = useState<{ points: Pt[]; hover: Pt | null } | null>(null);
  /** The text being typed in place (double-click), with its box on screen. */
  const [editing, setEditing] = useState<{
    id: string;
    text: string;
    box: { x: number; y: number; width: number; height: number };
  } | null>(null);
  /** While resizing: the box and its size in mm. */
  const [sizeLabel, setSizeLabel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  /** A guide being pulled out of a ruler. */
  const [guideDraft, setGuideDraft] = useState<{ axis: "x" | "y"; at: number } | null>(null);
  const [markers, setMarkers] = useState<{ id: string; x: number; y: number; issue: DesignIssue }[]>([]);
  const panning = spaceDown || studio?.tool === "hand";
  /** The zoom the view's position was last computed for (the fit and the wheel place it themselves). */
  const lastZoom = useRef(zoom);

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
    const gx = guideLines.filter((g) => g.axis === "x").map((g) => g.at);
    const gy = guideLines.filter((g) => g.axis === "y").map((g) => g.at);
    return {
      xs: [...faceLines.xs, ...safeLines.xs, ...elementLines.xs, ...gx, dieline.width / 2],
      ys: [...faceLines.ys, ...safeLines.ys, ...elementLines.ys, ...gy, dieline.height / 2],
    };
  };

  /*
   * Fit to view whenever asked, when the sheet or the viewport changes size, or when a face is
   * focused (then the face fills the view, turned upright). This reacts to a *measured* DOM size,
   * which is not knowable during render, so the setState calls are the effect's purpose.
   */
  useEffect(() => {
    if (!width || !height) return;
    // A 60 px margin on each side is a quarter of a canvas that a tool panel has narrowed to 370 px;
    // the margin scales down with the view so the sheet stays readable.
    const pad = Math.min(60, Math.round(Math.min(width, height) * 0.08));
    const box = focusBox ?? { x: 0, y: 0, width: dieline.width, height: dieline.height };
    const turned = angle % 180 !== 0;
    const w = turned ? box.height : box.width;
    const h = turned ? box.width : box.height;
    // C8: the sheet fills the stage, clear of the toolbox, the view bar and the 3D card.
    const areas = studio
      ? fitAreas(width, height, studio.insets, focusBox ? null : studio.pip, Math.min(24, pad))
      : [{ x: pad, y: pad, width: width - pad * 2, height: height - pad * 2 }];
    if (!areas.length) areas.push({ x: 0, y: 0, width, height });
    const best = areas
      .map((a) => ({ a, z: Math.min(a.width / (w * PX_PER_MM), a.height / (h * PX_PER_MM)) }))
      .sort((p, q) => q.z - p.z)[0]!;
    const nz = studio ? Math.min(ZOOM_MAX, best.z) : Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, best.z));
    setFitZoom(nz);
    setZoom(nz);
    lastZoom.current = useEditor.getState().zoom;
    const s = nz * PX_PER_MM;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    setPos({ x: best.a.x + best.a.width / 2 - cx * s, y: best.a.y + best.a.height / 2 - cy * s });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal, dieline, width, height, setZoom, focusedFaceId, fitKey(studio)]);

  // Space pans while held (C8), wherever the pointer is; typing in a field is left alone.
  useEffect(() => {
    if (!studio) return;
    const typing = (e: KeyboardEvent) =>
      (e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]");
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing(e)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === "Space" && setSpaceDown(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [studio]);

  // The pen (C8): Enter finishes, Backspace takes the last point back, Escape cancels — before the editor's keys.
  useEffect(() => {
    if (!pen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") finishPen(false);
      else if (e.key === "Backspace")
        setPen((p) => (p && p.points.length > 1 ? { ...p, points: p.points.slice(0, -1) } : null));
      else if (e.key === "Escape") setPen(null);
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });
  useEffect(() => {
    // Another tool drops an unfinished path.

    if (studio?.tool !== "pen") setPen(null);
  }, [studio?.tool]);

  // Live preflight markers (C8): one per element, its worst finding, at the element's top-right corner.
  useEffect(() => {
    if (!studio) return;
    const frame = requestAnimationFrame(() => {
      const world = worldRef.current;
      if (!world) return;
      const worst = new Map<string, DesignIssue>();
      for (const issue of studio.issues) {
        if (!issue.elementId || issue.severity === "info") continue;
        const prev = worst.get(issue.elementId);
        if (!prev || (prev.severity !== "block" && issue.severity === "block")) worst.set(issue.elementId, issue);
      }
      const next: { id: string; x: number; y: number; issue: DesignIssue }[] = [];
      for (const [id, issue] of worst) {
        const r = world.findOne(`#${id}`)?.getClientRect({ relativeTo: world });
        if (r) next.push({ id, x: r.x + r.width, y: r.y, issue });
      }
      setMarkers(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [studio, studio?.issues, elements]);

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
    // C8: a plain wheel scrolls the view; ⌘/Ctrl (or a pinch) zooms at the pointer.
    if (studio && !e.evt.ctrlKey && !e.evt.metaKey) {
      setPos({ x: pos.x - e.evt.deltaX, y: pos.y - e.evt.deltaY });
      return;
    }
    zoomAt(pointer, e.evt.deltaY > 0 ? 1 / 1.1 : 1.1);
  };

  /** Zooms by `factor` keeping the sheet point under `pointer` where it is. */
  const zoomAt = (pointer: { x: number; y: number }, factor: number) => {
    const old = zoom;
    const floor = Math.min(ZOOM_MIN, useEditor.getState().fitZoom);
    const next = Math.max(floor, Math.min(ZOOM_MAX, old * factor));
    const mm = { x: (pointer.x - pos.x) / (old * PX_PER_MM), y: (pointer.y - pos.y) / (old * PX_PER_MM) };
    setZoom(next);
    lastZoom.current = useEditor.getState().zoom;
    setPos({ x: pointer.x - mm.x * next * PX_PER_MM, y: pointer.y - mm.y * next * PX_PER_MM });
  };

  /** The zoom changed from outside (the view bar, + / −): keep the view's centre where it is. */
  useEffect(() => {
    if (!studio) return;
    const old = lastZoom.current;
    lastZoom.current = zoom;
    if (Math.abs(old - zoom) < 1e-9) return;

    setPos((p) => {
      const c = { x: width / 2, y: height / 2 };
      const mm = { x: (c.x - p.x) / (old * PX_PER_MM), y: (c.y - p.y) / (old * PX_PER_MM) };
      const nx = c.x - mm.x * zoom * PX_PER_MM;
      const ny = c.y - mm.y * zoom * PX_PER_MM;
      // A zoom the wheel or the fit already placed lands on the same position: nothing moves twice.
      return Math.abs(nx - p.x) < 0.5 && Math.abs(ny - p.y) < 0.5 ? p : { x: nx, y: ny };
    });
  }, [zoom, studio, width, height]);

  /** Eyedropper (C8): the picked element's fill, gradient and stroke — and font and weight between texts — onto the selection. */
  const eyedrop = (source: DesignElement) => {
    const { selectedIds: ids, content: c } = useEditor.getState();
    const patches = c.elements
      .filter((e) => ids.includes(e.id) && e.id !== source.id && !e.locked && e.type !== "image")
      .map((target) => {
        const patch: Record<string, unknown> = {};
        if ("fill" in source && "fill" in target) {
          patch.fill = source.fill;
          patch.fillGradient = "fillGradient" in source ? source.fillGradient : undefined;
        }
        if ("stroke" in source && "stroke" in target) {
          patch.stroke = source.stroke;
          patch.strokeWidth = source.strokeWidth;
          patch.strokeDash = source.strokeDash;
        }
        if (source.type === "text" && target.type === "text") {
          patch.fontFamily = source.fontFamily;
          patch.fontStyle = source.fontStyle;
        }
        return { id: target.id, patch: patch as Partial<DesignElement> };
      });
    updateElements(patches);
    studio?.onToolDone();
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
    draggable: !readOnly && !el.locked && (!studio || (studio.tool === "select" && !panning)),
    listening:
      !readOnly && !printMode && (!studio || ((studio.tool === "select" || studio.tool === "eyedropper") && !panning)),
    perfectDrawEnabled: false,
    ...(studio?.inkOnBoard && !printMode ? { globalCompositeOperation: "multiply" as const } : {}),
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (studio?.tool === "eyedropper") {
        eyedrop(el);
        return;
      }
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
      // Alt held: no snapping for this move (C8).
      if (snapping && start.size === 1 && !e.evt.altKey) {
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
    onTransform: studio
      ? (e: Konva.KonvaEventObject<Event>) => {
          const n = e.target;
          const world = worldRef.current;
          if (!world) return;
          const r = n.getClientRect({ relativeTo: world });
          const size = el.type === "text" ? measureText(el) : { width: el.width, height: el.height };
          setSizeLabel({
            x: r.x + r.width / 2,
            y: r.y + r.height,
            w: Math.abs(size.width * n.scaleX()),
            h: Math.abs(size.height * n.scaleY()),
          });
        }
      : undefined,
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const n = e.target;
      setSizeLabel(null);
      // C8: resizing a text changes its size in points, not a stretch.
      if (studio && el.type === "text") {
        const k = Math.abs(n.scaleY());
        updateElements([
          {
            id: el.id,
            patch: {
              x: n.x(),
              y: n.y(),
              rotation: n.rotation(),
              scaleX: 1,
              scaleY: 1,
              fontSize: el.fontSize * k,
            } as Partial<DesignElement>,
          },
        ]);
        n.scaleX(1);
        n.scaleY(1);
        return;
      }
      updateElements([
        { id: el.id, patch: { x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() } },
      ]);
    },
  });

  const gradientProps = (g: FillGradient | undefined, w: number, h: number) => {
    if (!g) return {};
    const [start, end] = gradientEnds(g.angle, w, h);
    return {
      fillLinearGradientStartPoint: start,
      fillLinearGradientEndPoint: end,
      fillLinearGradientColorStops: [0, g.from, 1, g.to],
    };
  };
  const dashOf = (dash: "solid" | "dashed" | "dotted" | undefined, width: number) =>
    dash === "dashed" ? [width * 4, width * 2] : dash === "dotted" ? [width, width * 1.5] : undefined;

  /** The element's own drawing, at its own origin, with `props` (its place, or a flip inside a group). */
  const drawInner = (el: DesignElement, props: NodeProps, key?: string) => {
    switch (el.type) {
      case "text": {
        const size = el.fillGradient ? measureText(el) : null;
        return (
          <Text
            key={key}
            {...props}
            text={el.text}
            fontSize={el.fontSize}
            fontFamily={el.fontFamily}
            fontStyle={el.fontStyle}
            fill={el.fill}
            {...(size ? gradientProps(el.fillGradient, size.width, size.height) : {})}
            align={el.align}
            lineHeight={el.lineHeight ?? 1.25}
            letterSpacing={el.letterSpacing ? (el.letterSpacing / 1000) * el.fontSize : 0}
            opacity={editing?.id === el.id ? 0 : (props.opacity as number | undefined)}
          />
        );
      }
      case "image":
        return <ImageNode key={key} el={el} {...props} />;
      case "code":
        return <CodeNode key={key} el={el} {...props} />;
      case "rect":
        return (
          <Rect
            key={key}
            {...props}
            width={el.width}
            height={el.height}
            fill={el.fill}
            {...gradientProps(el.fillGradient, el.width, el.height)}
            stroke={el.strokeWidth ? el.stroke : undefined}
            strokeWidth={el.strokeWidth}
            dash={dashOf(el.strokeDash, el.strokeWidth)}
            cornerRadius={el.cornerRadius}
          />
        );
      case "circle":
        return (
          <Ellipse
            key={key}
            {...props}
            radiusX={el.width / 2}
            radiusY={el.height / 2}
            offsetX={-el.width / 2}
            offsetY={-el.height / 2}
            fill={el.fill}
            {...(el.fillGradient
              ? (() => {
                  // An ellipse's gradient points are about its centre.
                  const [a, b] = gradientEnds(el.fillGradient.angle, el.width, el.height);
                  return {
                    fillLinearGradientStartPoint: { x: a.x - el.width / 2, y: a.y - el.height / 2 },
                    fillLinearGradientEndPoint: { x: b.x - el.width / 2, y: b.y - el.height / 2 },
                    fillLinearGradientColorStops: [0, el.fillGradient.from, 1, el.fillGradient.to],
                  };
                })()
              : {})}
            stroke={el.strokeWidth ? el.stroke : undefined}
            strokeWidth={el.strokeWidth}
            dash={dashOf(el.strokeDash, el.strokeWidth)}
          />
        );
      case "shape": {
        // A line or a pen path (C8) is drawn as points in mm, so its stroke keeps its width when stretched.
        const poly = polylineOf(el.path);
        if (poly) {
          const points = poly.points.map((v, i) => (v / 100) * (i % 2 ? el.height : el.width));
          return (
            <Group key={key} {...props}>
              <Rect width={el.width} height={el.height} fill="transparent" />
              <Line
                points={points}
                closed={poly.closed}
                fill={poly.closed && !el.open ? el.fill : undefined}
                {...(poly.closed && !el.open ? gradientProps(el.fillGradient, el.width, el.height) : {})}
                stroke={el.strokeWidth ? el.stroke : undefined}
                strokeWidth={el.strokeWidth}
                dash={dashOf(el.strokeDash, el.strokeWidth)}
                lineCap="round"
                lineJoin="round"
                hitStrokeWidth={Math.max(el.strokeWidth, 8 / scale)}
              />
            </Group>
          );
        }
        return (
          <Group key={key} {...props}>
            <Rect width={el.width} height={el.height} fill="transparent" />
            <Path
              data={el.path ?? ""}
              scaleX={el.width / 100}
              scaleY={el.height / 100}
              fill={el.fill}
              {...gradientProps(el.fillGradient, 100, 100)}
              stroke={el.strokeWidth ? el.stroke : undefined}
              strokeWidth={el.strokeWidth ? el.strokeWidth / Math.max(el.width / 100, 0.001) : 0}
              dash={dashOf(el.strokeDash, el.strokeWidth ? el.strokeWidth / Math.max(el.width / 100, 0.001) : 0)}
            />
          </Group>
        );
      }
    }
  };

  const renderElement = (source: DesignElement) => {
    // Finishes are their own layers (U4.4): not in the print artwork, previewed in their look here.
    if (source.finish && printMode) return null;
    // "แยกหมึก" (C8): only the black ink, or only the other colours — a view, never the print files.
    if (studio && !printMode && studio.separation !== "all") {
      const ink = inkOf(source);
      if (studio.separation === "black" && ink === "colour") return null;
      if (studio.separation === "colours" && ink === "black") return null;
    }
    const el =
      source.finish && "fill" in source ? ({ ...source, fill: FINISH_LOOK[source.finish] } as DesignElement) : source;
    if (el.flipX || el.flipY) {
      // Mirrored about its own centre (C8): the outer group keeps the element's place, the drawing flips inside it.
      const size = el.type === "text" ? measureText(el) : { width: el.width, height: el.height };
      return (
        <Group key={el.id} {...common(el)}>
          {drawInner(el, {
            x: el.flipX ? size.width : 0,
            y: el.flipY ? size.height : 0,
            scaleX: el.flipX ? -1 : 1,
            scaleY: el.flipY ? -1 : 1,
          })}
        </Group>
      );
    }
    return drawInner(el, common(el), el.id);
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
    if (studio && !readOnly && !panning) {
      const p = stageRef.current?.getPointerPosition();
      const at = p ? toSheet(p) : null;
      if (at && p) {
        switch (studio.tool) {
          case "zoom":
            zoomAt(p, e.evt.altKey ? 1 / 1.25 : 1.25);
            return;
          case "text": {
            const text = newText({ x: at[0], y: at[1] }, t("tools.newText"), "subheading");
            addElement({ ...text, x: at[0], y: at[1] } as NewElement);
            studio.onToolDone();
            const id = useEditor.getState().selectedId;
            if (id) requestAnimationFrame(() => startEditing(id));
            return;
          }
          case "rect":
          case "ellipse":
          case "line":
            setDraft({ tool: studio.tool, a: at, b: at, shift: e.evt.shiftKey });
            return;
          case "pen": {
            const points = pen?.points ?? [];
            const first = points[0];
            // A click on the first point closes the shape.
            if (first && points.length >= 3 && Math.hypot(at[0] - first[0], at[1] - first[1]) * scale < 8) {
              finishPen(true);
              return;
            }
            const last = points.at(-1);
            const next = last && e.evt.shiftKey ? constrain45(last, at) : at;
            setPen({ points: [...points, next], hover: null });
            return;
          }
          default:
            break;
        }
      }
    }
    const target = e.target;
    const onElement = target.name() === "design-element" || !!target.findAncestor(".design-element");
    const onTransformer = target.getParent()?.className?.includes("Transformer");
    if (onElement || onTransformer) return;
    // Pro "select" (C8): a drag on the empty sheet draws a selection rectangle, no ⇧ needed.
    const marqueeByDefault = pro && studio?.tool === "select" && !panning;
    if ((e.evt.shiftKey || marqueeByDefault) && !readOnly) {
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
    if (draft) {
      const shift = (window.event as MouseEvent | undefined)?.shiftKey ?? false;
      setDraft({ ...draft, b: draft.tool === "line" && shift ? constrain45(draft.a, mm) : mm, shift });
    }
    if (pen) {
      const last = pen.points.at(-1);
      const shift = (window.event as MouseEvent | undefined)?.shiftKey ?? false;
      setPen({ ...pen, hover: last && shift ? constrain45(last, mm) : mm });
    }
    const hit = focusedFaceId ?? facePolys.find((f) => pointInPolygon(mm, f.poly))?.id ?? null;
    if (useCanvasStatus.getState().faceId !== hit) useCanvasStatus.getState().set({ faceId: hit });
  };

  const onStageMouseUp = () => {
    if (draft) {
      commitDraft(draft);
      setDraft(null);
      return;
    }
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

  const onStageDblClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (readOnly) return;
    if (pen) {
      // The double-click's second click added a point: finish without it.
      finishPen(false, pen.points.slice(0, -1));
      return;
    }
    // Double-click a text to type in place (C8).
    if (studio) {
      const node =
        e.target.findAncestor(".design-element", true) ?? (e.target.name() === "design-element" ? e.target : null);
      const el = node ? elements.find((x) => x.id === node.id()) : undefined;
      if (el?.type === "text" && !el.locked) {
        startEditing(el.id);
        return;
      }
    }
    const stage = stageRef.current;
    const p = stage?.getPointerPosition();
    if (!p) return;
    const hit = facePolys.find((f) => pointInPolygon(toSheet(p), f.poly));
    if (hit) focusFace(focusedFaceId === hit.id ? null : hit.id);
  };

  /** A dragged-out rectangle, ellipse or line becomes an element; tools then revert to "select". */
  const commitDraft = (d: NonNullable<typeof draft>) => {
    let element: NewElement | null;
    if (d.tool === "line") {
      element = Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) < 1 ? null : newPath([d.a, d.b], false);
    } else {
      let box = dragBox(d.a, d.b, d.shift);
      // A click without a drag: a 30 mm shape where it was clicked.
      if (box.width < 1 && box.height < 1) box = { x: d.a[0] - 15, y: d.a[1] - 15, width: 30, height: 30 };
      element = newRectangle(box, d.tool === "rect" ? "rect" : "circle");
    }
    if (element) addElement(element);
    studio?.onToolDone();
  };

  function finishPen(closed: boolean, points: Pt[] = pen?.points ?? []) {
    setPen(null);
    const element = newPath(points, closed);
    if (element) {
      addElement(element);
      studio?.onToolDone();
    }
  }

  /** Opens the in-place text editor over a text element. */
  const startEditing = (id: string) => {
    const el = useEditor.getState().content.elements.find((x) => x.id === id);
    const node = stageRef.current?.findOne(`#${id}`);
    if (!el || el.type !== "text" || !node) return;
    const r = node.getClientRect();
    setEditing({ id, text: el.text, box: { x: r.x, y: r.y, width: r.width, height: r.height } });
  };
  const commitEditing = () => {
    if (!editing) return;
    const el = useEditor.getState().content.elements.find((x) => x.id === editing.id);
    if (el?.type === "text" && editing.text !== el.text) updateElements([{ id: el.id, patch: { text: editing.text } }]);
    setEditing(null);
  };

  const gridLines = useMemo(() => {
    const on = ov ? ov.grid : showGrid;
    if (!on) return [];
    // The pro print view's grid is every 10 mm (C8); the classic one 5 mm, a major line every 10.
    const step = ov ? 10 : 5;
    const out: { points: number[]; major: boolean }[] = [];
    for (let x = 0; x <= dieline.width; x += step) out.push({ points: [x, 0, x, dieline.height], major: x % 10 === 0 });
    for (let y = 0; y <= dieline.height; y += step) out.push({ points: [0, y, dieline.width, y], major: y % 10 === 0 });
    return out;
  }, [showGrid, ov, dieline]);

  const shownLines = ov ? lines.filter((l) => (l.role === "cut" || l.role === "half_cut" ? ov.cut : ov.fold)) : lines;
  const transformKeepsRatio =
    selectedIds.length > 0 &&
    selectedIds.every((id) => {
      const el = elements.find((e) => e.id === id);
      return !!el && (RATIO_TYPES.has(el.type) || (el.type === "shape" && !el.open && !polylineOf(el.path)));
    });
  const cursor = placing
    ? "crosshair"
    : panning
      ? "grab"
      : studio?.tool === "text"
        ? "text"
        : studio?.tool === "zoom"
          ? "zoom-in"
          : studio?.tool === "eyedropper"
            ? "copy"
            : studio && ["rect", "ellipse", "line", "pen"].includes(studio.tool)
              ? "crosshair"
              : undefined;

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
        draggable={!placing && (!studio || panning || (studio.mode === "easy" && studio.tool === "select"))}
        style={cursor ? { cursor } : undefined}
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
              {(ov ? ov.bleed : false) &&
                bleedContours.map((pts, i) => (
                  <Line
                    key={`b${i}`}
                    points={flat(pts)}
                    closed
                    stroke={CANVAS_COLORS.cut}
                    strokeWidth={0.8}
                    dash={[2, 2]}
                    opacity={0.45}
                    strokeScaleEnabled={false}
                  />
                ))}
              {(ov ? ov.safe && showSafeZone : showSafeZone) &&
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
              {shownLines.map((l, i) => (
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
              {(ov ? ov.labels : showLabels) &&
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
              {/* Ruler guides (C8 pro): drag along their axis; dropped back on a ruler, they go. */}
              {pro
                ? guideLines.map((g) => (
                    <Line
                      key={g.id}
                      points={
                        g.axis === "x"
                          ? [g.at, -2000, g.at, dieline.height + 2000]
                          : [-2000, g.at, dieline.width + 2000, g.at]
                      }
                      stroke={CANVAS_COLORS.guide}
                      strokeWidth={1}
                      hitStrokeWidth={8 / scale}
                      strokeScaleEnabled={false}
                      draggable={!readOnly}
                      listening={!readOnly && studio?.tool === "select"}
                      onMouseEnter={(e) => {
                        const c = e.target.getStage()?.container();
                        if (c) c.style.cursor = g.axis === "x" ? "ew-resize" : "ns-resize";
                      }}
                      onMouseLeave={(e) => {
                        const c = e.target.getStage()?.container();
                        if (c) c.style.cursor = cursor ?? "";
                      }}
                      dragBoundFunc={function (this: Konva.Node, pos) {
                        return g.axis === "x"
                          ? { x: pos.x, y: this.absolutePosition().y }
                          : { x: this.absolutePosition().x, y: pos.y };
                      }}
                      onDragEnd={(e) => {
                        const pointer = stageRef.current?.getPointerPosition();
                        const node = e.target;
                        const moved = g.axis === "x" ? node.x() : node.y();
                        node.position({ x: 0, y: 0 });
                        if (pointer && (g.axis === "x" ? pointer.x < RULER_PX : pointer.y < RULER_PX))
                          useEditor.getState().removeGuide(g.id);
                        else useEditor.getState().moveGuide(g.id, g.at + moved);
                      }}
                    />
                  ))
                : null}
              {guideDraft ? (
                <Line
                  points={
                    guideDraft.axis === "x"
                      ? [guideDraft.at, -2000, guideDraft.at, dieline.height + 2000]
                      : [-2000, guideDraft.at, dieline.width + 2000, guideDraft.at]
                  }
                  stroke={CANVAS_COLORS.guide}
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                  listening={false}
                />
              ) : null}
              {draft ? (
                draft.tool === "line" ? (
                  <Line
                    points={[...draft.a, ...draft.b]}
                    stroke={CANVAS_COLORS.selection}
                    strokeWidth={1.5}
                    strokeScaleEnabled={false}
                    listening={false}
                  />
                ) : (
                  (() => {
                    const b = dragBox(draft.a, draft.b, draft.shift);
                    return draft.tool === "rect" ? (
                      <Rect
                        {...b}
                        stroke={CANVAS_COLORS.selection}
                        strokeWidth={1.5}
                        strokeScaleEnabled={false}
                        dash={[4, 3]}
                        listening={false}
                      />
                    ) : (
                      <Ellipse
                        x={b.x + b.width / 2}
                        y={b.y + b.height / 2}
                        radiusX={b.width / 2}
                        radiusY={b.height / 2}
                        stroke={CANVAS_COLORS.selection}
                        strokeWidth={1.5}
                        strokeScaleEnabled={false}
                        dash={[4, 3]}
                        listening={false}
                      />
                    );
                  })()
                )
              ) : null}
              {pen ? (
                <Group listening={false}>
                  <Line
                    points={[...pen.points.flat(), ...(pen.hover ? pen.hover : [])]}
                    stroke={CANVAS_COLORS.selection}
                    strokeWidth={1.5}
                    strokeScaleEnabled={false}
                  />
                  {pen.points.map((p, i) => (
                    <Rect
                      key={i}
                      x={p[0] - 3 / scale}
                      y={p[1] - 3 / scale}
                      width={6 / scale}
                      height={6 / scale}
                      fill={i === 0 ? CANVAS_COLORS.selection : "#ffffff"}
                      stroke={CANVAS_COLORS.selection}
                      strokeWidth={1}
                      strokeScaleEnabled={false}
                    />
                  ))}
                </Group>
              ) : null}
              {sizeLabel ? (
                <Text
                  x={sizeLabel.x - 60 / scale}
                  y={sizeLabel.y + 6 / scale}
                  width={120 / scale}
                  align="center"
                  text={`${formatMm(sizeLabel.w, locale, 1)} × ${formatMm(sizeLabel.h, locale, 1)}`}
                  fontSize={11 / scale}
                  fontFamily={uiFontFamily()}
                  fill={CANVAS_COLORS.selection}
                  listening={false}
                />
              ) : null}
              {/* Live preflight markers (C8): red = must fix, amber = advice — a click opens the finding. */}
              {studio && !printMode
                ? markers.map((m) => (
                    <Group
                      key={`m-${m.id}`}
                      x={m.x}
                      y={m.y}
                      onClick={() => studio.onIssue(m.issue)}
                      onTap={() => studio.onIssue(m.issue)}
                      onMouseEnter={(e) => {
                        const c = e.target.getStage()?.container();
                        if (c) c.style.cursor = "pointer";
                      }}
                      onMouseLeave={(e) => {
                        const c = e.target.getStage()?.container();
                        if (c) c.style.cursor = cursor ?? "";
                      }}
                    >
                      <Circle
                        radius={9 / scale}
                        fill={m.issue.severity === "block" ? CANVAS_COLORS.issueBlock : CANVAS_COLORS.issueWarn}
                        stroke="#ffffff"
                        strokeWidth={2}
                        strokeScaleEnabled={false}
                      />
                      <Text
                        text="!"
                        width={18 / scale}
                        height={18 / scale}
                        offsetX={9 / scale}
                        offsetY={9 / scale}
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
              {...(studio
                ? {
                    // C8: four corner handles; images, texts, codes and symbols keep their proportions (⇧ frees
                    // them), other shapes are free (⇧ keeps them).
                    enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"],
                    keepRatio: transformKeepsRatio,
                  }
                : {})}
            />
          </Group>
        </Layer>
      </Stage>
      {(studio ? pro : showRulers) && !focused && !printMode ? (
        <Rulers
          width={width}
          height={height}
          origin={pos}
          scale={scale}
          onPull={pro && !readOnly ? (axis, at) => setGuideDraft(at === null ? null : { axis, at }) : undefined}
          onDrop={(axis, at) => {
            setGuideDraft(null);
            useEditor.getState().addGuide(axis, at);
          }}
        />
      ) : null}
      {editing ? (
        <textarea
          aria-label={t("editText")}
          autoFocus
          value={editing.text}
          onChange={(event) => setEditing({ ...editing, text: event.target.value })}
          onBlur={commitEditing}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(null);
            else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commitEditing();
          }}
          className="border-primary bg-surface/90 text-fg absolute z-20 resize-none rounded-sm border p-0.5 leading-tight outline-none"
          style={{
            left: editing.box.x - 3,
            top: editing.box.y - 3,
            minWidth: Math.max(80, editing.box.width + 6),
            minHeight: editing.box.height + 6,
            fontSize: Math.max(12, Math.min(48, editing.box.height * 0.7)),
          }}
        />
      ) : null}
    </>
  );
}

/** A stable key of the studio's fit areas: the fit runs again when the 3D card or the insets change. */
function fitKey(studio: CanvasStudio | undefined): string {
  if (!studio) return "";
  const { insets, pip } = studio;
  return `${insets.top},${insets.right},${insets.bottom},${insets.left}|${pip ? `${pip.width},${pip.height},${pip.top},${pip.right}` : ""}`;
}

/** The rulers' thickness on screen. */
const RULER_PX = 18;

/**
 * Rulers in millimetres along the top and left edges: a label every 10 mm (every 50 or 100 when
 * zoomed out), ticks between. Drawn from the stage's origin and scale, so they follow pan and zoom.
 */
function Rulers({
  width,
  height,
  origin,
  scale,
  onPull,
  onDrop,
}: {
  width: number;
  height: number;
  origin: { x: number; y: number };
  scale: number;
  /** C8 pro: a guide pulled from a ruler (`null` = back on the ruler, dropped nowhere). */
  onPull?: (axis: "x" | "y", at: number | null) => void;
  onDrop?: (axis: "x" | "y", at: number) => void;
}) {
  /*
   * Pressing a ruler pulls a guide out of it (C8): the top ruler makes a vertical guide (`x`), the left one a
   * horizontal guide (`y`); released over the sheet it stays, released on the ruler it is dropped.
   */
  const pull = (axis: "x" | "y") => (event: React.PointerEvent<SVGSVGElement>) => {
    if (!onPull || !onDrop) return;
    event.preventDefault();
    const host = (event.currentTarget.parentElement ?? event.currentTarget).getBoundingClientRect();
    const toMm = (e: PointerEvent | React.PointerEvent) =>
      axis === "x" ? (e.clientX - host.left - origin.x) / scale : (e.clientY - host.top - origin.y) / scale;
    const onRuler = (e: PointerEvent | React.PointerEvent) =>
      axis === "x" ? e.clientY - host.top < size : e.clientX - host.left < size;
    onPull(axis, toMm(event));
    const move = (e: PointerEvent) =>
      onPull(
        axis,
        onRuler(e) && Math.abs(e.clientY - event.clientY) + Math.abs(e.clientX - event.clientX) > 4 ? null : toMm(e),
      );
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const moved = Math.abs(e.clientY - event.clientY) + Math.abs(e.clientX - event.clientX) > 4;
      if (moved && onRuler(e)) onPull(axis, null);
      else onDrop(axis, Math.round(toMm(e) * 10) / 10);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const interactive = !!onPull;
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
        className={`bg-surface/90 text-muted border-border absolute start-0 top-0 border-b ${interactive ? "cursor-ew-resize" : "pointer-events-none"}`}
        width={width}
        height={size}
        onPointerDown={interactive ? pull("x") : undefined}
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
        className={`bg-surface/90 text-muted border-border absolute start-0 top-0 border-e ${interactive ? "cursor-ns-resize" : "pointer-events-none"}`}
        width={size}
        height={height}
        onPointerDown={interactive ? pull("y") : undefined}
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
