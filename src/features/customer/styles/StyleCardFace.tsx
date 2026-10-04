import type { StyleCard } from "@/features/customer/catalog/api.server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { ProductCard } from "@/ui/components/ProductCard";

import { styleHref } from "./paths";

/** A card's words, prepared by whoever renders it (the server for the first page, the browser after). */
export interface StyleCardWords {
  name: string;
  category: string;
  price?: string;
  meta: string;
  pricePath: string;
  featured: string;
}

/**
 * One style in the library (U3.5 §3): its code, the verified international code when there is
 * one (D-211), instant price or quotation, the API's "starting from" and how many variants it has.
 * No picture until the API publishes a card thumbnail: the card shows the neutral box glyph
 * instead (CONTRACT-GAP store.styles.card-thumbnail). `actions` is the save / compare island.
 */
export function StyleCardFace({
  style,
  words,
  actions,
  priority = false,
}: {
  style: StyleCard;
  words: StyleCardWords;
  actions: React.ReactNode;
  priority?: boolean;
}) {
  return (
    <ProductCard
      as="article"
      priority={priority}
      title={<Link href={styleHref(style.code, words.name)}>{words.name}</Link>}
      eyebrow={
        <>
          {words.category} · <span className="font-mono">{style.code}</span>
        </>
      }
      image={null}
      price={words.price}
      meta={words.meta}
      badges={
        <>
          <Badge tone={style.pricePath === "instant" ? "success" : "info"}>{words.pricePath}</Badge>
          {style.featured ? <Badge tone="primary">{words.featured}</Badge> : null}
        </>
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
  return {
    name,
    category: t.has(`categories.${style.category}`) ? t(`categories.${style.category}`) : style.category,
    price: style.startingPrice
      ? `${t("card.from", { price: format.thb(style.startingPrice.unitPrice) })} ${t("card.fromQuantity", {
          quantity: format.number(style.startingPrice.quantity),
        })}`
      : undefined,
    meta: [
      t("card.variants", { count: style.variantCount }),
      ...(style.referenceCode ? [t("card.reference", { code: style.referenceCode })] : []),
    ].join(" · "),
    pricePath: t(`pricePaths.${style.pricePath}`),
    featured: t("card.featured"),
  };
}
