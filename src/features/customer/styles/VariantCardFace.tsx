import type { StyleVariantCard } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { ProductCard } from "@/ui/components/ProductCard";

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
}: {
  card: StyleVariantCard;
  words: VariantCardWords;
  priority?: boolean;
}) {
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
