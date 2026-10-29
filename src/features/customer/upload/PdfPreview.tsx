"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/ui/components/Spinner";
import { cn } from "@/ui/lib/cn";

import type { FileCheckItem } from "./api";
import { boxPosition, markerPosition } from "./markers";

/** What the preview draws from: the customer's own file still in the browser, or a signed URL of it. */
export type PreviewSource = { kind: "file"; file: File } | { kind: "url"; load: () => Promise<string> } | null;

export interface MarkedItem {
  item: FileCheckItem;
  /** 1-based number shown on the marker and on the item. */
  n: number;
}

/**
 * The first page of the customer's own PDF, rendered in the browser with pdf.js (lazy, only on this page) — the
 * file's real artwork, never a sample — with a numbered marker per check that has a position (API `at`, page
 * points) and the die box outlined. A marker and its item select each other. A file pdf.js cannot open (an old
 * PostScript AI) shows the sheet outline only; the API still checks what it can and the team checks the rest.
 */
export function PdfPreview({
  source,
  mediaBox,
  dieBox,
  marked,
  selected,
  onSelect,
  label,
}: {
  source: PreviewSource;
  mediaBox: readonly number[] | null;
  dieBox: readonly number[] | null;
  marked: MarkedItem[];
  selected: string | null;
  onSelect: (check: string) => void;
  label: string;
}) {
  const t = useTranslations("studio.upload.preview");
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{ for: PreviewSource; status: "ready" | "failed"; ratio: number | null } | null>(
    null,
  );
  const state = !source ? "idle" : result?.for === source ? result.status : "loading";
  const ratio = result?.for === source ? result.ratio : null;

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const data =
          source.kind === "file"
            ? new Uint8Array(await source.file.arrayBuffer())
            : new Uint8Array(await (await fetch(await source.load())).arrayBuffer());
        const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        const page = await doc.getPage(1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const width = Math.max(320, frame.current?.clientWidth ?? 900);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (width / base.width) * dpr });
        const target = canvas.current;
        if (!target) return;
        target.width = Math.round(viewport.width);
        target.height = Math.round(viewport.height);
        await page.render({ canvas: target, viewport }).promise;
        if (cancelled) return;
        setResult({ for: source, status: "ready", ratio: base.height / base.width });
        void doc.destroy();
      } catch {
        if (!cancelled) setResult({ for: source, status: "failed", ratio: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  const die = boxPosition(dieBox, mediaBox);
  const fallbackRatio =
    mediaBox && mediaBox.length === 4 ? (mediaBox[3]! - mediaBox[1]!) / Math.max(1, mediaBox[2]! - mediaBox[0]!) : 0.45;

  return (
    <figure className="m-0">
      <div
        ref={frame}
        className="relative mx-auto w-full"
        // At most 26 rem tall, as the prototype's preview.
        style={{
          aspectRatio: `1 / ${ratio ?? fallbackRatio}`,
          maxWidth: `${26 / Math.max(ratio ?? fallbackRatio, 0.05)}rem`,
        }}
        // Its markers are buttons, so it is a named group rather than an image (axe nested-interactive).
        role="group"
        aria-label={label}
      >
        <canvas
          ref={canvas}
          className={cn("absolute inset-0 size-full bg-white", state === "ready" ? "opacity-100" : "opacity-0")}
          aria-hidden="true"
        />
        {state !== "ready" ? (
          <div className="border-border text-muted absolute inset-0 grid place-items-center border border-dashed text-sm">
            {state === "loading" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} label={null} />
                {t("rendering")}
              </span>
            ) : state === "failed" ? (
              <span className="max-w-[32ch] px-4 text-center">{t("failed")}</span>
            ) : null}
          </div>
        ) : null}
        {die ? (
          <span
            aria-hidden="true"
            className="border-danger/70 pointer-events-none absolute border border-dashed"
            style={{ left: `${die.left}%`, top: `${die.top}%`, width: `${die.width}%`, height: `${die.height}%` }}
          />
        ) : null}
        {marked.map(({ item, n }) => {
          const at = markerPosition(item.at, mediaBox);
          if (!at) return null;
          const on = selected === item.check;
          return (
            <button
              key={item.check}
              type="button"
              onClick={() => onSelect(item.check)}
              aria-pressed={on}
              aria-label={t("marker", { n })}
              className={cn(
                "focus-visible:ring-focus-ring absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-xs font-bold text-white tabular-nums outline-none focus-visible:ring-2",
                item.level === "must_fix" ? "bg-danger" : "bg-warning",
                on && "ring-info ring-2 ring-offset-2",
              )}
              style={{ left: `${at.left}%`, top: `${at.top}%` }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </figure>
  );
}
