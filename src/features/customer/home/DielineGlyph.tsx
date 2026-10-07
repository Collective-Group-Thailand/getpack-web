/**
 * A style family's flat outline, small (Phase 4 template cards: 64 × 46 in its white tile, or large
 * in a card's well when there is no photo). Cut lines solid, folds dashed, in the print-mark
 * colours the studio uses — Packio's own drawings, decorative (`aria-hidden`).
 */
const CUT = "var(--color-print-cut)";
const FOLD = "var(--color-print-fold)";

const OUTLINES: Record<string, { cut: string; fold: string }> = {
  lid: { cut: "M6 10h48v20H6z M18 10V4h24v6 M18 30v6h24v-6", fold: "M18 10v20 M42 10v20" },
  mailer: {
    cut: "M4 12h52v16H4z M14 12V5h12v7 M34 12V5h12v7 M14 28v7h12v-7 M34 28v7h12v-7",
    fold: "M14 12v16 M26 12v16 M34 12v16 M46 12v16",
  },
  tuck: { cut: "M8 12h44v16H8z M19 12V6q5-2 11 0v6 M19 28v6q5 2 11 0v-6", fold: "M19 12v16 M30 12v16 M41 12v16" },
  bag: { cut: "M6 8h48v26H6z M6 30h48", fold: "M18 8v26 M30 8v26 M42 8v26" },
  pouch: { cut: "M10 6h40v30H10z M10 12h40", fold: "M20 6v30 M40 6v30" },
  label: { cut: "M6 6h48v28H6z", fold: "M12 12h36 M12 18h36 M12 24h36" },
  sleeve: { cut: "M8 14h44v12H8z M8 14V8h44v6 M8 26v6h44v-6", fold: "M22 14v12 M38 14v12" },
  tray: { cut: "M14 10h32v20H14z M14 10l-8-4v28l8-4 M46 10l8-4v28l-8-4", fold: "M14 10v20 M46 10v20" },
  display: { cut: "M10 14h40v18H10z M10 14V4h40v10", fold: "M10 14h40 M22 14v18 M38 14v18" },
};

/** The engine's and the catalogue's family names, to one of the outlines above. */
const FAMILY: Record<string, keyof typeof OUTLINES> = {
  tuck_end: "tuck",
  reverse_tuck: "tuck",
  flip_top: "tuck",
  tuck: "tuck",
  mailer: "mailer",
  rsc: "mailer",
  shipping: "mailer",
  corrugated: "mailer",
  tray: "tray",
  lid: "lid",
  telescope: "lid",
  rigid: "lid",
  display: "display",
  sleeve: "sleeve",
  tag_sleeve: "sleeve",
  bag: "bag",
  paper_bag: "bag",
  pouch: "pouch",
  flexible: "pouch",
  label: "label",
  insert: "label",
};

export function DielineGlyph({ family, className }: { family: string; className?: string }) {
  const outline = OUTLINES[FAMILY[family] ?? "tuck"]!;
  return (
    <svg viewBox="0 0 60 40" aria-hidden="true" className={className}>
      <path d={outline.cut} fill="none" stroke={CUT} strokeWidth={1} />
      <path d={outline.fold} fill="none" stroke={FOLD} strokeWidth={1} strokeDasharray="2 2" />
    </svg>
  );
}
