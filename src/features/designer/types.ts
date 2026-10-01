// Box geometry lives in the framework-free engine; re-exported here so design code has
// one place to import its types from.
export type { Dieline, DielineSpec, Face, MaterialSpec, ParamValues, Pt } from "@packio/dieline";
import type { DielineSpec } from "@packio/dieline";

/** A box style id `@packio/dieline` knows (`tuck-end`, `rsc`, `tray`…). */
export type BoxStyleId = string;

/** Length × width × height in millimetres — the inside of a box, or a product to fit in one. */
export interface BoxDims {
  length: number;
  width: number;
  height: number;
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
  /** Cannot be moved, resized or deleted on the canvas until unlocked (layers panel). */
  locked?: boolean;
  /** Elements sharing a group id select and move together. */
  groupId?: string;
  /** The customer's own name for it in the layers panel. */
  name?: string;
  /** Clipped to this face's outline instead of the whole sheet. */
  clipFaceId?: string;
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
  /** A data URL until uploaded; then the asset's signed URL, refreshed from `assetId` on open. */
  src: string;
  /** The design asset (`store.design-assets`) once uploaded. */
  assetId?: string;
  /** The image's own pixel size, for the effective-resolution check. */
  naturalWidth?: number;
  naturalHeight?: number;
  width: number;
  height: number;
  /** The part of the image shown, as fractions of its natural size (0–1). */
  crop?: { x: number; y: number; width: number; height: number };
}

export interface ShapeElement extends BaseElement {
  /** `shape` draws `path` from the shape library, scaled into its width × height. */
  type: "rect" | "circle" | "shape";
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  /** SVG path data in a 100 × 100 box, for `shape`. */
  path?: string;
}

/** A QR code or an EAN-13 barcode, generated from its value; the quiet zone is part of its size. */
export interface CodeElement extends BaseElement {
  type: "code";
  kind: "qr" | "ean13";
  value: string;
  width: number;
  height: number;
  fill: string;
  background: string;
}

export type DesignElement = TextElement | ImageElement | ShapeElement | CodeElement;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewElement = DistributiveOmit<DesignElement, "id">;

/**
 * The box a design is drawn on: the engine's spec (style, parameter values, material) plus the
 * product size the customer typed, when they sized the box from their product.
 */
export interface DesignSpec extends DielineSpec {
  productDims?: BoxDims;
  /** The catalogue pattern the design is for, when it came from a product. */
  patternId?: string | null;
  /** The material's name and board colour as chosen, so a design draws without the catalogue. */
  materialName?: string;
  boardColour?: string;
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
  /** The catalogue product it was opened with (`DesignerCatalogDto.product.id`), for its import. */
  catalogProductId?: string;
  createdAt: number;
  updatedAt: number;
}
