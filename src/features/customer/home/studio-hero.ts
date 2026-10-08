import type { Schemas } from "@/lib/api/types";

export type HeroPresets = Schemas["HeroPresetsDto"];
export type HeroPreview = Schemas["HeroPreviewDto"];
export type HeroShapeId = Schemas["HeroShape"];
export type HeroMaterialId = Schemas["HeroMaterial"];
export type HeroPrintId = Schemas["HeroPrint"];
export type HeroSize = Schemas["HeroSizeDto"];

/** One choice of the panel: the size by its preset id (`<shape>:s<index>`). */
export interface HeroSelection {
  shape: HeroShapeId;
  sizeId: string;
  material: HeroMaterialId;
  print: HeroPrintId;
  qty: number;
}

/** A selection with the price `store.quotes.preview` gave it. */
export interface HeroPriced {
  selection: HeroSelection;
  preview: HeroPreview;
}

/**
 * One shape with what it offers, gathered from the presets' lists (D-310): its sizes, the boards
 * and prints published on its product (each with the option ids `/configure` takes) and its
 * quantities. Anything not listed for the shape is not offered on it.
 */
export interface HeroShapeView {
  id: HeroShapeId;
  productSlug: string;
  patternId: string;
  dielineKey: string | null;
  styleCode: string | null;
  sizes: HeroSize[];
  materials: { id: HeroMaterialId; materialId: string }[];
  prints: { id: HeroPrintId; inkIds: string[] }[];
  qtys: number[];
}

export function shapesOf(presets: HeroPresets | null): HeroShapeView[] {
  if (!presets) return [];
  return presets.shapes.map((shape) => ({
    id: shape.id,
    productSlug: shape.productSlug,
    patternId: shape.patternId,
    dielineKey: shape.dielineKey,
    styleCode: shape.styleCode,
    sizes: presets.sizes.filter((size) => size.shapeId === shape.id),
    materials: presets.materials.flatMap((material) =>
      material.options
        .filter((option) => option.shapeId === shape.id)
        .map((option) => ({ id: material.id, materialId: option.materialId })),
    ),
    prints: presets.prints.flatMap((print) =>
      print.options
        .filter((option) => option.shapeId === shape.id)
        .map((option) => ({ id: print.id, inkIds: option.inkIds })),
    ),
    qtys: shape.qtys,
  }));
}

/** The API's default, as a selection. */
export function selectionOfDefault(presets: HeroPresets | null): HeroSelection | null {
  const value = presets?.default;
  return value
    ? { shape: value.shape, sizeId: value.sizeId, material: value.material, print: value.print, qty: value.qty }
    : null;
}

/** The body `store.quotes.preview` takes: the preset size as inside millimetres (D-182). */
export function requestOf(selection: HeroSelection, shapes: HeroShapeView[]): Schemas["HeroPreviewRequestDto"] | null {
  const size = shapes.find((shape) => shape.id === selection.shape)?.sizes.find((s) => s.id === selection.sizeId);
  return size
    ? {
        shape: selection.shape,
        lengthMm: size.lengthMm,
        widthMm: size.widthMm,
        heightMm: size.heightMm,
        material: selection.material,
        print: selection.print,
        qty: selection.qty,
      }
    : null;
}

export const sameSelection = (a: HeroSelection, b: HeroSelection) =>
  a.shape === b.shape && a.sizeId === b.sizeId && a.material === b.material && a.print === b.print && a.qty === b.qty;

/** A shape opened on its first choices: first size and board, one colour when offered, first quantity. */
export function openingOf(shape: HeroShapeView): HeroSelection | null {
  const print = shape.prints.find((p) => p.id === "one") ?? shape.prints[0];
  const [size, material, qty] = [shape.sizes[0], shape.materials[0], shape.qtys[0]];
  return print && size && material && qty !== undefined
    ? { shape: shape.id, sizeId: size.id, material: material.id, print: print.id, qty }
    : null;
}

/**
 * The API's default first, then the nearest presets: the same shape at each other quantity, then
 * each other shape on its opening choices — never a selection the presets do not offer.
 */
export function candidates(first: HeroSelection | null, shapes: HeroShapeView[]): HeroSelection[] {
  const start = first ?? (shapes[0] ? openingOf(shapes[0]) : null);
  if (!start) return [];
  const own = shapes.find((shape) => shape.id === start.shape);
  const list: HeroSelection[] = [
    start,
    ...(own?.qtys.filter((q) => q !== start.qty).map((qty) => ({ ...start, qty })) ?? []),
    ...shapes.filter((shape) => shape.id !== start.shape).flatMap((shape) => openingOf(shape) ?? []),
  ];
  return list.filter((s, i) => list.findIndex((o) => sameSelection(o, s)) === i);
}

/**
 * The selection after the customer picks one axis: a choice the (new) shape does not offer falls
 * to that shape's own first one, so the panel never asks for an unoffered preset. A size keeps its
 * position (`s<index>`) across shapes when the new shape has one there.
 */
export function reconcile(selection: HeroSelection, shapes: HeroShapeView[]): HeroSelection {
  const shape = shapes.find((s) => s.id === selection.shape) ?? shapes[0];
  const opening = shape ? openingOf(shape) : null;
  if (!shape || !opening) return selection;
  const code = selection.sizeId.split(":")[1];
  const size = shape.sizes.find((s) => s.id === selection.sizeId) ?? shape.sizes.find((s) => s.code === code);
  return {
    shape: shape.id,
    sizeId: size?.id ?? opening.sizeId,
    material: shape.materials.some((m) => m.id === selection.material) ? selection.material : opening.material,
    print: shape.prints.some((p) => p.id === selection.print) ? selection.print : opening.print,
    qty: shape.qtys.includes(selection.qty) ? selection.qty : opening.qty,
  };
}
