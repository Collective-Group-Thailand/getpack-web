import type { StyleCard } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { ProductCard } from "@/ui/components/ProductCard";
import { Icon } from "@/ui/icons";

import { illustrationOf } from "./illustration";
import { previewSrc, styleHref } from "./paths";
import { topicsOf } from "./topics";

/** How many option chips a card shows before "+N" — one line, so every card in a row keeps one height. */
const CHIPS = 2;

/** A card's words, prepared by whoever renders it (the server for the first page, the browser after). */
export interface StyleCardWords {
  name: string;
  category: string;
  /** "฿4.85/ใบ" — only with the API's starting price (D-220); never an estimate. */
  price?: string;
  /** "ที่ 1,000 ใบ" — the quantity that price assumes. */
  priceQuantity?: string;
  /** "เริ่มต้น", the label over the price. */
  priceLabel: string;
  /** "ขอใบเสนอราคา" and its hint, for a style priced by quotation. */
  quote: string;
  quoteHint: string;
  /** "รหัสสากล …", only once Prepress verified it (D-211). */
  meta: string;
  instant: string;
  featured: string;
  /** "18 ตัวเลือก". */
  variants: string;
  /** The features it offers ("หน้าต่าง", "หูแขวน", "ก้นล็อก"), the first few, and how many more. */
  chips: string[];
  moreChips: string | null;
  alt: string;
}

/**
 * One style in the library (styles redesign §6): the picture (the API's photo or rendered
 * thumbnail, else the engine's drawing of it) with "ราคาทันที" only where that is true, its option
 * count and a favourite control; the code (mono) and category, a two-line name, chips; and a foot
 * with the price the API gives — or "ขอใบเสนอราคา" — beside the compare control.
 *
 * Every fact is the API's and each is left out when absent. `favourite` and `compare` are the
 * browser islands; without them (a landing page) the card is fully server-rendered.
 */
export function StyleCardFace({
  style,
  words,
  favourite,
  compare,
  priority = false,
  href,
  className,
}: {
  style: StyleCard;
  words: StyleCardWords;
  /** The favourite control over the picture. */
  favourite?: React.ReactNode;
  /** The compare control in the foot. */
  compare?: React.ReactNode;
  priority?: boolean;
  /** Where the card goes, when not the style's page (a feature page sends it to its own, D-410). */
  href?: string;
  className?: string;
}) {
  const thumb = storeImageSrc(style.thumbnailUrl, "thumb");
  const instant = style.pricePath === "instant";
  return (
    <ProductCard
      as="article"
      aspect="square"
      className={className}
      priority={priority}
      reserveTitleLines
      title={
        <Link href={href ?? styleHref(style.code, words.name)} data-style-code={style.code}>
          {words.name}
        </Link>
      }
      topLine={
        <>
          <span className="text-fg font-mono tracking-normal">{style.code}</span> · {words.category}
        </>
      }
      image={
        // The API's picture: a public photo path (`/v1/store/…`, through the BFF) or a signed thumbnail URL.
        thumb ? { src: thumb, alt: words.alt } : { src: previewSrc(style.code, {}), alt: words.alt, fit: "contain" }
      }
      fallback={{ family: illustrationOf(style) }}
      badges={
        instant || style.featured ? (
          <>
            {instant ? (
              <Badge tone="instant" icon="zap">
                {words.instant}
              </Badge>
            ) : null}
            {style.featured ? <Badge tone="primary">{words.featured}</Badge> : null}
          </>
        ) : undefined
      }
      imageFoot={
        style.variantCount > 1 ? (
          <span className="bg-surface/95 text-fg border-border rounded-control inline-flex h-6 items-center gap-1 border px-2 text-[0.6875rem] font-medium tabular-nums">
            <Icon name="layers" size={12} aria-hidden="true" />
            {words.variants}
          </span>
        ) : undefined
      }
      imageActions={favourite}
      facts={words.meta ? <p className="truncate">{words.meta}</p> : undefined}
      details={
        words.chips.length ? (
          <ul className="flex flex-nowrap gap-1 overflow-hidden" aria-label={words.variants}>
            {words.chips.map((chip) => (
              <li key={chip} className="min-w-0">
                <Badge size="sm" className="max-w-full truncate">
                  {chip}
                </Badge>
              </li>
            ))}
            {words.moreChips ? (
              <li className="shrink-0">
                <Badge size="sm" className="tabular-nums">
                  {words.moreChips}
                </Badge>
              </li>
            ) : null}
          </ul>
        ) : null
      }
      footer={
        <>
          {words.price ? (
            <p className="min-w-[7.5rem] flex-1 leading-tight">
              <span className="text-muted block text-[0.6875rem]">{words.priceLabel}</span>
              <span className="text-instant-subtle-fg block text-sm font-semibold tabular-nums">{words.price}</span>
              {words.priceQuantity ? (
                <span className="text-muted block text-[0.6875rem] tabular-nums">{words.priceQuantity}</span>
              ) : null}
            </p>
          ) : (
            <p className="min-w-[7.5rem] flex-1 leading-tight">
              <span className="block text-sm font-semibold">{words.quote}</span>
              <span className="text-muted block text-[0.6875rem]">{words.quoteHint}</span>
            </p>
          )}
          {compare ?? null}
        </>
      }
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
      ? t("library.cardPrice", { price: format.thb(style.startingPrice.unitPrice) })
      : undefined,
    priceQuantity: style.startingPrice
      ? t("library.cardAtQuantity", { quantity: format.number(style.startingPrice.quantity) })
      : undefined,
    priceLabel: t("library.cardFrom"),
    quote: t("library.cardQuote"),
    quoteHint: t("library.cardQuoteHint"),
    meta: style.referenceCode ? t("card.reference", { code: style.referenceCode }) : "",
    instant: t("library.cardInstant"),
    featured: t("card.featured"),
    variants: t("library.cardOptions", { count: style.variantCount }),
    chips: chips.slice(0, CHIPS),
    moreChips: chips.length > CHIPS ? t("library.cardMore", { count: chips.length - CHIPS }) : null,
    alt: t("detail.thumbnailAlt", { name, code: style.code }),
  };
}
