import { cn } from "../lib/cn";

/** One label per 100 × 150 mm page, nothing else of the app printed with it. */
const PRINT_CSS = `
@page { size: 100mm 150mm; margin: 0; }
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
  className?: string;
}

/**
 * Carton labels for a thermal label printer (design-system.md §3 "LabelPrintLayout (100×150
 * mm)"). On screen the labels are a preview column at true proportions; printed, every label is
 * its own 100 × 150 mm page with no margin and nothing else of the app on it — the stylesheet
 * hides the rest of the page while this sheet is in it.
 */
export function LabelSheet({ labels, label, className }: LabelSheetProps) {
  return (
    <section aria-label={label} className={cn("label-sheet flex flex-col items-center gap-4", className)}>
      <style>{PRINT_CSS}</style>
      {labels.map((content, index) => (
        <div
          key={index}
          className="label-page border-border flex h-[150mm] w-[100mm] max-w-full flex-col overflow-hidden border bg-white p-[5mm] text-black shadow-sm"
        >
          {content}
        </div>
      ))}
    </section>
  );
}
