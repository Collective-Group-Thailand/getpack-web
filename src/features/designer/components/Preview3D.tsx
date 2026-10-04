"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  allFaces,
  facePolygons,
  flattenContour,
  foldModel,
  slabPoint,
  triangulate,
  type Dieline,
  type HingeMap,
  type MaterialSpec,
  type Pt,
} from "@packio/dieline";

import { IconButton } from "@/ui/components/IconButton";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Slider } from "@/ui/components/Slider";

export type LightingPreset = "studio" | "daylight" | "warm";

export interface Preview3DLabels {
  canvas: string;
  fold: string;
  play: string;
  rotateLeft: string;
  rotateRight: string;
  tiltUp: string;
  tiltDown: string;
  reset: string;
  lighting: string;
  lightingPreset: Record<LightingPreset, string>;
  exportPng: string;
  flat: string;
}

export interface Preview3DProps {
  dieline: Dieline;
  /** How the box folds; `null` for a flat piece (a label, a card), shown flat. */
  hinges: HingeMap | null;
  /** The artwork on the sheet as an image (0 mm margin), or `null` while it is being drawn. */
  artwork: string | null;
  /** The unprinted inside: the board's colour. */
  boardColour: string;
  /** The board, for its thickness (U3.3: the box is drawn with its real caliper). */
  material: MaterialSpec;
  labels: Preview3DLabels;
  /** File name (no extension) for the PNG. */
  name: string;
  /** The artwork printed inside (U4.3), on the sheet as seen from inside, or `null`. */
  insideArtwork?: string | null;
  /** Each face's name ("ฝาบน") — face picking says which face was picked. */
  faceLabels?: Record<string, string>;
  /** The face being edited: highlighted, and the box turns to face it (U4.3). */
  focusedFaceId?: string | null;
  /** A face picked in 3D (a click or tap on it), or `null` for a click beside the box. */
  onPickFace?: (faceId: string | null) => void;
  /** Fill the parent (the studio's split view) instead of a square card. */
  fill?: boolean;
  /** Face-pick buttons for keyboard and screen readers (every canvas action has a panel equivalent). */
  pickLabel?: string;
}

/**
 * Lighting as physics, not brand: plain whites and a warm tungsten, so the preview neither
 * flatters nor tints the customer's colours beyond what a room would.
 */
const LIGHTING: Record<LightingPreset, { ambient: [string, number]; key: [string, number]; fill: [string, number] }> = {
  studio: { ambient: ["#ffffff", 0.55], key: ["#ffffff", 1.6], fill: ["#ffffff", 0.5] },
  daylight: { ambient: ["#eef4ff", 0.8], key: ["#fffaf0", 1.2], fill: ["#dfe9ff", 0.6] },
  warm: { ambient: ["#fff1dc", 0.5], key: ["#ffd9a8", 1.5], fill: ["#ffe8cc", 0.4] },
};

/**
 * Each face triangulated once, in sheet millimetres, wound to face the printed side (+Z), with its
 * outline and holes as loops for the cut edges.
 */
function triangulated(d: Dieline): { id: string; triangles: Pt[]; loops: Pt[][] }[] {
  return allFaces(d).map((f) => {
    const triangles: Pt[] = [];
    for (const tri of triangulate(facePolygons(f))) {
      if (tri.length !== 3) continue;
      const [a, b, c] = tri as [Pt, Pt, Pt];
      // Lifting flips y, so a triangle clockwise on the sheet is counter-clockwise from +Z.
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      triangles.push(...(cross < 0 ? [a, b, c] : [a, c, b]));
    }
    const loops = [f.outline, ...f.holes].map((c) => flattenContour(c, 0.5));
    return { id: f.id, triangles, loops };
  });
}

/**
 * The box as two meshes from the engine's thickness model (`foldModel`): the printed outer surface,
 * carrying the artwork, and the board — the inner surface and every cut edge — in the board's
 * colour. A flat piece is a plate of the caliper.
 */
