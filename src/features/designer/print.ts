"use client";

import type Konva from "konva";
import { dielineToPdf, type Dieline, type PdfImage } from "@packio/dieline";

import { withFlatWorld } from "./lib/capture";
import { useEditor } from "./store/editor";

/**
 * The print file, made in the browser (ADR-0009): the artwork rendered at `dpi` with the bleed
 * the settings ask for, placed as JPEG tiles under the engine's **vector** die lines on their
 * own spot-colour layers (`CutContour`, `Crease`…), with TrimBox and BleedBox set.
 *
 * Tiles keep every canvas under the limit the weakest supported browser allows (iOS Safari:
 * about 16.7 megapixels); text is part of the artwork raster at the same resolution, so the file
 * carries no font dependency. The canvas is switched into print mode for the capture — artwork
 * clipped to the bleed, white substrate, no guides — and back.
 */

export interface PrintOptions {
  name: string;
  bleedMm: number;
  /** Artwork resolution; 300 by default (the settings' minimum effective dpi). */
  dpi?: number;
}

/** The longest side of one tile, px — 4096² is inside every browser's canvas limit. */
const TILE_PX = 4096;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function dataUrlBytes(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(",") + 1);
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function buildPrintPdf(stage: Konva.Stage, d: Dieline, opts: PrintOptions): Promise<Blob> {
  const dpi = opts.dpi ?? 300;
  const pxPerMm = dpi / 25.4;
  const bleed = opts.bleedMm;
  const editor = useEditor.getState();
  editor.select(null);
  editor.setPrintMode(true);
  // Two frames: one for React to render print mode, one for Konva to draw it.
  await nextFrame();
  await nextFrame();
  const images: PdfImage[] = [];
  try {
    const scale = stage.scaleX();
    const x0 = -bleed;
    const y0 = -bleed;
    const w = d.width + 2 * bleed;
    const h = d.height + 2 * bleed;
    const tileMm = TILE_PX / pxPerMm;
    for (let ty = 0; ty < h; ty += tileMm) {
      for (let tx = 0; tx < w; tx += tileMm) {
        const tw = Math.min(tileMm, w - tx);
        const th = Math.min(tileMm, h - ty);
        const url = withFlatWorld(stage, () =>
          stage.toDataURL({
            x: stage.x() + (x0 + tx) * scale,
            y: stage.y() + (y0 + ty) * scale,
            width: tw * scale,
            height: th * scale,
            pixelRatio: pxPerMm / scale,
            mimeType: "image/jpeg",
            quality: 0.92,
          }),
        );
        images.push({
          jpeg: dataUrlBytes(url),
          widthPx: Math.round(tw * pxPerMm),
          heightPx: Math.round(th * pxPerMm),
          x: x0 + tx,
          y: y0 + ty,
          width: tw,
          height: th,
        });
      }
    }
  } finally {
    editor.setPrintMode(false);
    stage.batchDraw();
  }
  const bytes = dielineToPdf(d, { margin: bleed + 7, bleedMm: bleed, images, title: opts.name });
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}
