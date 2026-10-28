"use client";

import { ARTWORK_DEFAULTS } from "../canvas-colors";
import { FONT_FAMILIES } from "../catalog";
import type { NewElement } from "../types";
import { barModules, ean13CheckDigit, gs1CheckDigit } from "./codes";

/*
 * New elements, centred on a point of the sheet (the middle of the view, or of the focused face).
 * One place for their defaults, so every entry point — rail, toolbar, keyboard — adds the same thing.
 */

type Center = { x: number; y: number };
const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

/** Largest image accepted, in bytes. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const TEXT_PRESETS = {
  heading: { fontSize: 12, fontStyle: "bold" as const },
  subheading: { fontSize: 7, fontStyle: "bold" as const },
  body: { fontSize: 4, fontStyle: "normal" as const },
};

export function newText(
  c: Center,
  text: string,
  preset: keyof typeof TEXT_PRESETS = "heading",
  fontFamily = FONT_FAMILIES[0],
): NewElement {
  const p = TEXT_PRESETS[preset];
  return {
    ...base,
    type: "text",
    x: c.x - text.length * p.fontSize * 0.3,
    y: c.y - p.fontSize * 0.6,
    text,
    fontSize: p.fontSize,
    fontFamily,
    fontStyle: p.fontStyle,
    fill: ARTWORK_DEFAULTS.text,
    align: "center",
  };
}

export function newShape(
  c: Center,
  kind: "rect" | "circle" | "shape",
  path?: string,
  fill: string = ARTWORK_DEFAULTS.shapeFill,
): NewElement {
  return {
    ...base,
    type: kind,
    x: c.x - 25,
    y: c.y - 25,
    width: 50,
    height: 50,
    fill,
    stroke: ARTWORK_DEFAULTS.shapeStroke,
    strokeWidth: 0,
    cornerRadius: 0,
    ...(path ? { path } : {}),
  };
}

/** The X-dimension (module width) of a barcode at 100 % magnification, mm (GS1). */
const NOMINAL_MODULE_MM = 0.33;
/** Bar heights at 100 % (GS1 nominal, quiet zones aside); Code 128's is a practical default. */
const BAR_HEIGHT_MM: Record<"ean13" | "ean8" | "upca" | "code128", number> = {
  ean13: 25.93,
  upca: 25.93,
  ean8: 21.31,
  code128: 15,
};

/**
 * A QR code (25 mm square: comfortably above the minimum module size for a short URL) or a barcode
 * at its nominal 100 % size — modules × 0.33 mm, quiet zones included — and never narrower than the
 * minimum the validation service gave (`minWidthMm`, D-283). Barcode digits get their check digit.
 */
export function newCode(
  c: Center,
  kind: "qr" | "ean13" | "ean8" | "upca" | "code128",
  value: string,
  minWidthMm: number | null = null,
): NewElement {
  const digits =
    kind === "ean13" && /^\d{12}$/.test(value)
      ? value + ean13CheckDigit(value)
      : (kind === "ean8" && /^\d{7}$/.test(value)) || (kind === "upca" && /^\d{11}$/.test(value))
        ? value + gs1CheckDigit(value)
        : value;
  let [width, height] = [25, 25];
  if (kind !== "qr") {
    const modules = barModules(kind, digits)?.length ?? 113;
    width = modules * NOMINAL_MODULE_MM;
    height = BAR_HEIGHT_MM[kind];
  }
  if (minWidthMm && width < minWidthMm) {
    height *= minWidthMm / width;
    width = minWidthMm;
  }
  return {
    ...base,
    type: "code",
    kind,
    value: digits,
    x: c.x - width / 2,
    y: c.y - height / 2,
    width,
    height,
    fill: "#000000",
    background: "#ffffff",
  };
}

/**
 * The colour space a JPEG was saved in, from its frame header (SOF: 3 components = RGB / YCbCr,
 * 4 = CMYK); PNG, WebP and SVG are always RGB. Read from the first 64 KB, so it costs nothing.
 */
export function colourSpaceOf(bytes: Uint8Array, mimeType: string): "rgb" | "cmyk" {
  if (mimeType !== "image/jpeg") return "rgb";
  for (let i = 2; i + 9 < bytes.length;) {
    if (bytes[i] !== 0xff) return "rgb";
    const marker = bytes[i + 1]!;
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
      return bytes[i + 9] === 4 ? "cmyk" : "rgb";
    i += 2 + length;
  }
  return "rgb";
}

/** Reads an image file into an element 80 mm wide, keeping its pixel size for the resolution check. */
/** A data URL's colour space (a CMYK JPEG is flagged like an upload), read from its first bytes. */
function colourSpaceOfDataUrl(src: string): "rgb" | "cmyk" {
  const match = /^data:(image\/[a-z+]+);base64,/.exec(src);
  if (!match) return "rgb";
  try {
    const head = atob(
      src
        .slice(match[0].length, match[0].length + 87_384)
        .replace(/=+$/, "")
        .slice(0, 87_380),
    );
    return colourSpaceOf(
      Uint8Array.from(head, (ch) => ch.charCodeAt(0)),
      match[1]!,
    );
  } catch {
    return "rgb";
  }
}

/** An image from a data URL already in the browser (the Studio front door's logo, C7) — the same element as an upload. */
export function newImageFromSrc(c: Center, src: string): Promise<NewElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onerror = () => reject(new Error("unreadable"));
    img.onload = () => {
      const width = 80;
      const height = (img.height / img.width) * width;
      resolve({
        ...base,
        type: "image",
        src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        colourSpace: colourSpaceOfDataUrl(src),
        x: c.x - width / 2,
        y: c.y - height / 2,
        width,
        height,
      });
    };
    img.src = src;
  });
}

export function newImage(c: Center, file: File): Promise<NewElement> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMAGE_BYTES) return reject(new Error("too_large"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("unreadable"));
    const head = file.slice(0, 65536).arrayBuffer();
    reader.onload = async () => {
      const src = reader.result as string;
      const colourSpace = colourSpaceOf(new Uint8Array(await head.catch(() => new ArrayBuffer(0))), file.type);
      const img = new window.Image();
      img.onerror = () => reject(new Error("unreadable"));
      img.onload = () => {
        const width = 80;
        const height = (img.height / img.width) * width;
        resolve({
          ...base,
          type: "image",
          src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          colourSpace,
          x: c.x - width / 2,
          y: c.y - height / 2,
          width,
          height,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