function buildGeometry(
  d: Dieline,
  faces: ReturnType<typeof triangulated>,
  hinges: HingeMap | null,
  material: MaterialSpec,
  progress: number,
) {
  const t = Math.max(0, material.caliperMm);
  const model = hinges ? foldModel(d, hinges, material, progress) : null;
  const byId = new Map(model?.faces.map((f) => [f.id, f]));
  const printed: number[] = [];
  const uvs: number[] = [];
  const board: number[] = [];
  const insideUvs: number[] = [];
  /** Each face's triangles in the printed mesh, `[first, count]` (picking maps a hit back to its face). */
  const ranges: { id: string; first: number; count: number }[] = [];
  for (const f of faces) {
    const m = byId.get(f.id);
    ranges.push({ id: f.id, first: printed.length / 9, count: f.triangles.length / 3 });
    const at = (p: Pt, z: number) => (m ? slabPoint(m, p, z) : [p[0], -p[1], z]);
    const lo = m?.lo ?? -t / 2;
    const hi = m?.hi ?? t / 2;
    for (const p of f.triangles) {
      printed.push(...at(p, hi));
      uvs.push(p[0] / d.width, 1 - p[1] / d.height);
    }
    // The inner surface carries the inside print, on the sheet as seen from inside (x mirrored).
    for (let i = 0; i < f.triangles.length; i += 3) {
      const [a, b, c] = [f.triangles[i]!, f.triangles[i + 1]!, f.triangles[i + 2]!];
      board.push(...at(a, lo), ...at(c, lo), ...at(b, lo));
      for (const p of [a, c, b]) insideUvs.push(1 - p[0] / d.width, 1 - p[1] / d.height);
    }
    if (hi - lo > 1e-6)
      for (const loop of f.loops)
        loop.forEach((a, i) => {
          const b = loop[(i + 1) % loop.length];
          board.push(...at(a, lo), ...at(b, lo), ...at(b, hi), ...at(a, lo), ...at(b, hi), ...at(a, hi));
        });
  }
  const make = (positions: number[], uv?: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    if (uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
    g.computeVertexNormals();
    return g;
  };
  const insideCount = insideUvs.length / 2;
  // The board mesh is the inner surface (with its UVs) then the cut edges (no print).
  const boardUvs = [...insideUvs, ...new Array<number>((board.length / 3 - insideCount) * 2).fill(0)];
  const geometries = { printed: make(printed, uvs), board: make(board, boardUvs) };
  geometries.board.addGroup(0, insideCount, 0);
  geometries.board.addGroup(insideCount, board.length / 3 - insideCount, 1);
  const box = new THREE.Box3().setFromBufferAttribute(
    geometries.printed.getAttribute("position") as THREE.BufferAttribute,
  );
  box.union(
    new THREE.Box3().setFromBufferAttribute(geometries.board.getAttribute("position") as THREE.BufferAttribute),
  );
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  // The longest side is 2 units, whatever the box's real size.
  const s = 2 / Math.max(size.x, size.y, size.z, 1);
  for (const g of [geometries.printed, geometries.board]) {
    g.translate(-centre.x, -centre.y, -centre.z);
    g.scale(s, s, s);
  }
  // Each face's outward normal (the mean of its printed triangles'), for turning the box to it.
  const position = geometries.printed.getAttribute("position") as THREE.BufferAttribute;
  const normals = new Map<string, THREE.Vector3>();
  const [va, vb, vc] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (const r of ranges) {
    const n = new THREE.Vector3();
    for (let t = r.first; t < r.first + r.count; t++) {
      va.fromBufferAttribute(position, t * 3);
      vb.fromBufferAttribute(position, t * 3 + 1);
      vc.fromBufferAttribute(position, t * 3 + 2);
      n.add(vb.clone().sub(va).cross(vc.clone().sub(va)));
    }
    if (n.lengthSq() > 0) normals.set(r.id, n.normalize());
  }
  return { ...geometries, ranges, normals };
}

type Geometry = ReturnType<typeof buildGeometry>;

/** A texture from an image URL, replaced (and the old one freed) when the URL changes. */
function useTexture(url: string | null | undefined) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    new THREE.TextureLoader().load(url, (loaded) => {
      if (!live) return loaded.dispose();
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = 4;
      setTexture((previous) => {
        previous?.dispose();
        return loaded;
      });
    });
    return () => {
      live = false;
    };
  }, [url]);
  return url ? texture : null;
}

/** The face a hit triangle belongs to. */
const faceOfTriangle = (ranges: Geometry["ranges"], index: number) =>
  ranges.find((r) => index >= r.first && index < r.first + r.count)?.id ?? null;

