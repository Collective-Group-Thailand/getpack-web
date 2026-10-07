import type { HeroPreview, HeroSelection, HeroShapePreset } from "@/lib/api/requests/store-hero";

/** The step of the selection's own quantity, when it has an instant unit price. */
export function pricedStep(preview: HeroPreview) {
  const step = preview.calculation.steps.find((s) => s.quantity === preview.selection.quantity);
  return step?.instant && step.unitPrice ? step : null;
}

/** A shape opened on its first choices: first size and board, one colour when offered, first quantity. */
export function openingOf(shape: HeroShapePreset): HeroSelection | null {
  const print = shape.prints.find((p) => p.id === "one") ?? shape.prints[0];
  const [size, board, quantity] = [shape.sizes[0], shape.boards[0], shape.quantities[0]];
  return print && size && board && quantity !== undefined
    ? { shape: shape.id, sizeCode: size.code, board: board.id, print: print.id, quantity }
    : null;
}

/**
 * The API's default first, then the nearest presets: the same shape at each other quantity, then
 * each other shape on its opening choices — never a selection the presets do not offer.
 */
export function candidates(first: HeroSelection | null, shapes: HeroShapePreset[]): HeroSelection[] {
  const start = first ?? (shapes[0] ? openingOf(shapes[0]) : null);
  if (!start) return [];
  const own = shapes.find((shape) => shape.id === start.shape);
  const list: HeroSelection[] = [
    start,
    ...(own?.quantities.filter((q) => q !== start.quantity).map((quantity) => ({ ...start, quantity })) ?? []),
    ...shapes.filter((shape) => shape.id !== start.shape).flatMap((shape) => openingOf(shape) ?? []),
  ];
  const key = (s: HeroSelection) => `${s.shape}|${s.sizeCode}|${s.board}|${s.print}|${s.quantity}`;
  return list.filter((s, i) => list.findIndex((o) => key(o) === key(s)) === i);
}

/**
 * The selection after the customer picks `next` for one axis: a choice the (new) shape does not
 * offer falls to that shape's own first one, so the panel never asks for an unoffered preset.
 */
export function reconcile(selection: HeroSelection, shapes: HeroShapePreset[]): HeroSelection {
  const shape = shapes.find((s) => s.id === selection.shape) ?? shapes[0];
  if (!shape) return selection;
  const opening = openingOf(shape);
  return {
    shape: shape.id,
    sizeCode: shape.sizes.some((s) => s.code === selection.sizeCode) ? selection.sizeCode : opening!.sizeCode,
    board: shape.boards.some((b) => b.id === selection.board) ? selection.board : opening!.board,
    print: shape.prints.some((p) => p.id === selection.print) ? selection.print : opening!.print,
    quantity: shape.quantities.includes(selection.quantity) ? selection.quantity : opening!.quantity,
  };
}
