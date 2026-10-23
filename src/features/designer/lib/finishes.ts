import type { DesignElement } from "../types";

export type Finish = NonNullable<DesignElement["finish"]>;
export const FINISHES: Finish[] = ["foil", "spot_uv", "emboss", "window"];

/** Each finish's separation name and the tint a viewer shows it in (U4.4). */
export const FINISH_SEPARATIONS: Record<Finish, { name: string; cmyk: [number, number, number, number] }> = {
  foil: { name: "Foil", cmyk: [0, 0.2, 0.6, 0.2] },
  spot_uv: { name: "SpotUV", cmyk: [0.3, 0, 0, 0] },
  emboss: { name: "Emboss", cmyk: [0, 0.4, 0, 0] },
  window: { name: "Window", cmyk: [0.4, 0.1, 0, 0] },
};

/** The finishes the outside's artwork uses. */
export const finishesIn = (elements: DesignElement[]): Finish[] =>
  FINISHES.filter((f) => elements.some((el) => el.finish === f && el.side !== "inside"));

/**
 * One finish of the outside as a mask over the sheet — white where the finish goes, black elsewhere
 * — drawn straight from the document (shapes, paths, text at their size and turn), not from the
 * screen. The 3D model uses it as the finish's map; the print file as its stencil. Browser only.
 */
export function finishMask(
  elements: DesignElement[],
  finish: Finish,
  sheet: { width: number; height: number },
  pxPerMm: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sheet.width * pxPerMm));
  canvas.height = Math.max(1, Math.round(sheet.height * pxPerMm));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  for (const el of elements) {
    if (el.finish !== finish || el.side === "inside") continue;
    ctx.save();
    ctx.scale(pxPerMm, pxPerMm);
    ctx.translate(el.x, el.y);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.scale(el.scaleX, el.scaleY);
    if (el.type === "rect") {
      ctx.beginPath();
      if (el.cornerRadius > 0 && typeof ctx.roundRect === "function")
        ctx.roundRect(0, 0, el.width, el.height, el.cornerRadius);
      else ctx.rect(0, 0, el.width, el.height);
      ctx.fill();
    } else if (el.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(el.width / 2, el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (el.type === "shape" && el.path) {
      ctx.scale(el.width / 100, el.height / 100);
      ctx.fill(new Path2D(el.path), "evenodd");
    } else if (el.type === "text") {
      ctx.font = `${el.fontStyle.includes("italic") ? "italic " : ""}${el.fontStyle.includes("bold") ? "bold " : ""}${el.fontSize}px "${el.fontFamily}"`;
      ctx.textBaseline = "top";
      el.text.split("\n").forEach((line, i) => ctx.fillText(line, 0, i * el.fontSize * 1.25));
    }
    ctx.restore();
  }
  return canvas;
}

/** A mask as 1-bit rows (a set bit where the mask is light), for a PDF stencil. */
export function maskBits(canvas: HTMLCanvasElement): { bits: Uint8Array; widthPx: number; heightPx: number } {
  const { width, height } = canvas;
  const data = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  const stride = Math.ceil(width / 8);
  const bits = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4]! > 127) bits[y * stride + (x >> 3)]! |= 0x80 >> (x & 7);
  return { bits, widthPx: width, heightPx: height };
}

/** zlib (FlateDecode) bytes where the browser can make them, else `null` (the stencil goes uncompressed). */
export async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
