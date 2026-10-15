import { getLocale, getTranslations } from "next-intl/server";

import type { StyleCard } from "@/features/customer/catalog/api.server";
import { getFormat } from "@/features/shared/format/server";

import { cardWords, StyleCardFace } from "./StyleCardFace";

/**
 * A plain grid of style cards for a landing page (D-410) — every card rendered on the server, no
 * save / compare island; `hrefOf` sends a card somewhere other than its style's page.
 */
export async function StyleCardGrid({
  styles,
  label,
  hrefOf,
}: {
  styles: StyleCard[];
  label: string;
  hrefOf?: (style: StyleCard, name: string) => string;
}) {
  const [t, locale, format] = await Promise.all([getTranslations("styles"), getLocale(), getFormat()]);
  return (
    <ul aria-label={label} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {styles.map((style, index) => {
        const words = cardWords(style, locale, t as never, {
          thb: (a) => format.thb(a),
          number: (n) => format.number(n),
        });
        return (
          <li key={style.code} className="flex">
            <StyleCardFace
              style={style}
              words={words}
              priority={index < 2}
              href={hrefOf?.(style, words.name)}
              className="w-full"
            />
          </li>
        );
      })}
    </ul>
  );
}
