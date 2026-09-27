"use client";

import { ARTWORK_DEFAULTS } from "../canvas-colors";
import { FONT_FAMILIES } from "../catalog";
import type { NewElement } from "../types";
import { ean13CheckDigit } from "./codes";

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

/**
 * A QR code (25 mm square: comfortably above the minimum module size for a short URL) or an
 * EAN-13 at its nominal 100 % size (37.29 × 25.93 mm incl. quiet zones). Twelve barcode digits
 * get their check digit.
 */
export function newCode(c: Center, kind: "qr" | "ean13", value: string): NewElement {
  const digits = kind === "ean13" && /^\d{12}$/.test(value) ? value + ean13CheckDigit(value) : value;
  const [width, height] = kind === "qr" ? [25, 25] : [37.29, 25.93];
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

/** Reads an image file into an element 80 mm wide, keeping its pixel size for the resolution check. */
export function newImage(c: Center, file: File): Promise<NewElement> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMAGE_BYTES) return reject(new Error("too_large"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("unreadable"));
    reader.onload = () => {
      const src = reader.result as string;
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
