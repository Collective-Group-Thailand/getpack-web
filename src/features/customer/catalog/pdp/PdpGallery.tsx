"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { isoBox, MATERIAL_TINT } from "@/features/customer/home/iso-box";
import { useFormat } from "@/features/shared/format/useFormat";
import { cn } from "@/ui/lib/cn";

import { useOptionalPdp } from "./PdpProvider";

/** A dimension's label on the "ขนาดจริง" drawing (prototype `.dimlab`). */
const DIM =
  "bg-surface border-border text-fg rounded-sm absolute border px-2 py-0.5 text-[0.8125rem] font-semibold tabular-nums";

export interface PdpPhoto {
  src: string;
  thumb: string;
  alt: string;
}

/** The selected standard size drawn as a box (inside size), for the "ขนาดจริง" view. */
function SizeFigure({
  l,
  w,
  h,
  label,
  compact = false,
}: {
  l: number;
  w: number;
  h: number;
  label?: string;
  compact?: boolean;
}) {
  const box = isoBox({ w: l, d: w, h }, "mailer", MATERIAL_TINT.corrE, "none");
  return (
    <svg
      viewBox="-175 -150 350 300"
      className={cn("h-auto w-full", compact ? "max-w-[80%]" : "max-w-[68%]")}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <ellipse {...box.shadow} fill="rgb(60 40 20 / 0.16)" />
      {box.faces.map((face, index) => (
        <path key={index} d={face.d} fill={face.fill} />
      ))}
      <path d={box.seam} fill="none" stroke="rgb(70 45 20 / 0.5)" strokeWidth={1.4} />
      <g fill="none" stroke="rgb(60 40 20 / 0.3)" strokeWidth={1}>
        {box.outlines.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
    </svg>
  );
}

/**
 * The product page's pictures (pdp redesign item 2): the product's real photos — or, with none yet,
 * its own dieline drawing (`fallback`, rendered on the server) — and "ขนาดจริง": the standard size
 * chosen in the buy box drawn as a box with its inside length, width and height. The views are a
 * button group (`aria-pressed`); the frame is square, so nothing is left empty under it, and it
 * sticks beside the buy box from 1040 px.
 */
export function PdpGallery({ photos, fallback }: { photos: readonly PdpPhoto[]; fallback: React.ReactNode }) {
  const t = useTranslations("catalog.pdp.gallery");
  const format = useFormat();
  const pdp = useOptionalPdp();
  const size = pdp?.configurator.standardSizes.find((entry) => entry.code === pdp.selection.standardSizeCode) ?? null;
  const pictures =
    photos.length > 0
      ? photos.map((photo, index) => ({ key: `photo-${index}`, photo }))
      : [{ key: "drawing", photo: null }];
  const views = [...pictures.map((picture) => picture.key), ...(size ? ["size"] : [])];
  const [view, setView] = useState(views[0]!);
  const active = views.includes(view) ? view : views[0]!;
  const mm = (value: number) => format.number(value);

  const main = (() => {
    if (active === "size" && size) {
      return (
        <>
          <SizeFigure
            l={size.lengthMm}
            w={size.widthMm}
            h={size.heightMm}
            label={t("sizeFigure", {
              size: size.code,
              l: mm(size.lengthMm),
              w: mm(size.widthMm),
              h: mm(size.heightMm),
            })}
          />
          <span aria-hidden="true" className={`${DIM} start-[14%] bottom-[22%]`}>
            {t("length", { mm: mm(size.lengthMm) })}
          </span>
          <span aria-hidden="true" className={`${DIM} end-[12%] bottom-[26%]`}>
            {t("width", { mm: mm(size.widthMm) })}
          </span>
          <span aria-hidden="true" className={`${DIM} end-[8%] top-[34%]`}>
            {t("height", { mm: mm(size.heightMm) })}
          </span>
          <span className="text-muted absolute start-4 bottom-3.5 text-[0.78125rem]">
            {t("sizeCaption", { size: size.code })}
          </span>
        </>
      );
    }
    const picture = pictures.find((entry) => entry.key === active)?.photo ?? null;
    if (!picture) return <div className="absolute inset-0 [&>figure]:h-full [&>figure]:border-0">{fallback}</div>;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- API-origin image, see ProductCard
      <img
        src={picture.src}
        alt={picture.alt}
        width={900}
        height={900}
        fetchPriority={active === views[0] ? "high" : "auto"}
        className="absolute inset-0 size-full object-cover"
      />
    );
  })();

  return (
    <div className="flex flex-col gap-2.5 min-[1040px]:sticky min-[1040px]:top-[calc(var(--site-sticky-top)+1.25rem)]">
      <div className="bg-bg-subtle rounded-panel relative grid aspect-square place-items-center overflow-hidden">
        {main}
      </div>
      {views.length > 1 ? (
        <div role="group" aria-label={t("views")} className="grid grid-cols-4 gap-2.5">
          {views.map((key, index) => {
            const picture = pictures.find((entry) => entry.key === key)?.photo ?? null;
            const label =
              key === "size"
                ? t("size")
                : picture
                  ? t("photo", { index: index + 1, count: pictures.length })
                  : t("drawing");
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active === key}
                aria-label={label}
                title={label}
                onClick={() => setView(key)}
                className={cn(
                  "bg-bg-subtle rounded-card border-border focus-visible:ring-focus-ring relative grid aspect-square place-items-center overflow-hidden border outline-none focus-visible:ring-2",
                  "aria-pressed:border-primary aria-pressed:ring-primary aria-pressed:ring-1 aria-pressed:ring-inset",
                )}
              >
                {key === "size" && size ? (
                  <>
                    <SizeFigure l={size.lengthMm} w={size.widthMm} h={size.heightMm} compact />
                    <span className="text-muted absolute inset-x-0 bottom-1.5 text-center text-[0.6875rem] font-medium">
                      {t("size")}
                    </span>
                  </>
                ) : picture ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API-origin image, see ProductCard
                  <img src={picture.thumb} alt="" width={160} height={160} className="size-full object-cover" />
                ) : (
                  <span className="pointer-events-none absolute inset-0 [&_figcaption]:hidden [&>figure]:h-full [&>figure]:border-0">
                    {fallback}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
