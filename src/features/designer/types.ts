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

export type PatternKind = "none" | "solid" | "stripes" | "dots" | "grid" | "checker" | "gradient" | "image";

export interface PatternSettings {
  kind: PatternKind;
  color: string;
  background: string;
  /** Tile size in mm */
  size: number;
  /** `gradient`: from `color` to `background`, at this angle (degrees, 90 = top to bottom). */
  angle?: number;
  /** `image` (U4.4 full wrap): one picture over the whole sheet and its bleed, cover-fitted. */
  image?: { src: string; assetId?: string; naturalWidth: number; naturalHeight: number };
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
  /**
   * Printed on the inside of the box (U4.3): its position is on the sheet as seen from the inside
   * (the dieline mirrored, `mirrorDieline`), so it reads the right way round once folded.
   */
  side?: "inside";
  /** Placed by a studio template (U4.4): its slot and roles, so a brand kit can restyle it. */
  templateRole?: {
    slot: string;
    role: "logo" | "headline" | "subhead" | "body" | "info" | "band" | "badge";
    colour: "primary" | "accent" | "ink" | "paper";
    font?: "heading" | "body";
  };
  /** A Packio studio element it was placed from (D-282): marks with legal meaning are checked by it. */
  studioElementId?: string;
  /** A finish painted as its own layer (U4.4): produced as a separation, not as ink. */
  finish?: "foil" | "spot_uv" | "emboss" | "window";
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
  /** As the file was saved (U4.4 colour-space warning): CMYK JPEGs show differently on screen. */
  colourSpace?: "rgb" | "cmyk";
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

/** A QR code or a barcode (EAN-13, EAN-8, UPC-A, Code 128), generated from its value; the quiet zone is part of its size. */
export interface CodeElement extends BaseElement {
  type: "code";
  kind: "qr" | "ean13" | "ean8" | "upca" | "code128";
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
/**
 * What the studio's ② Box step chose beyond the dieline (U4.2): how it is printed, on which sides,
 * the coating and finishes (the product's catalogue option ids), the size basis it was entered
 * on and the published style variant. Absent on a design made outside the studio.
 */
export interface StudioChoices {
  /** `null` — "ให้ระบบเลือก": the inks the artwork needs, as the F4 designer inferred them. */
  printMethod?: "digital" | "offset" | "flexo" | "none" | null;
  printSides?: "outside" | "inside" | "both" | "none";
  coatingId?: string | null;
  finishIds?: string[];
  basis?: "internal" | "external" | "over_crease";
  styleVariantCode?: string | null;
  /** The base the variant belongs to (`PK-TE-01`), for a library style the main entry does not name. */
  baseCode?: string | null;
  /** Handed to Packio's design team (U4.8): the version is priced with the graphic design fee. */
  designService?: boolean;
}

export interface DesignSpec extends DielineSpec {
  productDims?: BoxDims;
  studio?: StudioChoices;
  /** The catalogue pattern the design is for, when it came from a product. */
  patternId?: string | null;
  /** The material's name and board colour as chosen, so a design draws without the catalogue. */
  materialName?: string;
  boardColour?: string;
}

export interface DesignContent {
  elements: DesignElement[];
  pattern: PatternSettings;
  /**
   * Warnings the customer accepted that only the studio can see (U4.5, `ruleId:elementId`), kept with
   * the design version; the ones packio-api also finds are acknowledged with it (`acknowledgeCheck`).
   */
  acknowledged?: string[];
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
