"use client";
import { dielineToDxf, dielineToPdf, dielineToSvg } from "@getpack/dieline";

import { download, safeName } from "./export";
import type { Dieline } from "./types";

/*
 * The die as files (SVG, DXF, vector PDF), loaded when the export menu asks for one: the writers are
 * the engine's, and the editor's first load does not need them.
 */

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
