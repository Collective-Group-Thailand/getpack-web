import { getLocale, getTranslations } from "next-intl/server";

import type { StyleCard } from "@/features/customer/catalog/api.server";
import { getFormat } from "@/features/shared/format/server";

import { facetLabel, type StylesT } from "./labels";
import { cardWords, StyleCardFace } from "./StyleCardFace";
import { StyleListing } from "./StyleListing";

/**
 * The styles of a landing page (D-410) — every card rendered on the server, no save / compare island; `hrefOf`
 * sends a card somewhere other than its style's page. Project A: under the same kind of toolbar as the library
 * (count, category chips, "ราคาทันทีเท่านั้น", order), filtering the list in the browser (`StyleListing`).
 */
export async function StyleCardGrid({
  styles,
  label,
  hrefOf,
  defaultSort = "popular",
}: {
  styles: StyleCard[];
  label: string;
  hrefOf?: (style: StyleCard, name: string) => string;
  /** The order the API returned the list in. */
  defaultSort?: "popular" | "name";
}) {
  const [t, locale, format] = await Promise.all([getTranslations("styles"), getLocale(), getFormat()]);
  const words = t as unknown as StylesT;
  const items = styles.map((style, index) => {
    const card = cardWords(style, locale, t as never, {
      thb: (a) => format.thb(a),
      number: (n) => format.number(n),
    });
    return {
      code: style.code,
      name: card.name,
      category: style.category,
      categoryLabel: facetLabel(words, "category", style.category),
      instant: style.pricePath === "instant",
      node: (
        <StyleCardFace
          style={style}
          words={card}
          priority={index < 2}
          href={hrefOf?.(style, card.name)}
          className="w-full"
        />
      ),
    };
  });
  return <StyleListing items={items} label={label} defaultSort={defaultSort} />;
}
