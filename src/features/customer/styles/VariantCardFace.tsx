import type { StyleVariantCard } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { CardImage } from "@/ui/components/CardImage";
import { ProductCard } from "@/ui/components/ProductCard";
import { LINE_PLATE, ProductIllustration } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";

import { illustrationOf } from "./illustration";
import { axisLabel, valueLabel, type StylesT } from "./labels";
import { previewSrc, styleHref } from "./paths";

/** Axes too fine to name on a card (the joint, a tuck's corner): they stay on the style page. */
const QUIET_AXES = new Set(["joint", "tuck_corner"]);

export interface VariantCardWords {
  name: string;
  category: string;
  pricePath: string;
  /** "ฝาบน ฝาเสียบสลับ · ก้นกล่อง ก้นล็อกอัตโนมัติ · หน้าต่าง ด้านหน้า". */
  summary: string;
  alt: string;
}

/** Where a variant card goes: its style's page with that variant chosen (D-410 — never a page of its own). */
export const variantHref = (card: StyleVariantCard, name: string) =>
  `${styleHref(card.baseCode, name)}?v=${encodeURIComponent(card.code)}`;

/**
 * One variant in the "every variant" grid (D-410): its style's name, its own code and the options
 * that make it, instant price or quotation, and the API's rendered thumbnail (or the family's line
 * drawing). The whole card opens the style with this variant chosen.
 */
export function VariantCardFace({
  card,
  words,
  priority = false,
  layout = "card",
}: {
  card: StyleVariantCard;
  words: VariantCardWords;
  priority?: boolean;
  /**
   * `row`: one line of a list (Project A, a style's feature page) — a small drawing, the code and name, the options
   * as chips and the way to a price, the whole row one link — instead of a grid of near-identical pictures.
   */
  layout?: "card" | "row";
}) {
  if (layout === "row") {
    const photo = storeImageSrc(card.thumbnailUrl, "thumb");
    const drawing = (
      <span className={`${LINE_PLATE} grid size-full place-items-center`} aria-hidden="true">
        <ProductIllustration family={illustrationOf(card)} className="max-w-10" />
      </span>
    );
    const chips = words.summary ? words.summary.split(" · ") : [];
    return (
      <article className="group focus-within:ring-focus-ring hover:bg-surface-subtle relative flex items-start gap-3.5 px-4 py-3.5 focus-within:ring-2 focus-within:ring-inset md:items-center md:px-5">
        <span className="border-border bg-surface-subtle grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border md:size-16">
          <CardImage
            src={photo ?? previewSrc(card.baseCode, card.options)}
            alt=""
            width={128}
            height={128}
            loading={priority ? "eager" : "lazy"}
            className={photo ? "size-full object-cover" : "bg-surface size-full object-contain p-1.5"}
            fallback={drawing}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-muted text-xs">
            {words.category} · <span className="text-fg font-medium tabular-nums">{card.code}</span>
          </p>
          <h3 className="mt-0.5 text-[0.9375rem] leading-snug font-semibold">
            <Link
              href={variantHref(card, words.name)}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {words.name}
            </Link>
          </h3>
          {chips.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={words.summary}>
              {chips.map((chip) => (
                <li key={chip}>
                  <Badge size="sm">{chip}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-2 self-center">
          <Badge tone={card.pricePath === "instant" ? "success" : "info"} className="max-sm:hidden">
            {words.pricePath}
          </Badge>
          <Icon name="chevron-right" size={18} aria-hidden="true" className="text-muted group-hover:text-primary" />
        </span>
      </article>
    );
  }
  return (
    <ProductCard
      as="article"
      priority={priority}
      title={<Link href={variantHref(card, words.name)}>{words.name}</Link>}
      topLine={
        <>
          {words.category} · <span className="tabular-nums">{card.code}</span>
        </>
      }
      image={
        // The API's picture: a public photo path (`/v1/store/…`, through the BFF) or a signed thumbnail URL.
        storeImageSrc(card.thumbnailUrl, "thumb")
          ? { src: storeImageSrc(card.thumbnailUrl, "thumb")!, alt: words.alt }
          : { src: previewSrc(card.baseCode, card.options), alt: words.alt, fit: "contain" }
      }
      fallback={{ family: illustrationOf(card) }}
      meta={words.summary}
      badges={<Badge tone={card.pricePath === "instant" ? "success" : "info"}>{words.pricePath}</Badge>}
    />
  );
}

/** A variant's options in words, `none` and the quiet axes left out. */
export function optionSummary(t: StylesT, options: Record<string, unknown>): string {
  return Object.entries(options)
    .filter(([axis]) => !QUIET_AXES.has(axis))
    .flatMap(([axis, value]) => {
      const values = (Array.isArray(value) ? value : [value]).map(String).filter((v) => v && v !== "none");
      return values.length ? [`${axisLabel(t, axis)} ${values.map((v) => valueLabel(t, axis, v)).join(" + ")}`] : [];
    })
    .join(" · ");
}

/** The words of a variant card, from a `styles` translator (server or browser alike). */
export function variantWords(card: StyleVariantCard, locale: string, t: StylesT): VariantCardWords {
  const name = locale === "en" ? card.nameEn || card.nameTh : card.nameTh || card.nameEn;
  return {
    name,
    category: t.has(`categories.${card.category}`) ? t(`categories.${card.category}`) : card.category,
    pricePath: t(`pricePaths.${card.pricePath}`),
    summary: optionSummary(t, card.options),
    alt: t("detail.thumbnailAlt", { name, code: card.code }),
  };
}
