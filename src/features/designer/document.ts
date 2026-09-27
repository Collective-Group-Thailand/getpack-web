import { getStyle, isStyleId, isV1Spec, migrateSpec, remapV1Point, type Dieline, type Pt } from "@packio/dieline";

import type { BoxDims, DesignContent, DesignElement, DesignSpec } from "./types";

/**
 * The design document: what is stored for a design, locally or by the designs API. Version 2
 * carries an engine v2 spec (`specVersion: 2`); version 1 is the BoxStudio shape.
 */
export const DOCUMENT_SCHEMA_VERSION = 2;

/** The inside size a spec asks for, in millimetres. */
export function insideSize(spec: Pick<DesignSpec, "values">): BoxDims {
  return { length: Number(spec.values.length), width: Number(spec.values.width), height: Number(spec.values.height) };
}

/**
 * The size a spec asks for, as the style's size parameters in order ("150 × 100 × 80"), and
 * whether it is a box's inside L × W × H.
 */
export function sizeOf(spec: Pick<DesignSpec, "styleId" | "values">): { box: boolean; text: string } {
  const keys = getStyle(spec.styleId)
    .params.filter((p) => p.group === "size" && p.kind === "length")
    .map((p) => p.key);
  const box = ["length", "width", "height"].every((k) => keys.includes(k));
  const text = (box ? ["length", "width", "height"] : keys)
    .map((k) => spec.values[k])
    .filter((v) => typeof v === "number")
    .join(" × ");
  return { box, text };
}

/** The box a design sits on. */
export function dielineOf(spec: DesignSpec): Dieline {
  return getStyle(spec.styleId).build(spec.values, spec.material);
}

/** The point an element is anchored by when it moves with its face: its middle where it has a size. */
function anchorOf(el: DesignElement): Pt {
  if (el.type === "text") return [el.x, el.y];
  return [el.x + (el.width * el.scaleX) / 2, el.y + (el.height * el.scaleY) / 2];
}

function isContent(x: unknown): x is DesignContent {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<DesignContent>;
  return Array.isArray(c.elements) && !!c.pattern && typeof c.pattern === "object";
}

/**
 * Reads a stored design — any version this build knows — into the current shape, or `null`
 * when it is not one it understands (a viewer must not throw on a document written by a newer
 * designer). A BoxStudio design keeps its box and its artwork: every element moves with the face
 * it sat on, to the same place on that face of the v2 layout.
 */
export function readDesign(spec: unknown, content: unknown): { spec: DesignSpec; content: DesignContent } | null {
  if (!isContent(content)) return null;
  if (isV1Spec(spec)) {
    const next = migrateSpec(spec)!;
    const migrated: DesignSpec = { ...next, productDims: spec.productDims };
    const dieline = dielineOf(migrated);
    const elements = content.elements.map((el) => {
      const [ax, ay] = anchorOf(el);
      const [nx, ny] = remapV1Point(spec, dieline, [ax, ay]);
      return { ...el, x: el.x + (nx - ax), y: el.y + (ny - ay) } as DesignElement;
    });
    return { spec: migrated, content: { ...content, elements } };
  }
  const current = migrateSpec(spec);
  if (!current || !isStyleId(current.styleId)) return null;
  return { spec: { ...(spec as DesignSpec), ...current }, content };
}
