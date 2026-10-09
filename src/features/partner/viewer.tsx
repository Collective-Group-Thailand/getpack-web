"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";
import { MediaViewer, type MediaItem, type MediaViewerLabels } from "@/ui/components/MediaViewer";

/** The viewer's words, from `partner.viewer`. */
export function useViewerLabels(): MediaViewerLabels {
  const t = useTranslations("partner.viewer");
  return {
    close: t("close"),
    previous: t("previous"),
    next: t("next"),
    openNew: t("openNew"),
    zoomIn: t("zoomIn"),
    zoomOut: t("zoomOut"),
    failed: t("failed"),
  };
}

/** A signed URL for a file the API names by id, asked for when it is shown (five minutes). */
export const signedUrl = async (fileId: string) =>
  (await browserApi().GET("/v1/partner/files/{fileId}/download", { params: { path: { fileId } } })).data!.url;

/**
 * Photos as a grid of thumbnails; a tap opens them full screen (arrows move through the set).
 * Items carry a URL in hand (a page that signed them) or a file id (signed here, once, on mount).
 */
export function PhotoGrid({
  items,
  className,
}: {
  items: { title: string; src?: string; fileId?: string }[];
  className?: string;
}) {
  const labels = useViewerLabels();
  const [index, setIndex] = useState<number | null>(null);
  const [urls, setUrls] = useState<(string | null)[]>(() => items.map((item) => item.src ?? null));
  // A thumbnail that does not load shows the photo icon, not the browser's broken-image glyph.
  const [broken, setBroken] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    let live = true;
    items.forEach((item, at) => {
      if (item.src || !item.fileId) return;
      signedUrl(item.fileId).then(
        (url) => live && setUrls((all) => all.map((value, i) => (i === at ? url : value))),
        () => undefined,
      );
    });
    return () => {
      live = false;
    };
  }, [items]);
  const media: MediaItem[] = items.map((item, at) => ({
    title: item.title,
    src: urls[at] ?? undefined,
    resolve: item.fileId ? () => signedUrl(item.fileId!) : undefined,
  }));
  return (
    <>
      <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6", className)}>
        {items.map((item, at) => (
          <li key={item.fileId ?? item.src ?? at}>
            <button
              type="button"
              onClick={() => setIndex(at)}
              aria-label={item.title}
              className="border-border bg-surface-subtle hover:border-border-strong group relative block aspect-square w-full overflow-hidden rounded-lg border"
            >
              {urls[at] && !broken.has(at) ? (
                // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL
                <img
                  src={urls[at]!}
                  alt=""
                  onError={() => setBroken((all) => new Set(all).add(at))}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Icon name="image" size={24} className="text-muted absolute inset-0 m-auto" />
              )}
              <span className="bg-surface/90 text-fg absolute end-1 bottom-1 hidden size-7 items-center justify-center rounded-md group-hover:flex">
                <Icon name="search" size={14} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <MediaViewer
        items={media}
        index={index}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
        labels={labels}
      />
    </>
  );
}

/** A document or file link that opens in the full-screen viewer (a PDF in the browser's own viewer). */
export function ViewFile({
  title,
  src,
  fileId,
  icon = "document",
  className,
  children,
}: {
  title: string;
  src?: string;
  fileId?: string;
  icon?: IconName;
  className?: string;
  children: React.ReactNode;
}) {
  const labels = useViewerLabels();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("text-primary inline-flex min-h-11 items-center gap-1.5 underline md:min-h-10", className)}
      >
        <Icon name={icon} size={16} aria-hidden="true" />
        {children}
      </button>
      <MediaViewer
        items={[{ title, src, resolve: fileId ? () => signedUrl(fileId) : undefined }]}
        index={open ? 0 : null}
        onIndexChange={() => undefined}
        onClose={() => setOpen(false)}
        labels={labels}
      />
    </>
  );
}
