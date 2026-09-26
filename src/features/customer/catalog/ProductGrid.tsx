import { getLocale, getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { ProductCard } from "@/ui/components/ProductCard";

import type { PriceHint, ProductCard as ProductCardDto, ProductType, StockProduct } from "./api.server";
import { storeImageSrc } from "./images";
import { pick } from "./localize";
import { productHref, stockProductHref } from "./paths";
import { priceHintText } from "./PriceHint";

export type GridItem = { kind: "catalog"; product: ProductCardDto } | { kind: "stock"; product: StockProduct };

export interface ProductGridProps {
  items: readonly GridItem[];
  /** Product types by code: the card's eyebrow and its instant / RFQ badge. */
  types: ReadonlyMap<string, ProductType>;
  hints: ReadonlyMap<string, PriceHint>;
  headingLevel?: "h2" | "h3";
  /** How many cards are above the fold on a phone, loaded eagerly (LCP). */
  eager?: number;
}

/**
 * A grid of products — catalogue products and stock products alike — each with its type, its
 * quote mode and, when the API has one, its "starting from" price and lead time.
 */
export async function ProductGrid({ items, types, hints, headingLevel = "h3", eager = 2 }: ProductGridProps) {
  const [locale, t, format] = await Promise.all([getLocale(), getTranslations("catalog"), getFormat()]);

  const cards = await Promise.all(
    items.map(async (item, index) => {
      if (item.kind === "catalog") {
        const { product } = item;
        const type = types.get(product.productTypeCode);
        const text = await priceHintText(hints.get(product.slug));
        const name = pick(locale, product.nameTh, product.nameEn);
        const src = storeImageSrc(product.imageUrl);
        return (
          <ProductCard
            key={`c-${product.slug}`}
            as="li"
            headingLevel={headingLevel}
            priority={index < eager}
            title={<Link href={productHref(product.slug)}>{name}</Link>}
            eyebrow={type ? pick(locale, type.nameTh, type.nameEn) : undefined}
            image={src ? { src, alt: name } : null}
            price={text.price ?? t("price.seePrice")}
            meta={text.leadTime}
            badges={
              type ? (
                <Badge tone={type.quoteMode === "instant" ? "success" : "info"}>
                  {type.quoteMode === "instant" ? t("card.instant") : t("card.rfq")}
                </Badge>
              ) : null
            }
          />
        );
      }
      const { product } = item;
      const text = await priceHintText(hints.get(product.sku));
      const name = pick(locale, product.nameTh, product.nameEn);
      const src = storeImageSrc(product.imageUrls[0]);
      return (
        <ProductCard
          key={`s-${product.sku}`}
          as="li"
          headingLevel={headingLevel}
          priority={index < eager}
          title={<Link href={stockProductHref(product.sku)}>{name}</Link>}
          eyebrow={t("card.stock")}
          image={src ? { src, alt: name } : null}
          price={text.price ?? t("price.seePrice")}
          meta={t("stock.minOrder", {
            quantity: format.number(product.minOrderQty),
            unit: t(`stock.units.${product.unit}`),
          })}
        />
      );
    }),
  );

  return <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{cards}</ul>;
}
