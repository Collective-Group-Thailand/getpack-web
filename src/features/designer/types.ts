// Box geometry lives in the framework-free engine; re-exported here so design code has
// one place to import its types from.
export type { BoxDims, BoxStyleId, Dieline, Face, Pt } from "@packio/dieline";
import type { BoxDims, BoxStyleId } from "@packio/dieline";

export type PatternKind = "none" | "solid" | "stripes" | "dots" | "grid" | "checker";

export interface PatternSettings {
  kind: PatternKind;
  color: string;
  background: string;
  /** Tile size in mm */
  size: number;
}

interface BaseElement {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number; // mm
  fontFamily: string;
  fontStyle: "normal" | "bold" | "italic" | "italic bold";
  fill: string;
  align: "left" | "center" | "right";
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string; // data URL
  width: number;
  height: number;
}

export interface ShapeElement extends BaseElement {
  type: "rect" | "circle";
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

export type DesignElement = TextElement | ImageElement | ShapeElement;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewElement = DistributiveOmit<DesignElement, "id">;

export interface DesignSpec {
  style: BoxStyleId;
  dims: BoxDims; // internal dimensions in mm
  paperId: string;
  /** product size used when the user chose custom mode (for reference) */
  productDims?: BoxDims;
}

export interface DesignContent {
  elements: DesignElement[];
  pattern: PatternSettings;
}

export interface SavedDesign {
  id: string;
  name: string;
  spec: DesignSpec;
  content: DesignContent;
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}
