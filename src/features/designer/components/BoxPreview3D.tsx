"use client";

import { useRef, useState } from "react";

import type { BoxDims, BoxStyleId } from "@/features/designer/types";
import { IconButton } from "@/ui/components/IconButton";
import { cn } from "@/ui/lib/cn";

export interface BoxPreview3DLabels {
  /** "หมุนไปทางซ้าย" … — the button alternatives to dragging (WCAG 2.5.7). */
  rotateLeft: string;
  rotateRight: string;
  tiltUp: string;
  tiltDown: string;
  reset: string;
}

export interface BoxPreview3DProps {
  style: BoxStyleId;
  /** Millimetres, as the configurator holds them. */
  dims: BoxDims;
  /** `#RRGGBB` of the board's outside, from the API's swatch. */
  colour: string;
  /** Whether the outside is printed — shows an artwork placeholder on the front. */
  printed?: boolean;
  /** Describes the box: "กล่องฝาเสียบ 120 × 80 × 60 มม. กระดาษอาร์ตการ์ด". */
  label: string;
  labels: BoxPreview3DLabels;
  className?: string;
}

const STEP = 15;
const INITIAL = { x: -22, y: -34 };
/** The longest side is drawn this many CSS pixels long, whatever the box's real size. */
const FIT = 170;

/**
 * The box in 3D (D-152), live as the dimensions change.
 *
 * Plain CSS 3D transforms rather than WebGL: six faces positioned from the same L × W × H the
 * dieline is built from, so it weighs nothing on the product page (the 150 KB budget) and runs on
 * the mid-range phone design-system.md §1.6 names. The dieline-accurate folded model with
 * artwork is the designer's (F4); this answers "is that the shape and proportion I mean?".
 *
 * Rotation by drag, or by the buttons beside it — dragging is never the only way (WCAG 2.5.7), and
 * the buttons are what a keyboard reaches. With reduced motion, faces jump instead of easing.
 */
export function BoxPreview3D({ style, dims, colour, printed = false, label, labels, className }: BoxPreview3DProps) {
  const [angle, setAngle] = useState(INITIAL);
  const drag = useRef<{ x: number; y: number; start: typeof INITIAL } | null>(null);

  const longest = Math.max(dims.length, dims.width, dims.height, 1);
  const scale = FIT / longest;
  // Very flat boxes still get a visible height.
  const L = Math.max(dims.length * scale, 6);
  const W = Math.max(dims.width * scale, 6);
  const H = Math.max(dims.height * scale, 6);
  const open = style === "tray";

  const rotate = (dx: number, dy: number) =>
    setAngle((current) => ({ x: Math.max(-80, Math.min(80, current.x + dx)), y: current.y + dy }));

  const face = (
    key: string,
    width: number,
    height: number,
    transform: string,
    shade: number,
    extra?: React.ReactNode,
  ) => (
    <div
      key={key}
      className="absolute border border-black/15"
      style={{
        width,
        height,
        left: (L - width) / 2,
        top: (H - height) / 2,
        transform,
        backgroundColor: colour,
        backfaceVisibility: open ? "visible" : "hidden",
        // Light from the top left: each face a fixed step darker, so the shape reads.
        boxShadow: `inset 0 0 0 9999px rgba(0,0,0,${shade})`,
      }}
    >
      {extra}
    </div>
  );

  const artwork = printed ? (
    <div aria-hidden className="absolute inset-[18%] flex flex-col items-center justify-center gap-[8%]">
      <div className="bg-primary/70 aspect-square w-[34%] rounded-full" />
      <div className="h-[8%] w-[70%] rounded-full bg-black/35" />
      <div className="h-[6%] w-[48%] rounded-full bg-black/20" />
    </div>
  ) : null;

  const seam =
    style === "rsc" ? (
      <div aria-hidden className="absolute inset-y-0 start-1/2 w-px bg-black/25" />
    ) : style === "tuck-end" ? (
      <div aria-hidden className="absolute inset-x-0 top-[12%] h-px bg-black/25" />
    ) : null;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        role="img"
        aria-label={label}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, start: angle };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const { x, y, start } = drag.current;
          setAngle({
            x: Math.max(-80, Math.min(80, start.x - (event.clientY - y) * 0.5)),
            y: start.y + (event.clientX - x) * 0.5,
          });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className="relative flex h-64 w-full cursor-grab touch-none items-center justify-center rounded-xl select-none active:cursor-grabbing"
        style={{ perspective: 900 }}
      >
        <div
          className="relative motion-safe:transition-transform motion-safe:duration-200"
          style={{
            width: L,
            height: H,
            transformStyle: "preserve-3d",
            transform: `rotateX(${angle.x}deg) rotateY(${angle.y}deg)`,
          }}
        >
          {face("front", L, H, `translateZ(${W / 2}px)`, 0, artwork)}
          {face("back", L, H, `rotateY(180deg) translateZ(${W / 2}px)`, 0.18)}
          {face("right", W, H, `rotateY(90deg) translateZ(${L / 2}px)`, 0.12)}
          {face("left", W, H, `rotateY(-90deg) translateZ(${L / 2}px)`, 0.2)}
          {open ? null : face("top", L, W, `rotateX(90deg) translateZ(${H / 2}px)`, -0.06, seam)}
          {face("bottom", L, W, `rotateX(-90deg) translateZ(${H / 2}px)`, 0.3)}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          name="chevron-left"
          label={labels.rotateLeft}
          size="sm"
          variant="ghost"
          onClick={() => rotate(0, -STEP)}
        />
        <IconButton name="chevron-up" label={labels.tiltUp} size="sm" variant="ghost" onClick={() => rotate(STEP, 0)} />
        <IconButton
          name="chevron-down"
          label={labels.tiltDown}
          size="sm"
          variant="ghost"
          onClick={() => rotate(-STEP, 0)}
        />
        <IconButton
          name="chevron-right"
          label={labels.rotateRight}
          size="sm"
          variant="ghost"
          onClick={() => rotate(0, STEP)}
        />
        <IconButton name="reset" label={labels.reset} size="sm" variant="ghost" onClick={() => setAngle(INITIAL)} />
      </div>
    </div>
  );
}
