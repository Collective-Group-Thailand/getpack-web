import type { StyleCard } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { displayPrice, figuresOf } from "@/features/shared/format/price";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { ProductCard } from "@/ui/components/ProductCard";
import { Icon } from "@/ui/icons";

import { illustrationOf } from "./illustration";
import { previewSrc, styleHref } from "./paths";
import { cmOf } from "./size";
import { topicsOf } from "./topics";

/** How many option chips a card shows before "+N" — one line, so every card in a row keeps one height. */
const CHIPS = 2;

/**
 * The foot's text block. Priced and quoted cards share it: it keeps room for three lines and sets
 * its content on the bottom of them, so a quoted card's "ขอใบเสนอราคา" and its hint sit on the same
 * lines as a priced card's price and its quantity line, and the compare control beside it stays on
 * the row instead of dropping under the text.
 */
const FOOT_TEXT = "flex min-h-[2.9rem] min-w-0 flex-1 flex-col justify-end leading-tight max-sm:flex-none";

/** A card's words, prepared by whoever renders it (the server for the first page, the browser after). */
export interface StyleCardWords {
  name: string;
  category: string;
  /** "฿4.85/ใบ" — only with the API's starting price (D-220); never an estimate. */
  price?: string;
  /** "ที่ 1,000 ใบ" — the quantity that price assumes. */
  priceQuantity?: string;
  /** "รวม VAT" — printed with every price (the API's figures are VAT-inclusive, D-220). */
  priceVat?: string;
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
  /**
   * The spec row — size range, MOQ, lead time — each only when the API has it (C0: `fitRange`,
   * `moqUnits`; the card has no lead time yet, so that item is never drawn).
   */
  specs: Array<{ icon: "ruler" | "layers" | "clock"; text: string }>;
  /** "ใส่ได้", only on a card the size search returned (`fit`). */
  fit?: string;
  /** "แบบคลี่", the label over the hover dieline. */
  dieline: string;
  /** The features it offers ("หน้าต่าง", "หูแขวน", "ก้นล็อก"), the first few, and how many more. */
  chips: string[];
  /** "+n" counting every chip after the first, for phones (one chip fits a 2-column card). */
  moreChipsPhone: string | null;
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
  // "ราคาทันที" only with a price to show (owner decision, Project A review): an instant style the API sent
  // without a starting price shows no badge and keeps the quotation call to action.
  const instant = style.pricePath === "instant" && Boolean(words.price);
  return (
    <ProductCard
      as="article"
      aspect="square"
      className={className}
      priority={priority}
      reserveTitleLines
      roomy
      title={
        <Link href={href ?? styleHref(style.code, words.name)} data-style-code={style.code}>
          {words.name}
        </Link>
      }
      topLine={
        <>
          <span className="text-fg tracking-normal tabular-nums">{style.code}</span> · {words.category}
        </>
      }
      image={
        // The API's picture: a public photo path (`/v1/store/…`, through the BFF) or a signed thumbnail URL.
        thumb ? { src: thumb, alt: words.alt } : { src: previewSrc(style.code, {}), alt: words.alt, fit: "contain" }
      }
      fallback={{ family: illustrationOf(style) }}
      // The style's own rendered dieline (C0), only over a real picture: without one the card already shows the drawing.
      hoverImage={thumb && style.dielineUrl ? { src: style.dielineUrl, label: words.dieline } : undefined}
      badges={
        instant || style.featured || (words.fit && style.fit) ? (
          <>
            {/* "ใส่ได้" first in the badge row: at the top end (prototype) it collides with long badges on narrow cards. */}
            {words.fit && style.fit ? (
              <Badge tone="primary" icon="check" data-fit="">
                {words.fit}
              </Badge>
            ) : null}
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
          <span className="bg-surface/90 text-fg-2 border-border rounded-control inline-flex items-center gap-[5px] border py-[3px] ps-[7px] pe-[9px] text-xs font-medium tabular-nums backdrop-blur-sm">
            <Icon name="layers" size={13} aria-hidden="true" />
            {words.variants}
          </span>
        ) : undefined
      }
      // Owner redesign 2026-10-30: compare beside the heart over the picture (no longer a checkbox in the footer).
      imageActions={
        compare || favourite ? (
          <>
            {compare}
            {favourite}
          </>
        ) : undefined
      }
      facts={
        words.specs.length || words.meta ? (
          <>
            {words.specs.length ? (
              <ul className="text-fg-2 flex flex-wrap gap-x-3 gap-y-1" data-card-specs="">
                {words.specs.map((spec) => (
                  <li key={spec.icon} className="inline-flex items-center gap-1 tabular-nums">
                    <Icon name={spec.icon} size={14} aria-hidden="true" />
                    {spec.text}
                  </li>
                ))}
              </ul>
            ) : null}
            {words.meta ? <p className="truncate">{words.meta}</p> : null}
          </>
        ) : undefined
      }
      details={
        words.chips.length ? (
          <ul className="flex flex-nowrap gap-1 overflow-hidden" aria-label={words.variants}>
            {words.chips.map((chip, index) => (
              // Phones show one chip and a "+n" for the rest (the 2-column card is too narrow for two).
              <li key={chip} className={index > 0 ? "min-w-0 max-sm:hidden" : "min-w-0"}>
                <Badge size="sm" className="max-w-full truncate">
                  {chip}
                </Badge>
              </li>
            ))}
            {words.moreChips ? (
              <li className="shrink-0 max-sm:hidden">
                <Badge size="sm" className="tabular-nums">
                  {words.moreChips}
                </Badge>
              </li>
            ) : null}
            {words.moreChipsPhone ? (
              <li className="shrink-0 sm:hidden">
                <Badge size="sm" className="tabular-nums">
                  {words.moreChipsPhone}
                </Badge>
              </li>
            ) : null}
          </ul>
        ) : null
      }
      footer={
        <>
          {words.price ? (
            <p className={FOOT_TEXT}>
              <span className="text-muted block text-[0.6875rem]">{words.priceLabel}</span>
              <span className="text-instant-subtle-fg block text-sm font-semibold tabular-nums">{words.price}</span>
              {words.priceQuantity || words.priceVat ? (
                <span className="text-muted block text-[0.6875rem] tabular-nums">
                  {[words.priceQuantity, words.priceVat].filter(Boolean).join(" · ")}
                </span>
              ) : null}
            </p>
          ) : (
            <p className={FOOT_TEXT}>
              <span className="block text-sm font-semibold">{words.quote}</span>
              <span className="text-muted block text-[0.6875rem]">{words.quoteHint}</span>
            </p>
          )}
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
  // The one shared helper formats and labels the API's figure; it is VAT-inclusive today, so that is what it says.
  const shown = displayPrice(figuresOf(style.startingPrice?.unitPrice), "incl", format.thb, {
    incl: t("library.vatLabelIncl"),
    excl: t("library.vatLabelExcl"),
  });
  return {
    name,
    category: t.has(`categories.${style.category}`) ? t(`categories.${style.category}`) : style.category,
    price: shown ? t("library.cardPrice", { price: shown.amount }) : undefined,
    priceVat: shown?.vatLabel,
    priceQuantity: style.startingPrice
      ? t("library.cardAtQuantity", { quantity: format.number(style.startingPrice.quantity) })
      : undefined,
    priceLabel: t("library.cardFrom"),
    quote: t("library.cardQuote"),
    // C0b (DECISIONS-STAGE-A §9.3): never an estimate — the team's response time when the API gives one.
    quoteHint: style.quoteResponseBusinessDays
      ? t("library.cardQuoteResponse", { days: style.quoteResponseBusinessDays })
      : t("library.cardQuoteHint"),
    meta: style.referenceCode ? t("card.reference", { code: style.referenceCode }) : "",
    instant: t("library.cardInstant"),
    featured: t("card.featured"),
    specs: [
      ...(style.fitRange
        ? [
            {
              icon: "ruler" as const,
              text: t("library.cardSizeRange", {
                min: cmOf(Math.min(style.fitRange.minLMm, style.fitRange.minWMm, style.fitRange.minHMm)),
                max: cmOf(Math.max(style.fitRange.maxLMm, style.fitRange.maxWMm, style.fitRange.maxHMm)),
              }),
            },
          ]
        : []),
      ...(style.moqUnits
        ? [{ icon: "layers" as const, text: t("library.cardMoq", { count: format.number(style.moqUnits) }) }]
        : []),
    ],
    fit: style.fit ? t("library.fitPill") : undefined,
    dieline: t("library.dielineLabel"),
    variants: t("library.cardOptions", { count: style.variantCount }),
    chips: chips.slice(0, CHIPS),
    moreChips: chips.length > CHIPS ? t("library.cardMore", { count: chips.length - CHIPS }) : null,
    moreChipsPhone: chips.length > 1 ? t("library.cardMore", { count: chips.length - 1 }) : null,
    alt: t("detail.thumbnailAlt", { name, code: style.code }),
  };
}
