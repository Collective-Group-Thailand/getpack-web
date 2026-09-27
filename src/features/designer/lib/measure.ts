"use client";

import Konva from "konva";

import type { TextElement } from "../types";

/** A text element's own size in mm, as Konva lays it out (the same metrics the canvas uses). */
export function measureText(el: Pick<TextElement, "text" | "fontSize" | "fontFamily" | "fontStyle">): {
  width: number;
  height: number;
} {
  const node = new Konva.Text({
    text: el.text,
    fontSize: el.fontSize,
    fontFamily: el.fontFamily,
    fontStyle: el.fontStyle,
    lineHeight: 1.25,
  });
  const rect = node.getSelfRect();
  node.destroy();
  return { width: rect.width, height: rect.height };
}
