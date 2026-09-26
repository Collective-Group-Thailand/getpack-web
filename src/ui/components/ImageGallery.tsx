"use client";

import { useState } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface ImageGalleryProps {
  images: readonly GalleryImage[];
  labels: {
    /** Accessible name of the thumbnail group, e.g. "รูปสินค้า". */
    thumbnails: string;
    /** "รูปที่ 2 จาก 5". */
    show: (index: number, count: number) => string;
    /** Shown when there are no images at all. */
    empty: string;
  };
  className?: string;
}

/**
 * A product's pictures: one large, the rest as thumbnails that swap it.
 *
 * Thumbnails are buttons with `aria-pressed`, so the selected one is announced and every one is
 * reachable by keyboard; the large image is the first one server-rendered, eager and high
 * priority, because on a product page it is the LCP element. No swiping library, no lightbox —
 * both cost more JavaScript than the product page's budget has (150 KB).
 */
export function ImageGallery({ images, labels, className }: ImageGalleryProps) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  if (!current) {
    return (
      <div
        className={cn(
          "bg-bg-subtle text-subtle flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl",
          className,
        )}
      >
        <Icon name="box" size={64} aria-hidden="true" />
        <p className="text-muted text-sm">{labels.empty}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="bg-bg-subtle aspect-[4/3] overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- API-origin image, see ProductCard */}
        <img
          src={current.src}
          alt={current.alt}
          width={800}
          height={600}
          fetchPriority={index === 0 ? "high" : "auto"}
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
      {images.length > 1 ? (
        <ul aria-label={labels.thumbnails} className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, position) => (
            <li key={`${image.src}-${position}`} className="shrink-0">
              <button
                type="button"
                aria-pressed={position === index}
                aria-label={labels.show(position + 1, images.length)}
                onClick={() => setIndex(position)}
                className={cn(
                  "focus-visible:ring-focus-ring block size-16 overflow-hidden rounded-lg border-2 outline-none focus-visible:ring-2",
                  position === index ? "border-primary" : "border-transparent opacity-80 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative, the button carries the name */}
                <img src={image.src} alt="" width={64} height={64} loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