/** The focused face's printed triangles, drawn again as a translucent highlight. */
function useHighlight(geometry: Geometry, faceId: string | null | undefined) {
  return useMemo(() => {
    const range = faceId ? geometry.ranges.find((r) => r.id === faceId) : undefined;
    if (!range) return null;
    const source = geometry.printed.getAttribute("position") as THREE.BufferAttribute;
    const positions = new Float32Array(range.count * 9);
    for (let i = 0; i < range.count * 3; i++) {
      positions[i * 3] = source.getX(range.first * 3 + i);
      positions[i * 3 + 1] = source.getY(range.first * 3 + i);
      positions[i * 3 + 2] = source.getZ(range.first * 3 + i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [geometry, faceId]);
}

function Box({
  geometry,
  artwork,
  insideArtwork,
  boardColour,
  rotation,
  focusedFaceId,
  onPickFace,
}: {
  geometry: Geometry;
  artwork: string | null;
  insideArtwork?: string | null;
  boardColour: string;
  rotation: { x: number; y: number };
  focusedFaceId?: string | null;
  onPickFace?: (faceId: string | null) => void;
}) {
  const texture = useTexture(artwork);
  const inside = useTexture(insideArtwork);
  const highlight = useHighlight(geometry, focusedFaceId);
  useEffect(
    () => () => {
      geometry.printed.dispose();
      geometry.board.dispose();
    },
    [geometry],
  );

  return (
    <group rotation={[rotation.x, rotation.y, 0]}>
      <mesh
        geometry={geometry.printed}
        onClick={
          onPickFace
            ? (event) => {
                event.stopPropagation();
                if (event.delta > 4) return; // the end of an orbit drag, not a pick
                onPickFace(event.faceIndex == null ? null : faceOfTriangle(geometry.ranges, event.faceIndex));
              }
            : undefined
        }
      >
        <meshStandardMaterial
          map={texture}
          color={texture ? "#ffffff" : boardColour}
          side={THREE.FrontSide}
          roughness={0.75}
        />
      </mesh>
      <mesh geometry={geometry.board}>
        <meshStandardMaterial
          attach="material-0"
          map={inside}
          color={inside ? "#ffffff" : boardColour}
          side={THREE.DoubleSide}
          roughness={0.9}
        />
        <meshStandardMaterial attach="material-1" color={boardColour} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      {highlight ? (
        <mesh geometry={highlight} renderOrder={1}>
          <meshBasicMaterial color="#2f80ed" transparent opacity={0.22} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Hands the renderer to the parent, for the PNG export. */
function Grab({ rendererRef }: { rendererRef: React.RefObject<THREE.WebGLRenderer | null> }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    rendererRef.current = gl;
  }, [gl, rendererRef]);
  return null;
}

const STEP = Math.PI / 12;
const INITIAL = { x: 0.35, y: -0.6 };
const TILT = Math.PI / 2;

/**
 * The rotation (about Y, then X — the group's Euler order) that turns a face's outward normal to
 * the camera (+Z): yaw it into the Y–Z plane, then tilt it up or down.
 */
export function facing(n: { x: number; y: number; z: number }): { x: number; y: number } {
  const y = Math.atan2(-n.x, n.z);
  const z = Math.hypot(n.x, n.z);
  return { x: Math.max(-TILT, Math.min(TILT, Math.atan2(n.y, z))), y };
}

/**
 * The box in WebGL (F4 Part D): folded from the dieline by the engine's own transforms, with the
 * artwork as it is on the sheet. Loaded only when the 3D tab opens, so three.js never weighs on
 * the editor's first paint. The fold slider shows the box closing; the buttons rotate it as the
 * drag does (WCAG 2.5.7); with reduced motion, "play" jumps instead of animating.
 */
export default function Preview3D({
  dieline,
  hinges,
  artwork,
  boardColour,
  material,
  labels,
  name,
  insideArtwork,
  faceLabels,
  focusedFaceId,
  onPickFace,
  fill = false,
  pickLabel,
}: Preview3DProps) {
  const [progress, setProgress] = useState(1);
  const [rotation, setRotation] = useState(INITIAL);
  const [lighting, setLighting] = useState<LightingPreset>("studio");
  const drag = useRef<{ x: number; y: number; start: typeof INITIAL } | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const animation = useRef<number | null>(null);

  const faces = useMemo(() => triangulated(dieline), [dieline]);
  const geometry = useMemo(
    () => buildGeometry(dieline, faces, hinges, material, progress),
    [dieline, faces, hinges, material, progress],
  );
  useEffect(() => () => cancelAnimationFrame(animation.current ?? 0), []);

  // Face-aware editing (U4.3): a face picked here, or focused anywhere else, turns to face the camera.
  const [turnedTo, setTurnedTo] = useState<string | null>(null);
  if ((focusedFaceId ?? null) !== turnedTo) {
    setTurnedTo(focusedFaceId ?? null);
    const n = focusedFaceId ? geometry.normals.get(focusedFaceId) : undefined;
    if (n) setRotation(facing(n));
  }

  const play = () => {
    cancelAnimationFrame(animation.current ?? 0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setProgress(1);
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 1800);
      setProgress(t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
      if (t < 1) animation.current = requestAnimationFrame(tick);
    };
    setProgress(0);
    animation.current = requestAnimationFrame(tick);
  };

  const exportPng = () => {
    const gl = renderer.current;
    if (!gl) return;
    const a = document.createElement("a");
    a.href = gl.domElement.toDataURL("image/png");
    a.download = `${name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "design"}-3d.png`;
    a.click();
  };

  const light = LIGHTING[lighting];
  const rotate = (dx: number, dy: number) =>
    setRotation((r) => ({ x: Math.max(-TILT, Math.min(TILT, r.x + dy)), y: r.y + dx }));

  return (
    <div className={fill ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-3"}>
      <div
        role="img"
        aria-label={labels.canvas}
        className={
          fill
            ? "bg-surface-subtle min-h-48 w-full flex-1 touch-none overflow-hidden rounded-lg"
            : "bg-surface-subtle aspect-square w-full touch-none overflow-hidden rounded-lg"
        }
        onPointerDown={(event) => {
          (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, start: rotation };
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          if (!d) return;
          setRotation({
            x: Math.max(-TILT, Math.min(TILT, d.start.x + (event.clientY - d.y) / 120)),
            y: d.start.y + (event.clientX - d.x) / 120,
          });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 35 }}
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          frameloop="demand"
        >
          <Grab rendererRef={renderer} />
          <ambientLight color={light.ambient[0]} intensity={light.ambient[1]} />
          <directionalLight color={light.key[0]} intensity={light.key[1]} position={[3, 4, 5]} />
          <directionalLight color={light.fill[0]} intensity={light.fill[1]} position={[-4, -1, -3]} />
          <Box
            geometry={geometry}
            artwork={artwork}
            insideArtwork={insideArtwork}
            boardColour={boardColour}
            rotation={rotation}
            focusedFaceId={focusedFaceId}
            onPickFace={onPickFace}
          />
        </Canvas>
      </div>

      {onPickFace && faceLabels ? (
        <div
          className={
            fill ? "flex shrink-0 items-center gap-1 overflow-x-auto pb-1" : "flex flex-wrap items-center gap-1"
          }
          role="group"
          aria-label={pickLabel}
        >
          {geometry.ranges
            .filter((r) => faceLabels[r.id])
            .map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={focusedFaceId === r.id}
                onClick={() => onPickFace(focusedFaceId === r.id ? null : r.id)}
                className={
                  "shrink-0 whitespace-nowrap " +
                  (focusedFaceId === r.id
                    ? "bg-primary-subtle text-primary-subtle-fg focus-visible:ring-focus-ring rounded-full px-2 py-0.5 text-xs outline-none focus-visible:ring-2"
                    : "hover:bg-surface-subtle focus-visible:ring-focus-ring rounded-full px-2 py-0.5 text-xs outline-none focus-visible:ring-2")
                }
              >
                {faceLabels[r.id]}
              </button>
            ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1">
        <IconButton
          name="arrow-left"
          label={labels.rotateLeft}
          size="sm"
          variant="ghost"
          onClick={() => rotate(-STEP, 0)}
        />
        <IconButton
          name="arrow-right"
          label={labels.rotateRight}
          size="sm"
          variant="ghost"
          onClick={() => rotate(STEP, 0)}
        />
        <IconButton
          name="chevron-up"
          label={labels.tiltUp}
          size="sm"
          variant="ghost"
          onClick={() => rotate(0, -STEP)}
        />
        <IconButton
          name="chevron-down"
          label={labels.tiltDown}
          size="sm"
          variant="ghost"
          onClick={() => rotate(0, STEP)}
        />
        <IconButton name="reset" label={labels.reset} size="sm" variant="ghost" onClick={() => setRotation(INITIAL)} />
        <span className="ms-auto flex gap-1">
          {hinges ? <IconButton name="play" label={labels.play} size="sm" variant="ghost" onClick={play} /> : null}
          <IconButton name="download" label={labels.exportPng} size="sm" variant="ghost" onClick={exportPng} />
        </span>
      </div>

      {hinges ? (
        <Slider
          aria-label={labels.fold}
          value={[Math.round(progress * 100)]}
          min={0}
          max={100}
          onValueChange={([value]) => {
            cancelAnimationFrame(animation.current ?? 0);
            setProgress(value / 100);
          }}
          valueText={`${Math.round(progress * 100)} %`}
        />
      ) : (
        <p className="text-muted text-xs">{labels.flat}</p>
      )}

      <SegmentedControl
        label={labels.lighting}
        size="sm"
        value={lighting}
        onValueChange={(value) => setLighting(value as LightingPreset)}
        options={(Object.keys(LIGHTING) as LightingPreset[]).map((preset) => ({
          value: preset,
          label: labels.lightingPreset[preset],
        }))}
      />
    </div>
  );
}
