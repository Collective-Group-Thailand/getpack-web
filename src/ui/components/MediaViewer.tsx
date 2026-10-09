"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { IconButton } from "./IconButton";
import { Spinner } from "./Spinner";

export interface MediaItem {
  /** Shown in the bar and as the image's alt text. */
  title: string;
  /** A URL in hand, or a way to get one when the item is shown (a short-lived signed URL). */
  src?: string;
  resolve?: () => Promise<string>;
}

export interface MediaViewerLabels {
  close: string;
  previous: string;
  next: string;
  openNew: string;
  zoomIn: string;
  zoomOut: string;
  /** "{n} / {total}" already formatted by the caller is not needed: the viewer joins them. */
  failed: string;
}

type Kind = "image" | "pdf" | "unknown";

const IMAGE = /\.(jpe?g|png|webp|gif|avif|heic|bmp)$/i;
const kindOf = (url: string): Kind => {
  const path = (() => {
    try {
      return new URL(url, "http://x").pathname;
    } catch {
      return url;
    }
  })();
  if (IMAGE.test(path)) return "image";
  if (/\.pdf$/i.test(path)) return "pdf";
  return "unknown";
};

/**
 * Photos and documents full screen: a claim's photos, a step's evidence, a proof of delivery, a
 * tax invoice. Tap a thumbnail or a file and it fills the screen; arrows (or ← →) move through the
 * set, a tap on a photo zooms it to its real size, Escape closes and focus returns where it was.
 * A PDF opens in the browser's own viewer inside the frame; anything else offers "open in a new tab".
 */
export function MediaViewer({
  items,
  index,
  onIndexChange,
  onClose,
  labels,
}: {
  items: MediaItem[];
  /** The item shown, or `null` when closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  labels: MediaViewerLabels;
}) {
  const open = index !== null;
  const item = open ? items[index] : undefined;
  const step = useCallback(
    (by: 1 | -1) => {
      if (index === null || items.length < 2) return;
      onIndexChange((index + by + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="z-overlay fixed inset-0 bg-black/90" />
        <DialogPrimitive.Content
          className="z-modal fixed inset-0 flex flex-col bg-black/95 text-white outline-none"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") step(1);
            if (event.key === "ArrowLeft") step(-1);
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-base font-medium">
              {item?.title}
              {items.length > 1 && index !== null ? (
                <span className="ms-2 text-sm font-normal text-white/70">
                  {index + 1} / {items.length}
                </span>
              ) : null}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{item?.title}</DialogPrimitive.Description>
            <DialogPrimitive.Close asChild>
              <IconButton name="close" label={labels.close} size="sm" className="text-white hover:bg-white/10" />
            </DialogPrimitive.Close>
          </div>

          <div className="relative min-h-0 flex-1">
            {item ? <Stage key={index} item={item} labels={labels} /> : null}
            {items.length > 1 ? (
              <>
                <IconButton
                  name="chevron-left"
                  label={labels.previous}
                  className="absolute start-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                  onClick={() => step(-1)}
                />
                <IconButton
                  name="chevron-right"
                  label={labels.next}
                  className="absolute end-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                  onClick={() => step(1)}
                />
              </>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** One item, keyed by its place in the set, so its loading and zoom state start fresh each time. */
function Stage({ item, labels }: { item: MediaItem; labels: MediaViewerLabels }) {
  // A URL in hand wins; otherwise the one resolved on mount (a signed URL asked for when shown).
  const [resolved, setResolved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);
  const url = item.src ?? resolved;
  const kind = url ? kindOf(url) : "unknown";
  const resolve = item.src ? undefined : item.resolve;

  useEffect(() => {
    if (!resolve) return;
    let live = true;
    resolve().then(
      (value) => live && setResolved(value),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
    // Resolved once per item shown (the stage is keyed by the item's place in the set).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(resolve)]);

  return (
    <div className="flex h-full flex-col">
      {url ? (
        <div className="absolute end-14 -top-11 flex items-center gap-1 sm:end-16">
          {kind !== "pdf" && !failed ? (
            <IconButton
              name={zoom ? "minus" : "plus"}
              label={zoom ? labels.zoomOut : labels.zoomIn}
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={() => setZoom((value) => !value)}
            />
          ) : null}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={labels.openNew}
            title={labels.openNew}
            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-white/10"
          >
            <Icon name="external" size={18} />
          </a>
        </div>
      ) : null}
      <div className={cn("min-h-0 flex-1", zoom ? "overflow-auto" : "overflow-hidden")}>
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white/80">
            <Icon name="document" size={40} aria-hidden="true" />
            <p className="max-w-sm">{labels.failed}</p>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/40 px-4 text-white hover:bg-white/10"
              >
                <Icon name="external" size={16} aria-hidden="true" />
                {labels.openNew}
              </a>
            ) : null}
          </div>
        ) : !url ? (
          <div className="grid h-full place-items-center">
            <Spinner size={28} label={null} />
          </div>
        ) : kind === "pdf" ? (
          <iframe src={url} title={item.title} className="h-full w-full bg-white" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL, not an optimisable asset
          <img
            src={url}
            alt={item.title}
            onClick={() => setZoom((value) => !value)}
            onError={() => setFailed(true)}
            className={cn(
              "mx-auto select-none",
              zoom ? "max-w-none cursor-zoom-out" : "h-full w-full cursor-zoom-in object-contain p-2 sm:p-4",
            )}
          />
        )}
      </div>
    </div>
  );
}
