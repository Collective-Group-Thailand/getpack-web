export type Pt = [number, number];

/** One panel of a flat dieline. Units: millimetres. */
export interface Face {
  id: string;
  name: string;
  points: Pt[];
  /** Indices of edges (points[i] -> points[i+1]) that are fold/crease lines. All others are cut lines. */
  folds: number[];
}

export interface Dieline {
  faces: Face[];
  width: number;
  height: number;
}

export type BoxStyleId = "rsc" | "tuck-end" | "tray";

export interface BoxDims {
  length: number; // L
  width: number; // W
  height: number; // H
}

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
