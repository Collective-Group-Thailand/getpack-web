"use client";
import type Konva from "konva";
import { dielineToDxf, dielineToPdf, dielineToSvg, PX_PER_MM } from "@packio/dieline";
import type { Dieline } from "./types";

const MAX_CANVAS_PX = 12000;

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const safeName = (n: string) => n.replace(/[\\/:*?"<>|]+/g, "_").trim() || "design";

/** Renders the dieline area at `pxPerMm` resolution. */
export function renderDieline(
  stage: Konva.Stage,
  d: Dieline,
  opts: { pxPerMm: number; withGuides: boolean; marginMm?: number },
): string {
  const margin = opts.marginMm ?? 3;
  const guides = stage.find(".guide");
  const prev = guides.map((g) => g.visible());
  if (!opts.withGuides) guides.forEach((g) => g.visible(false));
  // Always hide the transformer
  stage.find("Transformer").forEach((t) => t.visible(false));

  const scale = stage.scaleX();
  const pxPerMm = Math.min(opts.pxPerMm, MAX_CANVAS_PX / (Math.max(d.width, d.height) + margin * 2));
  try {
    return stage.toDataURL({
      x: stage.x() - margin * scale,
      y: stage.y() - margin * scale,
      width: (d.width + margin * 2) * scale,
      height: (d.height + margin * 2) * scale,
      pixelRatio: pxPerMm / scale,
      mimeType: "image/png",
    });
  } finally {
    guides.forEach((g, i) => g.visible(prev[i]));
    stage.find("Transformer").forEach((t) => t.visible(true));
    stage.batchDraw();
  }
}

export function exportPng(stage: Konva.Stage, d: Dieline, name: string, withGuides: boolean) {
  const url = renderDieline(stage, d, { pxPerMm: 300 / 25.4, withGuides });
  download(url, `${safeName(name)}${withGuides ? "-preview" : ""}.png`);
}

/** The print file (vector die on spot layers, artwork at 300 dpi with bleed), downloaded. */
export async function exportPrintPdf(stage: Konva.Stage, d: Dieline, name: string, bleedMm: number) {
  const { buildPrintPdf } = await import("./print");
  const blob = await buildPrintPdf(stage, d, { name, bleedMm });
  const url = URL.createObjectURL(blob);
  download(url, `${safeName(name)}-print.pdf`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The die as a true-size SVG with CUT / CREASE / PERF / HALFCUT / GLUE layers. */
export function exportDielineSvg(d: Dieline, name: string) {
  downloadBlob(
    new Blob([dielineToSvg(d, { margin: 3, annotations: true })], { type: "image/svg+xml" }),
    `${safeName(name)}-dieline.svg`,
  );
}

/** The die as DXF (R12, millimetres, same layers) for the die-maker's CAD. */
export function exportDielineDxf(d: Dieline, name: string) {
  downloadBlob(new Blob([dielineToDxf(d)], { type: "application/dxf" }), `${safeName(name)}-dieline.dxf`);
}

/** The die as a vector PDF, each layer a spot colour (CutContour, Crease…). */
export function exportDielinePdf(d: Dieline, name: string) {
  const bytes = dielineToPdf(d, { title: name });
  downloadBlob(new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }), `${safeName(name)}-dieline.pdf`);
}

export function makeThumbnail(stage: Konva.Stage, d: Dieline): string {
  const target = 360;
  return renderDieline(stage, d, { pxPerMm: target / Math.max(d.width, d.height), withGuides: true });
}

export { PX_PER_MM };
