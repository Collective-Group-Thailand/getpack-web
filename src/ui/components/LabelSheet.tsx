import { cn } from "../lib/cn";

/** Label stock the partner zone prints on: 100 × 150 mm, or the US 4 × 6 inch roll. */
export const LABEL_SIZES = {
  "100x150": { width: "100mm", height: "150mm" },
  "4x6": { width: "4in", height: "6in" },
} as const;
export type LabelSize = keyof typeof LABEL_SIZES;

/** One label per page of the chosen stock, nothing else of the app printed with it. */
const printCss = (size: LabelSize) => `
@page { size: ${LABEL_SIZES[size].width} ${LABEL_SIZES[size].height}; margin: 0; }
@media print {
  body * { visibility: hidden !important; }
  .label-sheet, .label-sheet * { visibility: visible !important; }
  .label-sheet { position: absolute; inset: 0; gap: 0 !important; }
  .label-page { box-shadow: none !important; border: 0 !important; break-after: page; }
}
`;

export interface LabelSheetProps {
  /** One element per label: each prints on its own 100 × 150 mm page. */
  labels: readonly React.ReactNode[];
  /** Accessible name of the preview. */
  label: string;
  /** The label stock; 100 × 150 mm unless the device is set to another. */
  size?: LabelSize;
  className?: string;
}

/**
 * Carton labels for a thermal label printer (design-system.md §3 "LabelPrintLayout (100×150
 * mm)"). On screen the labels are a preview column at true proportions; printed, every label is
 * its own 100 × 150 mm page with no margin and nothing else of the app on it — the stylesheet
 * hides the rest of the page while this sheet is in it.
 */
export function LabelSheet({ labels, label, size = "100x150", className }: LabelSheetProps) {
  return (
    <section aria-label={label} className={cn("label-sheet flex flex-col items-center gap-4", className)}>
      <style>{printCss(size)}</style>
      {labels.map((content, index) => (
        <div
          key={index}
          style={{ width: LABEL_SIZES[size].width, height: LABEL_SIZES[size].height }}
          className="label-page border-border flex max-w-full flex-col overflow-hidden border bg-white p-[5mm] text-black shadow-sm"
        >
          {content}
        </div>
      ))}
    </section>
  );
}
