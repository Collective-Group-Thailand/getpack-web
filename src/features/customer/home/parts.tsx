import type { StyleCard } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { styleHref } from "@/features/customer/styles/paths";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/lib/cn";

import type { HomePhoto } from "./content.server";
import { DielineGlyph } from "./DielineGlyph";

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

/** One template: its picture well (a CMS photo, or the family's outline), the dieline tile, its name. */
export function TemplateCard({
  style,
  locale,
  photo,
  meta,
  action,
  big = false,
}: {
  style: StyleCard;
  locale: string;
  photo: HomePhoto | null;
  meta: string;
  action?: string;
  big?: boolean;
}) {
  const name = pick(locale, style.nameTh, style.nameEn);
  return (
    <li className={cn(big && "sm:col-span-2 sm:row-span-2")}>
      <Link href={styleHref(style.code, name)} className="group block outline-none">
        <figure className={cn("bg-sage-subtle relative overflow-hidden", big ? "aspect-square" : "aspect-[4/3]")}>
          {photo ? (
            <Photo photo={{ ...photo, alt: "" }} />
          ) : (
            <span className="grid size-full place-items-center p-8">
              <DielineGlyph family={style.family} className="w-1/2 max-w-56" />
            </span>
          )}
          <span className="border-border bg-surface rounded-thumb absolute start-2.5 top-2.5 h-[46px] w-16 border p-1">
            <DielineGlyph family={style.family} className="size-full" />
          </span>
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
