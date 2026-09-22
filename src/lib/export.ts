"use client";
import type Konva from "konva";
import { jsPDF } from "jspdf";
import { dielineToSvg } from "./dieline";
import { PX_PER_MM } from "./geometry";
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

/** Print-ready PDF at true size (mm): artwork page + dieline page. */
export function exportPdf(stage: Konva.Stage, d: Dieline, name: string) {
  const margin = 3;
  const w = d.width + margin * 2;
  const h = d.height + margin * 2;
  const pdf = new jsPDF({ unit: "mm", format: [w, h], orientation: w > h ? "landscape" : "portrait" });
  const art = renderDieline(stage, d, { pxPerMm: 200 / 25.4, withGuides: false, marginMm: margin });
  pdf.addImage(art, "PNG", 0, 0, w, h);
  pdf.setProperties({ title: `${name} — artwork` });

  const withLines = renderDieline(stage, d, { pxPerMm: 150 / 25.4, withGuides: true, marginMm: margin });
  pdf.addPage([w, h], w > h ? "landscape" : "portrait");
  pdf.addImage(withLines, "PNG", 0, 0, w, h);
  pdf.save(`${safeName(name)}.pdf`);
}

export function exportDielineSvg(d: Dieline, name: string) {
  const blob = new Blob([dielineToSvg(d, 3)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  download(url, `${safeName(name)}-dieline.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function makeThumbnail(stage: Konva.Stage, d: Dieline): string {
  const target = 360;
  return renderDieline(stage, d, { pxPerMm: target / Math.max(d.width, d.height), withGuides: true });
}

export { PX_PER_MM };
