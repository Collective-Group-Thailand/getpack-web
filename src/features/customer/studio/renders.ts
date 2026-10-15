"use client";

import type Konva from "konva";
import { mirrorDieline, type Dieline } from "@packio/dieline";

import { uploadFile } from "@/features/shared/files/upload";
import { FINISH_SEPARATIONS, finishesIn, finishMask } from "@/features/designer/lib/finishes";
import { captureArtworkTiles } from "@/features/designer/print";
import { useEditor } from "@/features/designer/store/editor";
import { browserApi } from "@/lib/api/browser";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** A length in mm at the API's precision (two decimals), never `-0`. */
const mm = (value: number) => Math.round(value * 100) / 100 || 0;

/**
 * The studio's renders of a version for its print file (D-280, ADR-0013): packio-api assembles the
 * print PDF from the engine's vector die and **these** — the artwork the studio itself drew, at
 * 300 dpi with the bleed, in tiles (`kind: tile`), per printed side (the inside on the sheet as seen
 * from inside), and each finish as its own mask (`kind: finish_mask`, the separation's name). There
 * is no second implementation of the canvas: the tiles come from the same capture as the browser
 * print file (`captureArtworkTiles`).
 */
export async function uploadRenders(
  stage: Konva.Stage,
  input: {
    designId: string;
    versionNo: number;
    dieline: Dieline;
    bleedMm: number;
    sides: ("outside" | "inside")[];
    onProgress?: (done: number, total: number) => void;
  },
): Promise<number> {
  const editor = useEditor.getState();
  const before = editor.side;
  let count = 0;
  const post = async (
    file: File,
    body: {
      kind: "tile" | "finish_mask";
      side: "outside" | "inside";
      separation?: string;
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ) => {
    const uploaded = await uploadFile("customer", file, "artwork");
    await browserApi().POST("/v1/store/studio/{designId}/versions/{versionNo}/renders", {
      params: { path: { designId: input.designId, versionNo: input.versionNo } },
      body: {
        fileId: uploaded.id,
        kind: body.kind,
        side: body.side,
        ...(body.separation ? { separation: body.separation } : {}),
        // The API takes two decimals (0.01 mm, AddRenderDto); a tile's edge computed from pixels at
        // 300 dpi is a long float, which it refused as 422 — the whole order step failed on it.
        xMm: mm(body.x),
        yMm: mm(body.y),
        widthMm: mm(body.width),
        heightMm: mm(body.height),
      },
    });
    count += 1;
  };
  try {
    for (const side of input.sides) {
      if (useEditor.getState().side !== side) {
        useEditor.getState().setSide(side);
        await nextFrame();
        await nextFrame();
      }
      const d = side === "inside" ? mirrorDieline(input.dieline) : input.dieline;
      const tiles = await captureArtworkTiles(stage, d, { bleedMm: input.bleedMm });
      const elements = useEditor.getState().content.elements;
      const finishes = side === "outside" ? finishesIn(elements) : [];
      const total = tiles.length + finishes.length;
      let done = 0;
      for (const [i, tile] of tiles.entries()) {
        const file = new File([tile.jpeg as BlobPart], `${side}-tile-${i + 1}.jpg`, { type: "image/jpeg" });
        await post(file, { kind: "tile", side, x: tile.x, y: tile.y, width: tile.width, height: tile.height });
        input.onProgress?.(++done, total);
      }
      for (const finish of finishes) {
        const mask = finishMask(elements, finish, d, 300 / 25.4);
        const blob = await new Promise<Blob>((resolve, reject) =>
          mask.toBlob((b) => (b ? resolve(b) : reject(new Error("mask"))), "image/png"),
        );
        await post(new File([blob], `${finish}.png`, { type: "image/png" }), {
          kind: "finish_mask",
          side,
          separation: FINISH_SEPARATIONS[finish].name,
          x: 0,
          y: 0,
          width: d.width,
          height: d.height,
        });
        input.onProgress?.(++done, total);
      }
    }
  } finally {
    if (useEditor.getState().side !== before) useEditor.getState().setSide(before);
  }
  return count;
}
