"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  allFaces,
  applyMat4,
  facePolygons,
  foldDieline,
  lift,
  triangulate,
  type Dieline,
  type HingeMap,
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
  labels: Preview3DLabels;
  /** File name (no extension) for the PNG. */
  name: string;
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

/** Each face triangulated once, in sheet millimetres, wound to face the printed side (+Z). */
function triangulated(d: Dieline): { id: string; triangles: Pt[] }[] {
  return allFaces(d).map((f) => {
    const triangles: Pt[] = [];
    for (const tri of triangulate(facePolygons(f))) {
      if (tri.length !== 3) continue;
      const [a, b, c] = tri as [Pt, Pt, Pt];
      // Lifting flips y, so a triangle clockwise on the sheet is counter-clockwise from +Z.
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      triangles.push(...(cross < 0 ? [a, b, c] : [a, c, b]));
    }
    return { id: f.id, triangles };
  });
}

function buildGeometry(d: Dieline, faces: { id: string; triangles: Pt[] }[], transforms: Map<string, number[]> | null) {
  const count = faces.reduce((n, f) => n + f.triangles.length, 0);
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  let i = 0;
  for (const f of faces) {
    const m = transforms?.get(f.id);
    for (const p of f.triangles) {
      const q = m ? applyMat4(m, lift(p)) : lift(p);
      positions.set(q, i * 3);
      uvs.set([p[0] / d.width, 1 - p[1] / d.height], i * 2);
      i++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  geometry.translate(-centre.x, -centre.y, -centre.z);
  // The longest side is 2 units, whatever the box's real size.
  const s = 2 / Math.max(size.x, size.y, size.z, 1);
  geometry.scale(s, s, s);
  return geometry;
}

function Box({
  geometry,
  artwork,
  boardColour,
  rotation,
}: {
  geometry: THREE.BufferGeometry;
  artwork: string | null;
  boardColour: string;
  rotation: { x: number; y: number };
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!artwork) return;
    let live = true;
    new THREE.TextureLoader().load(artwork, (loaded) => {
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
  }, [artwork]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group rotation={[rotation.x, rotation.y, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          map={texture}
          color={texture ? "#ffffff" : boardColour}
          side={THREE.FrontSide}
          roughness={0.75}
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={boardColour} side={THREE.BackSide} roughness={0.9} />
      </mesh>
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

/**
 * The box in WebGL (F4 Part D): folded from the dieline by the engine's own transforms, with the
 * artwork as it is on the sheet. Loaded only when the 3D tab opens, so three.js never weighs on
 * the editor's first paint. The fold slider shows the box closing; the buttons rotate it as the
 * drag does (WCAG 2.5.7); with reduced motion, "play" jumps instead of animating.
 */
export default function Preview3D({ dieline, hinges, artwork, boardColour, labels, name }: Preview3DProps) {
  const [progress, setProgress] = useState(1);
  const [rotation, setRotation] = useState(INITIAL);
  const [lighting, setLighting] = useState<LightingPreset>("studio");
  const drag = useRef<{ x: number; y: number; start: typeof INITIAL } | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const animation = useRef<number | null>(null);

  const faces = useMemo(() => triangulated(dieline), [dieline]);
  const geometry = useMemo(
    () => buildGeometry(dieline, faces, hinges ? foldDieline(dieline, hinges, progress) : null),
    [dieline, faces, hinges, progress],
  );
  useEffect(() => () => cancelAnimationFrame(animation.current ?? 0), []);

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
    setRotation((r) => ({ x: Math.max(-1.4, Math.min(1.4, r.x + dy)), y: r.y + dx }));

  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label={labels.canvas}
        className="bg-surface-subtle aspect-square w-full touch-none overflow-hidden rounded-lg"
        onPointerDown={(event) => {
          (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, start: rotation };
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          if (!d) return;
          setRotation({
            x: Math.max(-1.4, Math.min(1.4, d.start.x + (event.clientY - d.y) / 120)),
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
          <Box geometry={geometry} artwork={artwork} boardColour={boardColour} rotation={rotation} />
        </Canvas>
      </div>

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
