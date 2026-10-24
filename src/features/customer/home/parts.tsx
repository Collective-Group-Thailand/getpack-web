import type { StyleCard } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { styleHref } from "@/features/customer/styles/paths";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/lib/cn";

import type { HomePhoto } from "./content.server";
import type { StyleDieline } from "./style-dielines.server";

/**
 * Pieces the home page shares with the studio's front door, kept apart from `HomeSections` so a
 * page that uses them does not also ship the hero panel's client code.
 */
export const HOME_WRAP = "mx-auto w-full max-w-[82.5rem] px-5 md:px-8 xl:px-12";
export const UNDERLINE = "border-b border-current pb-px font-medium";

/** A CMS photo (API origin, so a plain `img`), covering its frame. */
export function Photo({ photo, className, eager = false }: { photo: HomePhoto; className?: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- API-origin image (see ProductCard)
    <img
      src={photo.src}
      alt={photo.alt}
      width={800}
      height={600}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn("block size-full object-cover", className)}
    />
  );
}

/**
 * The style library's own photo of the style (D-426, `style_bases.photo_file_id`), for a card the CMS gives no
 * photo: full size on the big card, the worker's WebP thumbnail on the others.
 */
export function stylePhoto(style: StyleCard, locale: string, big = false): HomePhoto | null {
  const src = storeImageSrc(style.photo?.url, big ? "full" : "thumb");
  if (!style.photo || !src) return null;
  return { src, alt: pick(locale, style.photo.alt.th, style.photo.alt.en), caption: null };
}

/**
 * One template: its picture well, the dieline tile, its name. The picture is the CMS photo set for the card,
 * else the style's own photo, else the style's dieline on the sage ground.
 */
export function TemplateCard({
  style,
  locale,
  photo,
  dieline,
  meta,
  action,
  big = false,
  narrow = false,
}: {
  style: StyleCard;
  locale: string;
  photo: HomePhoto | null;
  /** The style's own dieline from its recipe (`style-dielines.server.ts`), for the card and its corner. */
  dieline: { card: StyleDieline | null; thumb: StyleDieline | null };
  meta: string;
  action?: string;
  big?: boolean;
  /** A narrow column (the `/studio` row): 8px more top inset for the drawing. */
  narrow?: boolean;
}) {
  const name = pick(locale, style.nameTh, style.nameEn);
  const picture = photo ?? stylePhoto(style, locale, big);
  return (
    <li className={cn(big && "sm:col-span-2 sm:row-span-2")}>
      <Link href={styleHref(style.code, name)} className="group block outline-none">
        <figure className={cn("bg-sage-subtle relative overflow-hidden", big ? "aspect-square" : "aspect-[4/3]")}>
          {picture ? (
            <Photo photo={{ ...picture, alt: "" }} />
          ) : dieline.card ? (
            // Until the style has a photo, its dieline fills the card on the sage ground.
            // eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URI, nothing to optimise
            <img
              src={dieline.card.src}
              alt=""
              className={cn(
                "size-full object-contain",
                big ? "p-6" : narrow ? "p-[10%] pt-[calc(18%_+_8px)]" : "p-[10%] pt-[18%]",
              )}
            />
          ) : null}
          {/* The corner thumbnail names the shape over a photo; over the dieline itself it would repeat it. */}
          {picture && dieline.thumb ? (
            <span className="border-border bg-surface rounded-thumb absolute start-2.5 top-2.5 h-[46px] w-16 border p-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URI */}
              <img src={dieline.thumb.src} alt="" className="size-full object-contain" />
            </span>
          ) : null}
        </figure>
        <span className="block pt-2.5">
          <b className={cn("block font-semibold", big ? "text-xl" : "text-[0.9375rem]")}>{name}</b>
          <small className="text-muted mt-0.5 block text-[13px]">{meta}</small>
          {action ? (
            <span className={cn("mt-2.5 inline-block text-[0.84375rem] group-focus-visible:ring-2", UNDERLINE)}>
              {action}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
