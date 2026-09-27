"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "./Button";
import { Field } from "./Field";
import { Input } from "./Input";
import { SegmentedControl } from "./SegmentedControl";

export interface SignaturePadLabels {
  /** The pad's accessible name: "ลายเซ็นผู้รับ". */
  label: string;
  hint: string;
  clear: string;
  draw: string;
  type: string;
  typedName: string;
  mode: string;
}

export interface SignaturePadProps {
  /** A PNG of the signature, or `null` once cleared. */
  onChange: (signature: Blob | null) => void;
  labels: SignaturePadLabels;
  className?: string;
}

const WIDTH = 600;
const HEIGHT = 220;

/**
 * A receiver signs on the phone's screen (design-system.md §3, the POD in D-013). Drawing is a
 * dragging gesture, so there is always the alternative WCAG 2.5.7 asks for: the receiver's name
 * typed and rendered as the signature image. Either way the result is a PNG the POD uploads.
 */
export function SignaturePad({ onChange, labels, className }: SignaturePadProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [name, setName] = useState("");
  const [dirty, setDirty] = useState(false);
  const hintId = useId();

  const context = () => {
    const ctx = canvas.current?.getContext("2d") ?? null;
    if (ctx) {
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
      ctx.fillStyle = "#111";
    }
    return ctx;
  };

  const emit = () =>
    canvas.current?.toBlob ? canvas.current.toBlob((blob) => onChange(blob), "image/png") : onChange(null);

  const clear = () => {
    const ctx = context();
    ctx?.clearRect(0, 0, WIDTH, HEIGHT);
    setDirty(false);
    onChange(null);
  };

  // A typed name is drawn as the signature, in a script-like weight, so the POD has an image either way.
  useEffect(() => {
    if (mode !== "type") return;
    const ctx = context();
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (!name.trim()) return onChange(null);
    ctx.font = "italic 600 56px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(name.trim(), 24, HEIGHT / 2, WIDTH - 48);
    emit();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw on the name and the mode only
  }, [name, mode]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      ((event.clientX - box.left) / box.width) * WIDTH,
      ((event.clientY - box.top) / box.height) * HEIGHT,
    ] as const;
  };

  return (
    <div className={className}>
      <SegmentedControl
        label={labels.mode}
        size="xl"
        value={mode}
        onValueChange={(next) => {
          setMode(next);
          clear();
          setName("");
        }}
        options={[
          { value: "draw", label: labels.draw, icon: "edit" },
          { value: "type", label: labels.type, icon: "text" },
        ]}
      />
      <canvas
        ref={canvas}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={labels.label}
        aria-describedby={hintId}
        className="border-border-strong mt-3 block aspect-[60/22] w-full touch-none rounded-lg border-2 bg-white"
        onPointerDown={(event) => {
          if (mode !== "draw") return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = true;
          const ctx = context();
          const [x, y] = point(event);
          ctx?.beginPath();
          ctx?.moveTo(x, y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const ctx = context();
          const [x, y] = point(event);
          ctx?.lineTo(x, y);
          ctx?.stroke();
          setDirty(true);
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          emit();
        }}
      />
      <p id={hintId} className="text-muted mt-1 text-sm">
        {labels.hint}
      </p>
      {mode === "type" ? (
        <Field label={labels.typedName} className="mt-3">
          <Input inputSize="lg" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      ) : (
        <Button variant="ghost" size="lg" iconStart="reset" disabled={!dirty} onClick={clear} className="mt-2">
          {labels.clear}
        </Button>
      )}
    </div>
  );
}
