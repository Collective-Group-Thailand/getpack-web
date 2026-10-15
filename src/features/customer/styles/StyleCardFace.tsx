import type { StyleCard } from "@/features/customer/catalog/api.server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { ProductCard } from "@/ui/components/ProductCard";

import { illustrationOf } from "./illustration";
import { previewSrc, styleHref } from "./paths";
import { topicsOf } from "./topics";

/** How many option chips a card shows before "+N". */
const CHIPS = 3;

/** A card's words, prepared by whoever renders it (the server for the first page, the browser after). */
export interface StyleCardWords {
  name: string;
  category: string;
  price?: string;
  meta: string;
  pricePath: string;
  featured: string;
  /** "60 แบบย่อย" — shown large: the library's depth is the point of the card (D-410). */
  variants: string;
  /** The features it offers ("หน้าต่าง", "หูแขวน", "ก้นล็อก"), the first few, and how many more. */
  chips: string[];
  moreChips: string | null;
  alt: string;
}

/**
 * One style in the library (U3.5 §3, D-410): its code, the verified international code when there
 * is one (D-211), instant price or quotation, the API's "starting from", how many variants it has —
 * prominent — and chips of the features it offers. The picture is the API's rendered thumbnail, or
 * the family's line drawing until there is one. `actions` is the save / compare island.
 */
export function StyleCardFace({
  style,
  words,
  actions,
  priority = false,
  href,
  className,
}: {
  style: StyleCard;
  words: StyleCardWords;
  actions?: React.ReactNode;
  priority?: boolean;
  /** Where the card goes, when not the style's page (a feature page sends it to its own, D-410). */
  href?: string;
  className?: string;
}) {
  return (
    <ProductCard
      as="article"
      className={className}
      priority={priority}
      title={<Link href={href ?? styleHref(style.code, words.name)}>{words.name}</Link>}
      topLine={
        <>
          {words.category} · <span className="font-mono">{style.code}</span>
        </>
      }
      image={
        style.thumbnailUrl
          ? { src: style.thumbnailUrl, alt: words.alt }
          : { src: previewSrc(style.code, {}), alt: words.alt, fit: "contain" }
      }
      fallback={{ family: illustrationOf(style) }}
      price={words.price}
      meta={words.meta || undefined}
      badges={
        <>
          <Badge tone={style.pricePath === "instant" ? "success" : "info"}>{words.pricePath}</Badge>
          {style.featured ? <Badge tone="primary">{words.featured}</Badge> : null}
        </>
      }
      promoBadge={
        style.variantCount > 1 ? (
          <Badge tone="primary" appearance="solid" icon="layers">
            {words.variants}
          </Badge>
        ) : null
      }
      details={
        words.chips.length ? (
          <ul className="flex flex-wrap gap-1" aria-label={words.variants}>
            {words.chips.map((chip) => (
              <li key={chip}>
                <Badge size="sm">{chip}</Badge>
              </li>
            ))}
            {words.moreChips ? (
              <li>
                <Badge size="sm" className="tabular-nums">
                  {words.moreChips}
                </Badge>
              </li>
            ) : null}
          </ul>
        ) : null
      }
      actions={actions}
    />
  );
}

/** The words of a card, from a `styles` translator and a formatter (server or browser alike). */
export function cardWords(
  style: StyleCard,
  locale: string,
  t: { (key: string, values?: Record<string, string | number>): string; has(key: string): boolean },
  format: { thb(amount: string): string; number(n: number): string },
): StyleCardWords {
  const name = locale === "en" ? style.nameEn || style.nameTh : style.nameTh || style.nameEn;
  const chips = topicsOf(style.options ?? []).map((topic) => t(`topics.${topic.id}.chip`));
  return {
    name,
    category: t.has(`categories.${style.category}`) ? t(`categories.${style.category}`) : style.category,
    price: style.startingPrice
      ? `${t("card.from", { price: format.thb(style.startingPrice.unitPrice) })} ${t("card.fromQuantity", {
          quantity: format.number(style.startingPrice.quantity),
        })}`
      : undefined,
    meta: style.referenceCode ? t("card.reference", { code: style.referenceCode }) : "",
    pricePath: t(`pricePaths.${style.pricePath}`),
    featured: t("card.featured"),
    variants: t("card.subVariants", { count: style.variantCount }),
    chips: chips.slice(0, CHIPS),
    moreChips: chips.length > CHIPS ? t("card.moreChips", { count: chips.length - CHIPS }) : null,
    alt: t("detail.thumbnailAlt", { name, code: style.code }),
  };
}
