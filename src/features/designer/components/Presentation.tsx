"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { useTranslations } from "next-intl";
import type * as THREE from "three";
import type { Dieline, HingeMap, MaterialSpec } from "@packio/dieline";

import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { Box, buildGeometry, Grab, INITIAL, LIGHTING, triangulated, type LightingPreset } from "./Preview3D";

const ARView = dynamic(() => import("./ARView"), { ssr: false });

/** Packio's own scenes (no stock environments): a backdrop, a floor tone and the lighting. */
export const SCENES = {
  studio: { background: "#f3f2ef", floor: "#e4e2dc", lighting: "studio" },
  kraft: { background: "#e8dcc4", floor: "#d6c29d", lighting: "warm" },
  shelf: { background: "#2c3038", floor: "#3a3f48", lighting: "daylight" },
  daylight: { background: "#dde8f0", floor: "#c9d6df", lighting: "daylight" },
} as const satisfies Record<string, { background: string; floor: string; lighting: LightingPreset }>;
type Scene = keyof typeof SCENES;

const TURN_SECONDS = 8;
/** How far the lid opens in the open/close animation (fold progress, 1 = closed). */
const OPEN = 0.35;

export interface PresentationProps {
  dieline: Dieline;
  hinges: HingeMap | null;
  material: MaterialSpec;
  artwork: string | null;
  insideArtwork?: string | null;
  finishMasks?: Partial<Record<"foil" | "spot_uv" | "emboss" | "window", string>>;
  boardColour: string;
  name: string;
  onClose: () => void;
  /** The free die-line download (vector PDF, no artwork). */
  onDownloadDieline: () => void;
}

const fileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "design";

/** The first recording format this browser has, MP4 first. */
function recordingType(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const [mime, ext] of [
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm", "webm"],
  ] as const)
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

/**
 * Presentation mode (U4.7, studio-spec §3): the box alone, full size, on one of Packio's own scenes,
 * turning on a turntable and opening and closing — saved as a PNG or recorded as a video (MP4 where
 * the browser can, WebM otherwise) — with the die line free to download and the box in AR at its
 * real size. With reduced motion the turntable starts off and the lid jumps.
 */
export default function Presentation({
  dieline,
  hinges,
  material,
  artwork,
  insideArtwork,
  finishMasks,
  boardColour,
  name,
  onClose,
  onDownloadDieline,
}: PresentationProps) {
  const t = useTranslations("designer.present");
  const tCommon = useTranslations("common");
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [scene, setScene] = useState<Scene>("studio");
  const [turntable, setTurntable] = useState(!reduced);
  const [rotation, setRotation] = useState(INITIAL);
  const [progress, setProgress] = useState(1);
  const [recording, setRecording] = useState(false);
  const [ar, setAr] = useState(false);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const fold = useRef<number | null>(null);

  const faces = useMemo(() => triangulated(dieline), [dieline]);
  const geometry = useMemo(
    () => buildGeometry(dieline, faces, hinges, material, progress),
    [dieline, faces, hinges, material, progress],
  );

  // The turntable: one turn every TURN_SECONDS.
  useEffect(() => {
    if (!turntable && !recording) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setRotation((r) => ({ x: r.x, y: r.y + (dt * Math.PI * 2) / TURN_SECONDS }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [turntable, recording]);
  useEffect(() => () => cancelAnimationFrame(fold.current ?? 0), []);

  const toggleLid = () => {
    cancelAnimationFrame(fold.current ?? 0);
    const from = progress;
    const to = progress > (1 + OPEN) / 2 ? OPEN : 1;
    if (reduced) return setProgress(to);
    const started = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - started) / 1200);
      const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setProgress(from + (to - from) * eased);
      if (k < 1) fold.current = requestAnimationFrame(tick);
    };
    fold.current = requestAnimationFrame(tick);
  };

  const savePng = () => {
    const gl = renderer.current;
    if (!gl) return;
    const a = document.createElement("a");
    a.href = gl.domElement.toDataURL("image/png");
    a.download = `${fileName(name)}-${scene}.png`;
    a.click();
  };

  const record = () => {
    const gl = renderer.current;
    const type = recordingType();
    if (!gl || !type) return toast.error(t("noVideo"));
    const stream = gl.domElement.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    recorder.onstop = () => {
      setRecording(false);
      const url = URL.createObjectURL(new Blob(chunks, { type: type.mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName(name)}-${scene}.${type.ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(type.ext === "mp4" ? t("videoSaved") : t("videoSavedWebm"));
    };
    setRecording(true);
    recorder.start();
    // One full turn.
    setTimeout(() => recorder.state === "recording" && recorder.stop(), TURN_SECONDS * 1000);
  };

  const look = SCENES[scene];
  const light = LIGHTING[look.lighting];

  return (
    <>
      <Dialog
        open={!ar}
        onOpenChange={(next) => !next && onClose()}
        title={t("title")}
        description={t("body")}
        closeLabel={tCommon("actions.close")}
        size="xl"
      >
        <div className="space-y-3">
          <div
            role="img"
            aria-label={t("canvas", { name })}
            className="aspect-video w-full overflow-hidden rounded-lg"
            style={{ background: look.background }}
          >
            <Canvas
              camera={{ position: [0, 0.4, 4.4], fov: 32 }}
              dpr={[1, 2]}
              gl={{ preserveDrawingBuffer: true, antialias: true }}
            >
              <Grab rendererRef={renderer} />
              <color attach="background" args={[look.background]} />
              <ambientLight color={light.ambient[0]} intensity={light.ambient[1]} />
              <directionalLight color={light.key[0]} intensity={light.key[1]} position={[3, 4, 5]} />
              <directionalLight color={light.fill[0]} intensity={light.fill[1]} position={[-4, -1, -3]} />
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]}>
                <circleGeometry args={[2.4, 64]} />
                <meshStandardMaterial color={look.floor} roughness={1} />
              </mesh>
              <Box
                sheet={{ width: dieline.width, height: dieline.height }}
                geometry={geometry}
                artwork={artwork}
                insideArtwork={insideArtwork}
                boardColour={boardColour}
                rotation={rotation}
                finishMasks={finishMasks}
              />
            </Canvas>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              label={t("scene")}
              size="sm"
              value={scene}
              onValueChange={setScene}
              options={(Object.keys(SCENES) as Scene[]).map((value) => ({ value, label: t(`scenes.${value}`) }))}
            />
            <Switch checked={turntable} onCheckedChange={setTurntable} label={t("turntable")} disabled={recording} />
            {hinges ? (
              <Button size="sm" variant="secondary" onClick={toggleLid}>
                {progress > (1 + OPEN) / 2 ? t("openLid") : t("closeLid")}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" iconStart="image" onClick={savePng}>
              {t("png")}
            </Button>
            <Button size="sm" iconStart="play" loading={recording} onClick={record} disabled={recording}>
              {recording ? t("recording") : t("video")}
            </Button>
            <Button size="sm" variant="secondary" iconStart="box" onClick={() => setAr(true)}>
              {t("ar")}
            </Button>
            <Button size="sm" variant="ghost" iconStart="download" onClick={onDownloadDieline}>
              {t("dieline")}
            </Button>
          </div>
          <p className="text-muted text-xs">{t("free")}</p>
        </div>
      </Dialog>
      {ar ? (
        <ARView
          input={{ dieline, hinges, material, artwork, insideArtwork: insideArtwork ?? null, boardColour }}
          name={name}
          onClose={() => setAr(false)}
        />
      ) : null}
    </>
  );
}
