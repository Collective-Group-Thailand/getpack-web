/*
 * Where the sheet fits on the Studio stage (C8 Phase 1 item 2): the stage less its insets (the toolbox, the rulers,
 * the view bar) and, when the 3D card floats in the top-right corner, either below it or beside it — whichever
 * shows the sheet larger, so the card never covers the sheet at fit.
 */

/** The fit's candidate areas: the view less its insets, and — with the 3D card — below it or beside it. */
export function fitAreas(
  width: number,
  height: number,
  insets: { top: number; right: number; bottom: number; left: number },
  pip: { width: number; height: number; top: number; right: number } | null,
  pad: number,
): { x: number; y: number; width: number; height: number }[] {
  const base = {
    x: insets.left + pad,
    y: insets.top + pad,
    width: width - insets.left - insets.right - 2 * pad,
    height: height - insets.top - insets.bottom - 2 * pad,
  };
  if (!pip) return [base];
  const below = Math.max(base.y, pip.top + pip.height + pad);
  const besideRight = Math.min(base.x + base.width, width - pip.right - pip.width - pad);
  return [
    { ...base, y: below, height: base.y + base.height - below },
    { ...base, width: besideRight - base.x },
  ].filter((a) => a.width > 40 && a.height > 40);
}
